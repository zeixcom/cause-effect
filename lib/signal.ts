import { type State, isState, state } from "./state"
import { computed, type Computed, isComputed } from "./computed"
import { isComputeFunction, isPromise, toError } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>
type UnknownSignal = Signal<{}>
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T)

type SignalValue<T> = T extends Signal<infer U> ? U : never

/* === Constants === */

export const UNSET: any = Symbol()

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
	value: MaybeSignal<T>
): Signal<T> =>
	isSignal<T>(value) ? value
		: isComputeFunction<T>(value) ? computed(value)
		: state(value)


/**
 * Resolve signals and apply callbacks based on the results
 * 
 * @since 0.12.0
 * @param {U} signals - dependency signals
 * @param {Record<string, (...args) => T | Promise<T> | Error | void>} callbacks - ok, nil, err callbacks
 * @returns {T | Promise<T> | Error | void} - result of chosen callback
 */
const resolveSignals = <T extends {}, U extends UnknownSignal[]>(
	signals: U,
	callbacks: {
		ok: (...values: { [K in keyof U]: SignalValue<U[K]> }) => T | Promise<T> | Error | void
		nil?: () => T | Promise<T> | Error | void
		err?: (...errors: Error[]) => T | Promise<T> | Error | void
	}
): T | Promise<T> | Error | void => {
	const { ok, nil, err  } = callbacks
	const values = [] as { [K in keyof U]: SignalValue<U[K]> }
    const errors: Error[] = []
    let hasUnset = false

    for (const signal of signals) {
		try {
			const value = signal.get()
			if (value === UNSET) hasUnset = true
			values.push(value)
		} catch (e) {
			errors.push(toError(e))
		}
    }

	let result: T | Promise<T> | Error | void = undefined
    try {
		if (hasUnset && nil) result = nil()
		else if (errors.length) result = err ? err(...errors) : errors[0]
		else if (!hasUnset) result = ok(...values)
    } catch (e) {
		result = toError(e)
		if (err) result = err(result)
    } finally {
		return result
	}
}

export {
	type Signal, type UnknownSignal, type SignalValue, type MaybeSignal,
    isSignal, toSignal, resolveSignals,
}