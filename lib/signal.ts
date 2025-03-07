import { type State, isState, state } from "./state"
import { type Computed, computed, isComputed } from "./computed"
import { isFunction, toError } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T | Promise<T>)
type InferSignalType<T> = T extends Signal<infer U> ? U : never

type OkCallback<T, U extends Signal<{}>[]> = (...values: {
	[K in keyof U]: InferSignalType<U[K]>
}) => T | Promise<T> | Error
type NilCallback<T> = () => T | Promise<T> | Error
type ErrCallback<T> = (...errors: Error[]) => T | Promise<T> | Error

type ComputedCallbacks<T extends {}, U extends Signal<{}>[]> = OkCallback<T, U> | {
	ok: OkCallback<T, U>,
    nil?: NilCallback<T>,
    err?: ErrCallback<T>
}

type EffectCallbacks<U extends Signal<{}>[]> = OkCallback<void, U> | {
	ok: OkCallback<void, U>,
	nil?: NilCallback<void>,
	err?: ErrCallback<void>
}

type CallbackReturnType<T> = T | Promise<T> | Error | void

/* === Constants === */

const UNSET: any = Symbol()

/* === Exported Functions === */

/**
 * Check whether a value is a Signal or not
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
const isSignal = /*#__PURE__*/ <T extends {}>(value: any): value is Signal<T> =>
	isState(value) || isComputed(value)

/**
 * Check if the provided value is a callback or callbacks object of { ok, nil?, err? } that may be used as input for toSignal() to derive a computed state
 * 
 * @since 0.12.4
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
const isComputedCallbacks = /*#__PURE__*/ <T extends {}>(value: unknown): value is ComputedCallbacks<T, []> =>
	(isFunction(value) && !value.length)
		|| (typeof value === 'object' && value !== null && 'ok' in value && isFunction(value.ok))

/**
 * Convert a value to a Signal if it's not already a Signal
 * 
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @param memo 
 * @returns {Signal<T>} - converted Signal
 */
const toSignal = /*#__PURE__*/ <T extends {}>(
	value: MaybeSignal<T> | ComputedCallbacks<T, []>
): Signal<T> =>
	isSignal<T>(value) ? value
		: isComputedCallbacks<T>(value) ? computed(value)
		: state(value as T)


/**
 * Resolve signals or functions using signals and apply callbacks based on the results
 * 
 * @since 0.12.0
 * @param {U} maybeSignals - dependency signals (or functions using signals)
 * @param {Record<string, (...args) => CallbackReturnType<T>} cb - object of ok, nil, err callbacks or just ok callback
 * @returns {CallbackReturnType<T>} - result of chosen callback
 */
const resolve = <T, U extends Signal<{}>[]>(
	maybeSignals: U,
	cb: OkCallback<T | Promise<T>, U> | {
		ok: OkCallback<T | Promise<T>, U>
		nil?: NilCallback<T>
		err?: ErrCallback<T>
	}
): CallbackReturnType<T> => {
	const { ok, nil, err } = isFunction(cb)
		? { ok: cb }
		: cb as {
			ok: OkCallback<T | Promise<T>, U>
			nil?: NilCallback<T>
			err?: ErrCallback<T>
		}
	const values = [] as {
		[K in keyof U]: InferSignalType<U[K]>
	}
    const errors: Error[] = []
    let hasUnset = false

    for (let i = 0; i < maybeSignals.length; i++) {
		const s = maybeSignals[i]
		try {
			const value = s.get()
			if (value === UNSET) hasUnset = true
			values[i] = value as InferSignalType<typeof s>
		} catch (e) {
			errors.push(toError(e))
		}
    }

	let result: CallbackReturnType<T> = undefined
    try {
		if (hasUnset && nil) result = nil()
		else if (errors.length) result = err ? err(...errors) : errors[0]
		else if (!hasUnset) result = ok(...values) as CallbackReturnType<T>
    } catch (e) {
		result = toError(e)
		if (err) result = err(result)
    }
	return result
}

export {
	type Signal, type MaybeSignal, type InferSignalType,
	type EffectCallbacks, type ComputedCallbacks, type CallbackReturnType,
    UNSET, isSignal, isComputedCallbacks, toSignal, resolve,
}