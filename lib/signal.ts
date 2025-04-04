import { type State, isState, state } from "./state"
import { type Computed, computed, isComputed } from "./computed"
import { isAbortError, isFunction, toError } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>
type ComputedCallback<T extends {}> = (abort?: AbortSignal) => T | Promise<T>
type MaybeSignal<T extends {}> = Signal<T> | T | ComputedCallback<T>

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
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 * 
 * @since 0.12.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
const isComputedCallback = /*#__PURE__*/ <T extends {}>(
	value: unknown
): value is ComputedCallback<T> =>
	isFunction(value) && value.length < 2

/**
 * Convert a value to a Signal if it's not already a Signal
 * 
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @returns {Signal<T>} - converted Signal
 */
const toSignal = /*#__PURE__*/ <T extends {}>(
	value: MaybeSignal<T>
): Signal<T> => isSignal<T>(value) ? value
	: isComputedCallback<T>(value) ? computed(value)
	: state(value as T)


/**
 * Resolve signals or functions using signals and apply callbacks based on the results
 * 
 * @since 0.13.0
 * @param {SignalMatcher<S, R>} matcher - SignalMatcher to match
 * @returns {R | Promise<R>} - result of the matched callback
 */
const match = <S extends Signal<{}>[], R>(
	matcher: {
		signals: S,
		abort?: AbortSignal,
		ok: ((...values: {
				[K in keyof S]: S[K] extends Signal<infer T> ? T : never
			}) => R | Promise<R>),
		err: ((...errors: Error[]) => R | Promise<R>),
		nil: (abort?: AbortSignal) => R | Promise<R>
	}
): R | Promise<R> => {
	const { signals, abort, ok, err, nil } = matcher

	const errors: Error[] = []
	let suspense = false
	const values = signals.map(signal => {
		try {
			const value = signal.get()
			if (value === UNSET) suspense = true
			return value
		} catch (e) {
			if (isAbortError(e)) throw e
			errors.push(toError(e))
		}
	}) as {
		[K in keyof S]: S[K] extends Signal<infer T extends {}> ? T : never
	}
	
	try {
		return suspense ? nil(abort)
			: errors.length ? err(...errors)
			: ok(...values)
	} catch (e) {
		if (isAbortError(e)) throw e
		const error = toError(e)
		return err(error)
	}
}

export {
	type Signal, type MaybeSignal, type ComputedCallback,
    UNSET, isSignal, isComputedCallback, toSignal, match,
}