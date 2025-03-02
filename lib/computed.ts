import { UNSET } from './signal'
import { isEquivalentError, isObjectOfType, isPromise, toError } from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { type EffectCallbacks, effect } from './effect'

/* === Types === */

export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed'
    get: () => T
    map: <U extends {}>(fn: (value: T) => U) => Computed<U>
	match: (callbacks: EffectCallbacks<[T]>) => void
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Computed Factory === */

/**
 * Create a derived state from existing states
 * 
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export const computed =  /*#__PURE__*/ <T extends {}>(
	fn: (v?: T) => T | Promise<T>,
): Computed<T> => {
	const watchers: Watcher[] = []
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let unchanged = false
	let computing = false

	const mark = () => {
		dirty = true
		if (!unchanged) notify(watchers)
	}

	const compute = () => watch(() => {
		if (computing) throw new Error('Circular dependency detected')
		unchanged = true
		const ok = (v: T) => {
			if (!Object.is(v, value)) {
				value = v
				dirty = false
				error = undefined
				unchanged = false
			}
		}
		const err = (e: unknown) => {
			const newError = toError(e)
			unchanged = isEquivalentError(newError, error)
			error = newError
		}
		
		computing = true
		try {
			const res = fn(value)
			isPromise(res)
				? res.then(v => {
					ok(v)
					notify(watchers)
				}).catch(err)
				: ok(res)
		} catch (e) {
			err(e)
		} finally {
			computing = false
		}
	}, mark)

	const c: Computed<T> = {
		[Symbol.toStringTag]: TYPE_COMPUTED,

		/**
		 * Get the current value of the computed
		 * 
		 * @since 0.9.0
		 * @method of Computed<T>
		 * @returns {T} - current value of the computed
		 */
		get: (): T => {
			subscribe(watchers)
			flush()
			if (dirty) compute()
			if (error) throw error
			return value
		},

		/**
		 * Create a computed signal from the current computed signal
		 * 
		 * @since 0.9.0
		 * @method of Computed<T>
		 * @param {(value: T) => U} fn
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(fn: (value: T) => U): Computed<U> =>
			computed(() => fn(c.get())),

		/**
		 * Case matching for the computed signal with effect callbacks
		 * 
		 * @since 0.12.0
		 * @method of Computed<T>
		 * @param {EffectCallbacks[<T>]} callbacks 
		 * @returns {void} - executes the effect callbacks when the computed signal changes
		 */
		match: (callbacks: EffectCallbacks<[T]>): void =>
			effect(callbacks, c),
	}
	return c
}

/* === Helper Functions === */

/**
 * Check if a value is a computed state
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export const isComputed = /*#__PURE__*/ <T extends {}>(value: unknown): value is Computed<T> =>
	isObjectOfType(value, TYPE_COMPUTED)
