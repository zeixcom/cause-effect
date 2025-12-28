import { BaseCollection } from './store'
import { type Computed, createComputed } from '../signals/computed'
import type { UnknownArray } from '../diff'
// import type { List } from './list'
import { match } from '../match'
import { resolve } from '../resolve'
import type { Signal } from '../signal'
import {
	type Cleanup,
	createWatcher,
	emit,
	type Notifications,
	notify,
	observe,
} from '../system'
import { isAsyncFunction, isObjectOfType, isSymbol, UNSET } from '../util'

/* === Types === */

type CollectionKeySignal<T extends {}> = T extends UnknownArray
	? Collection<T>
	: Computed<T>

type CollectionCallback<T extends {} & { then?: undefined }, O extends {}> =
	| ((originValue: O, abort: AbortSignal) => Promise<T>)
	| ((originValue: O) => T)

type Collection<T extends {}> = {
	readonly [Symbol.toStringTag]: typeof TYPE_COLLECTION
	readonly [Symbol.isConcatSpreadable]: boolean
	[Symbol.iterator](): IterableIterator<CollectionKeySignal<T>>
	readonly [n: number]: CollectionKeySignal<T>
	readonly length: number

	byKey(key: string): CollectionKeySignal<T> | undefined
	get(): T[]
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	on<K extends keyof Notifications>(
		type: K,
		listener: (payload: Notifications[K]) => void,
	): Cleanup
	sort(compareFn?: (a: T, b: T) => number): void
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Collection Implementation === */

class CollectionImpl<T extends {}> extends BaseCollection<Record<string, T>> {
	#origin: any | any // List<any> | Collection<any>
	#callback: CollectionCallback<T, any>

	get [Symbol.toStringTag](): string {
		return TYPE_COLLECTION
	}

	get [Symbol.isConcatSpreadable](): boolean {
		return true
	}

	constructor(
		origin: any | any, // List<any> | Collection<any>
		callback: CollectionCallback<T, any>,
	) {
		super()
		this.#origin = origin
		this.#callback = callback

		// Initialize properties from origin
		this.#initializeFromOrigin()
		this.#setupOriginListeners()
	}

	// Get current array
	protected current(): Record<string, T> {
		const record = {} as Record<string, T>
		for (const key of this.order) {
			const signal = this.signals.get(key)
			if (signal) {
				const value = signal.get()
				if (value !== UNSET) record[key] = value
			}
		}
		return record
	}

	// Get as array for external API
	get(): T[] {
		this.subscribe(this.watchers)
		return this.order
			.map(key => this.signals.get(key)?.get())
			.filter(v => v !== UNSET) as unknown as T[]
	}

	// Override createSignalForValue for computed signals
	protected createSignalForValue(_value: any): Signal<T> {
		// This won't be called directly since we create computed signals
		throw new Error('Collection signals are created via computed callbacks')
	}

	// Initialize properties from origin collection
	#initializeFromOrigin() {
		for (let i = 0; i < this.#origin.length; i++) {
			const key = this.#origin.keyAt(i)
			if (!key) continue
			this.#addComputedProperty(key)
		}
	}

	// Setup listeners for origin collection changes
	#setupOriginListeners() {
		this.#origin.on('add', additions => {
			for (const key of additions) {
				if (!this.signals.has(key)) this.#addComputedProperty(key)
			}
			notify(this.watchers)
			emit(this.listeners.add, additions)
		})

		this.#origin.on('remove', removals => {
			for (const key of Object.keys(removals)) {
				if (!this.signals.has(key)) continue
				this.removeProperty(key)
			}
			this.order = this.order.filter(() => true) // Compact array
			notify(this.watchers)
			emit(this.listeners.remove, removals)
		})

		this.#origin.on('sort', newOrder => {
			this.order = [...newOrder]
			notify(this.watchers)
			emit(this.listeners.sort, newOrder)
		})
	}

	// Add computed property for collection item
	#addComputedProperty(key: string): boolean {
		const computedCallback = isAsyncFunction(this.#callback)
			? async (_: T, abort: AbortSignal) => {
					const originSignal = this.#origin.byKey(key)
					if (!originSignal) return UNSET

					let result = UNSET
					match(resolve({ originSignal }), {
						ok: async ({ originSignal: originValue }) => {
							result = await this.#callback(originValue, abort)
						},
						err: (errors: readonly Error[]) => {
							console.log(errors)
						},
					})
					return result
				}
			: () => {
					const originSignal = this.#origin.byKey(key)
					if (!originSignal) return UNSET

					let result = UNSET
					match(resolve({ originSignal }), {
						ok: ({ originSignal: originValue }) => {
							result = (
								this.#callback as (originValue: any) => T
							)(originValue)
						},
						err: (errors: readonly Error[]) => {
							console.log(errors)
						},
					})
					return result
				}

		const signal = createComputed(computedCallback)

		// Set internal states
		this.signals.set(key, signal as any)
		if (!this.order.includes(key)) this.order.push(key)

		const watcher = createWatcher(() =>
			observe(() => {
				signal.get() // Subscribe to the signal
				emit(this.listeners.change, [key])
			}, watcher),
		)
		watcher()
		this.signalWatchers.set(key, watcher)
		return true
	}

	// Override iterator to yield signals directly
	*[Symbol.iterator](): IterableIterator<Signal<any>> {
		for (const key of this.order) {
			const signal = this.signals.get(key)
			if (signal) yield signal
		}
	}

	// Get signal by key or index
	#getSignal(prop: string): Signal<T> | undefined {
		let key = prop
		const index = Number(prop)
		if (Number.isInteger(index) && index >= 0)
			key = this.order[index] ?? prop
		return this.signals.get(key)
	}

	// Override byKey to use internal getSignal
	byKey(key: string) {
		return this.#getSignal(key)
	}

	// Override sort for array-specific logic
	sort(compareFn?: (a: T, b: T) => number): void {
		const entries = this.order
			.map((key, index) => {
				const signal = this.signals.get(key)
				return [index, key, signal ? signal.get() : undefined] as [
					number,
					string,
					T,
				]
			})
			.sort(
				compareFn
					? (a, b) => compareFn(a[2], b[2])
					: (a, b) => String(a[2]).localeCompare(String(b[2])),
			)

		// Set new order
		this.order = entries.map(([_, key]) => key)

		notify(this.watchers)
		emit(this.listeners.sort, this.order)
	}

	// Override proxy creation for array-like access
	protected createProxy(): Collection<T> {
		return new Proxy(this, {
			get(target, prop) {
				if (prop in target) return Reflect.get(target, prop)
				if (!isSymbol(prop)) return target.#getSignal(prop)
			},
			has(target, prop) {
				if (prop in target) return true
				return target.signals.has(String(prop))
			},
			ownKeys(target) {
				const staticKeys = Reflect.ownKeys(target)
				return [...new Set([...target.order, ...staticKeys])]
			},
			getOwnPropertyDescriptor(target, prop) {
				if (prop in target)
					return Reflect.getOwnPropertyDescriptor(target, prop)
				if (isSymbol(prop)) return undefined

				const signal = target.#getSignal(prop)
				return signal
					? {
							enumerable: true,
							configurable: true,
							writable: true,
							value: signal,
						}
					: undefined
			},
		}) as Collection<T>
	}
}

/* === Functions === */

/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.16.2
 * @param {List<O> | Collection<O>} origin - Origin of collection to derive values from
 * @param {CollectionCallback<T, O>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
const createCollection = <T extends {}, O extends {}>(
	origin: any | any, // List<O> | Collection<O>
	callback: CollectionCallback<T, O>,
): Collection<T> => {
	const instance = new CollectionImpl(origin, callback)
	return instance.createProxy()
}

const isCollection = /*#__PURE__*/ <T extends UnknownArray>(
	value: unknown,
): value is Collection<T> => isObjectOfType(value, TYPE_COLLECTION)

export {
	type Collection,
	type CollectionCallback,
	createCollection,
	isCollection,
	TYPE_COLLECTION,
}
