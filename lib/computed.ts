import { resolveSignals, UNSET, type SignalValue, type UnknownSignal } from './signal'
import { isEquivalentError, isError, isFunction, isObjectOfType, isPromise, toError } from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { type EffectCallbacks, effect } from './effect'

/* === Types === */

export type ComputedOkCallback<T extends {}, U extends UnknownSignal[]> = (
	...values: { [K in keyof U]: SignalValue<U[K]> }
) => T | Promise<T>

export type ComputedCallbacks<T extends {}, U extends UnknownSignal[]> = {
	ok: (...values: { [K in keyof U]: SignalValue<U[K]> }) => T | Promise<T>
	nil?: () => T | Promise<T>
	err?: (...errors: Error[]) => T | Promise<T>
}

export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed'
    get: () => T
    map: <U extends {}>(fn: (value: T) => U) => Computed<U>
	match: (callbacks: EffectCallbacks<[Computed<T>]>) => void
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Computed Factory === */

/**
 * Create a derived state from existing states
 * 
 * @since 0.9.0
 * @param {() => T} callbacksOrFn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export const computed = <T extends {}, U extends UnknownSignal[]>(
	callbacksOrFn: ComputedCallbacks<T, U> | ComputedOkCallback<T, U>,
	...signals: U
): Computed<T> => {
	const callbacks = isFunction(callbacksOrFn)
		? { ok: callbacksOrFn }
		: callbacksOrFn
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
		if (computing) throw new Error('Circular dependency detected')
		unchanged = true
		computing = true
		const result = resolveSignals(signals, callbacks as ComputedCallbacks<T, U>)
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
		 * @param {(value: T) => R} fn
		 * @returns {Computed<R>} - computed signal
		 */
		map: <R extends {}>(fn: (value: T) => R): Computed<R> =>
			computed(() => fn(c.get())),

		/**
		 * Case matching for the computed signal with effect callbacks
		 * 
		 * @since 0.12.0
		 * @method of Computed<T>
		 * @param {EffectCallbacks[<T>]} callbacks 
		 * @returns {void} - executes the effect callbacks when the computed signal changes
		 */
		match: (callbacks: EffectCallbacks<[Computed<T>]>): void =>
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
