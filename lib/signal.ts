import { type State, isState, state } from "./state"
import { type Computed, computed, isComputed } from "./computed"
import { isFunction, toError } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T | Promise<T>)

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
const isComputedCallback = /*#__PURE__*/ <T extends {}>(value: unknown): value is (() => T | Promise<T>) =>
	(isFunction(value) && !value.length)

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
	: isFunction<T>(value) ? computed(value)
	: state(value as T)


const match = <R, S extends Signal<{}>[]>(
	matcher: {
		signals: S
		ok: (...values: {
			[K in keyof S]: S[K] extends Signal<infer T> ? T : never
		}) => R
		err?: (...errors: Error[]) => R
		nil?: () => R
	}
) => {
	const { signals, ok } = matcher
	const err = matcher.err ?? ((...errors: Error[]) => {
		if (errors.length > 1) throw new AggregateError(errors)
		else throw errors[0]
	})
	const nil = matcher.nil ?? (() => UNSET)

	const errors: Error[] = []
	let suspense = false
	const values = signals.map(signal => {
		try {
			const value = signal.get()
			if (value === UNSET) suspense = true
			return value
		} catch (e) {
			errors.push(toError(e))
		}
	})
	
	try {
		return suspense ? nil()
			: errors.length ? err(...errors)
			: ok(...values as {
				[K in keyof S]: S[K] extends Signal<infer T> ? T : never
			})
	} catch (e) {
		return err(toError(e))
	}
}

export {
	type Signal, type MaybeSignal,
    UNSET, isSignal, isComputedCallback, toSignal, match,
}