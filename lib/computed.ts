import {
	type Signal, type EffectCallbacks, type ComputedCallbacks,
	resolve, UNSET
} from './signal'
import { isError, isObjectOfType, isPromise, toError } from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { effect } from './effect'

/* === Types === */

export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed'
    get: () => T
    map: <U extends {}>(cb: ComputedCallbacks<U, [Computed<T>]>) => Computed<U>
	match: (cb: EffectCallbacks<[Computed<T>]>) => void
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Private Functions === */

const isEquivalentError = /*#__PURE__*/ (
	error1: Error,
	error2: Error | undefined
): boolean => {
    if (!error2) return false
    return error1.name === error2.name && error1.message === error2.message
}

/* === Computed Factory === */

/**
 * Create a derived signal from existing signals
 * 
 * @since 0.9.0
 * @param {() => T} cb - compute callback or object of ok, nil, err callbacks to derive state
 * @param {U} signals - signals of functions using signals this values depends on
 * @returns {Computed<T>} - Computed signal
 */
export const computed = <T extends {}, U extends Signal<{}>[]>(
	cb: ComputedCallbacks<T, U>,
	...signals: U
): Computed<T> => {
	const watchers: Watcher[] = []
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let unchanged = false
	let computing = false

	// Functions to update internal state
	const ok = (v: T) => {
		if (!Object.is(v, value)) {
			value = v
			dirty = false
			error = undefined
			unchanged = false
		}
	}
	const nil = () => {
		unchanged = (UNSET === value)
		value = UNSET
		error = undefined
	}
	const err = (e: unknown) => {
		const newError = toError(e)
		unchanged = isEquivalentError(newError, error)
		value = UNSET
		error = newError
	}

	// Called when notified from sources (push)
	const mark = () => {
		dirty = true
		if (!unchanged) notify(watchers)
	}

	// Called when requested by dependencies (pull)
	const compute = () => watch(() => {
		if (computing) throw new Error('Circular dependency in computed detected')
		unchanged = true
		computing = true
		const result = resolve(signals, cb)
		if (isPromise(result)) {
			nil() // sync
			result.then(v => {
				ok(v) // async
                notify(watchers)
			}).catch(err)
		} else if (null == result || UNSET === result) nil()
		else if (isError(result)) err(result)
		else ok(result)
		computing = false
	}, mark)

	const c: Computed<T> = {
		[Symbol.toStringTag]: TYPE_COMPUTED,

		/**
		 * Get the current value of the computed
		 * 
		 * @since 0.9.0
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
		 * @param {ComputedCallbacks<U, [Computed<T>]>} cb - compute callback or object of ok, nil, err callbacks to map this value to new computed
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(cb: ComputedCallbacks<U, [Computed<T>]>): Computed<U> =>
			computed(cb, c),

		/**
		 * Case matching for the computed signal with effect callbacks
		 * 
		 * @since 0.12.0
		 * @param {EffectCallbacks[Computed<T>]} cb - effect callback or object of ok, nil, err callbacks to be executed when the computed changes
		 * @returns {Computed<T>} - self, for chaining effect callbacks
		 */
		match: (cb: EffectCallbacks<[Computed<T>]>): Computed<T> => {
			effect(cb, c)
			return c
		}
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
