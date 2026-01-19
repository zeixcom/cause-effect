// biome-ignore lint/suspicious/noExplicitAny: explicitly allow any Reactive
type UnknownReactive = Reactive<any>

type MemoCallback<T> = (oldValue: T) => T
type TaskCallback<T> = (oldValue: T, signal: AbortSignal) => Promise<T>

let currentReaction: UnknownReactive | undefined
let currentGets: UnknownReactive[] | null = null
let currentIndex = 0

/** A list of non-clean 'effect' nodes that will be updated when stabilize() is called */
const effectQueue: UnknownReactive[] = []

let stabilizeFn: ((node: UnknownReactive) => void) | undefined // fn to call if there are dirty effect nodes

export const CACHE_CLEAN = 0 // Reactive value is valid, no need to recompute
export const CACHE_CHECK = 1 // Reactive value might be stale, check parent nodes to decide whether to recompute
export const CACHE_DIRTY = 2 // Reactive value is invalid, parents have changed, value needs to be recomputed

export type CacheState =
	| typeof CACHE_CLEAN
	| typeof CACHE_CHECK
	| typeof CACHE_DIRTY
type CacheNonClean = typeof CACHE_CHECK | typeof CACHE_DIRTY

export class Reactive<T extends {}> {
	private value: T
	private error: Error | undefined
	private effect: boolean
	private fn?: MemoCallback<T> | TaskCallback<T>
	private equals = (a: T, b: T) => a === b

	private state: CacheState
	private observers: UnknownReactive[] = [] // Nodes that have us as sources (down links)
	private sources: UnknownReactive[] | null = null // Sources in reference order, not deduplicated (up links)
	private cleanups: ((oldValue: T) => void)[] = []
	private controller: AbortController | undefined

	constructor(
		fnOrValue:
			| ((oldValue: T) => T)
			| ((oldValue: T, signal: AbortSignal) => Promise<T>)
			| T,
		effect?: boolean,
	) {
		if (typeof fnOrValue === 'function') {
			this.fn = fnOrValue as (oldValue: T) => T
			// biome-ignore lint/suspicious/noExplicitAny: temporarily undefined
			this.value = undefined as any
			this.effect = effect || false
			this.state = CACHE_DIRTY
			if (effect) {
				effectQueue.push(this)
				stabilizeFn?.(this)
			}
		} else {
			this.fn = undefined
			this.value = fnOrValue
			this.state = CACHE_CLEAN
			this.effect = false
		}
	}

	/**
	 * Get current value.
	 *
	 * @returns {T} - Current value.
	 */
	get(): T {
		if (currentReaction) {
			if (
				!currentGets &&
				currentReaction.sources?.[currentIndex] === this
			) {
				currentIndex++
			} else {
				if (!currentGets) currentGets = [this]
				else currentGets.push(this)
			}
		}
		if (this.fn) this.updateIfNeeded()
		if (this.error) throw this.error
		return this.value
	}

	/**
	 * Set value or function.
	 *
	 * @param {T | MemoCallback<T> | TaskCallback<T>} fnOrValue - Value or function to set.
	 */
	set(fnOrValue: T | MemoCallback<T> | TaskCallback<T>): void {
		if (typeof fnOrValue === 'function') {
			const fn = fnOrValue as () => T
			if (fn !== this.fn) {
				this.fn = fn
				this.markStale(CACHE_DIRTY)
			}
		} else {
			if (this.fn) {
				this.invalidateObserving(0)
				this.sources = null
				this.fn = undefined
			}
			const value = fnOrValue as T
			if (!this.equals(this.value, value)) {
				this.value = value
				this.error = undefined
				for (let i = 0; i < this.observers.length; i++)
					this.observers[i].markStale(CACHE_DIRTY)
			}
		}
	}

	/**
	 * Get cleanup function.
	 */
	get cleanup(): () => void {
		return () => {
			for (let i = 0; i < this.cleanups.length; i++)
				this.cleanups[i](this.value)
			this.cleanups.length = 0
		}
	}

	/**
	 * Push stale state to observers (direction downstream in signal graph).
	 *
	 * @param state - The cache state to mark observing nodes.
	 */
	private markStale(state: CacheNonClean): void {
		this.controller?.abort()

		if (this.state < state) {
			// If we were previously clean, then we know that we may need to update to get the new value
			if (this.state === CACHE_CLEAN && this.effect) {
				effectQueue.push(this)
				stabilizeFn?.(this)
			}

			this.state = state
			for (let i = 0; i < this.observers.length; i++)
				this.observers[i].markStale(CACHE_CHECK)
		}
	}

