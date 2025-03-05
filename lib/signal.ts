import { type State, isState, state } from "./state"
import { type Computed, computed, isComputed } from "./computed"
import { isFunction, toError } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T | Promise<T>)
type InferMaybeSignalType<T> = T extends Signal<infer U> ? U :
	T extends (() => infer U) ? U :
	T

type OkCallback<T, U extends MaybeSignal<{}>[]> = (...values: {
	[K in keyof U]: InferMaybeSignalType<U[K]>
}) => T | Promise<T> | Error
type NilCallback<T> = () => T | Promise<T> | Error
type ErrCallback<T> = (...errors: Error[]) => T | Promise<T> | Error

type ComputedCallbacks<T extends {}, U extends MaybeSignal<{}>[]> = OkCallback<T, U> | {
	ok: OkCallback<T, U>,
    nil?: NilCallback<T>,
    err?: ErrCallback<T>
}

type EffectCallbacks<U extends MaybeSignal<{}>[]> = OkCallback<void, U> | {
	ok: OkCallback<void, U>,
	nil?: NilCallback<void>,
	err?: ErrCallback<void>
}

type CallbackReturnType<T> = T | Promise<T> | Error | void

/* === Constants === */

const UNSET: any = Symbol()

/* === Private Functions === */

const isComputedCallbacks = /*#__PURE__*/ <T extends {}>(value: unknown): value is ComputedCallbacks<T, []> =>
	(isFunction(value) && !value.length)
		|| (typeof value === 'object' && value !== null && 'ok' in value && isFunction(value.ok))

/* === Exported Functions === */

/**
 * Check whether a value is a Signal or not
 * 
 * @since 0.9.0
 * @param {any} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
const isSignal = /*#__PURE__*/ <T extends {}>(value: any): value is Signal<T> =>
	isState(value) || isComputed(value)

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
const resolve = <T, U extends MaybeSignal<{}>[]>(
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
		[K in keyof U]: InferMaybeSignalType<U[K]>
	}
    const errors: Error[] = []
    let hasUnset = false

    for (let i = 0; i < maybeSignals.length; i++) {
		const s = maybeSignals[i]
		try {
			const value = isSignal(s) ? s.get() : isFunction(s) ? s() : s
			if (value === UNSET) hasUnset = true
			values[i] = value as InferMaybeSignalType<typeof s>
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
	type Signal, type MaybeSignal, type InferMaybeSignalType,
	type EffectCallbacks, type ComputedCallbacks, type CallbackReturnType,
    UNSET, isSignal, toSignal, resolve,
}