import { type State, isState, state } from "./state"
import { computed, type Computed, isComputed } from "./computed"
import { isComputeFunction } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>

type MaybeSignal<T extends {}> = State<T> | Computed<T> | T | ((old?: T) => T)

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

export {
	type Signal, type MaybeSignal,
    isSignal, toSignal
}