	/**
	 * Remove all old sources' .observers links to us (direction upstream in signal graph).
	 *
	 * @param {number} index - The index of the source to invalidate.
	 * @returns {void}
	 */
	private invalidateObserving(index: number): void {
		if (!this.sources) return
		for (let i = index; i < this.sources.length; i++) {
			// We don't actually delete sources here because we're replacing the entire array soon
			const observers: UnknownReactive[] = this.sources[i].observers
			const swap = observers.findIndex(v => v === this)
			observers[swap] = observers[observers.length - 1]
			observers.pop()
		}
	}

	/**
	 * Update source & observer links after a change in this node (both directions).
	 */
	private updateLinks(): void {
		if (currentGets) {
			// Remove all old sources' .observers links to us
			this.invalidateObserving(currentIndex)
			// Update source up links
			if (currentIndex && this.sources) {
				this.sources.length = currentIndex + currentGets.length
				for (let i = 0; i < currentGets.length; i++)
					this.sources[currentIndex + i] = currentGets[i]
			} else {
				this.sources = currentGets
			}

			// Add ourselves to the end of the parent .observers array
			for (let i = currentIndex; i < this.sources.length; i++)
				this.sources[i].observers.push(this)
		} else if (this.sources && currentIndex < this.sources.length) {
			// Remove all old sources' .observers links to us
			this.invalidateObserving(currentIndex)
			this.sources.length = currentIndex
		}
	}

	/**
	 * Main function to update the value of the signal.
	 */
	private run(): void {
		if (!this.fn) return

		const oldValue = this.value

		// Handles diamond dependencies if we're the parent of a diamond
		const notifyObservers = () => {
			if (!this.equals(oldValue, this.value)) {
				// We've changed value, so mark our children as dirty so they'll reevaluate
				for (let i = 0; i < this.observers.length; i++)
					this.observers[i].state = CACHE_DIRTY
			}

			this.state = CACHE_CLEAN
		}

		// Evalute the reactive function body, dynamically capturing any other reactives used
		const prevReaction = currentReaction
		const prevGets = currentGets
		const prevIndex = currentIndex

		currentReaction = this
		// biome-ignore lint/suspicious/noExplicitAny: temporarily null
		currentGets = null as any // prevent TS from thinking CurrentGets is null below
		currentIndex = 0

		try {
			if (this.cleanups.length) {
				for (let i = 0; i < this.cleanups.length; i++)
					this.cleanups[i](this.value)
				this.cleanups.length = 0
			}
			if (this.fn.constructor.name === 'AsyncFunction') {
				this.controller = new AbortController()
				this.controller.signal.addEventListener(
					'abort',
					() => {
						this.controller = undefined

						// Retry computation with updated state
						this.run()
					},
					{
						once: true,
					},
				)
				;(this.fn as TaskCallback<T>)(
					this.value,
					this.controller.signal,
				).then(
					value => {
						this.value = value
						this.error = undefined

						this.updateLinks()
						notifyObservers()
					},
					error => {
						// biome-ignore lint/suspicious/noExplicitAny: temporarily undefined
						this.value = undefined as any
						if (
							error instanceof DOMException &&
							error.name === 'AbortError'
						)
							this.controller = undefined
						else
							this.error =
								error instanceof Error
									? error
									: Error(String(error))
					},
				)
			} else {
				this.value = (this.fn as MemoCallback<T>)(this.value)
				this.error = undefined
			}

			this.updateLinks()
		} catch (error) {
			// biome-ignore lint/suspicious/noExplicitAny: temporarily undefined
			this.value = undefined as any
			this.error = error instanceof Error ? error : Error(String(error))
		} finally {
			currentGets = prevGets
			currentReaction = prevReaction
			currentIndex = prevIndex
		}

		notifyObservers()
	}

	/**
	 * Pull updated source values (direction upstream in signal graph).
	 */
	private updateIfNeeded(): void {
		// If we are potentially dirty, see if we have a parent who has actually changed value
		if (this.state === CACHE_CHECK && this.sources) {
			for (let i = 0; i < this.sources.length; i++) {
				this.sources[i].updateIfNeeded() // updateIfNeeded() can change this.state
				if ((this.state as CacheState) === CACHE_DIRTY) break
			}
		}

		// If we were already dirty or marked dirty by the step above, update.
		if (this.state === CACHE_DIRTY) this.run()

		// By now, we're clean
		this.state = CACHE_CLEAN
	}
}

/** run all non-clean effect nodes */
export function flush(): void {
	for (let i = 0; i < effectQueue.length; i++) effectQueue[i].get()
	effectQueue.length = 0
}

export const createEffect = (fn: () => void): (() => void) =>
	new Reactive(fn, true).cleanup
