import { isState, state } from './state'
import {
	type ComputedCallback,
	isComputed,
	isComputedCallback,
	computed,
} from './computed'

/* === Types === */

type Signal<T extends {}> = {
	get(): T
}
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>

type SignalValues<S extends Signal<{}>[]> = {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}

/* === Constants === */

const UNSET: any = Symbol()

/* === Functions === */

/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
const isSignal = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Signal<T> => isState(value) || isComputed(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @returns {Signal<T>} - converted Signal
 */
const toSignal = /*#__PURE__*/ <T extends {}>(
	value: MaybeSignal<T>,
): Signal<T> =>
	isSignal<T>(value)
		? value
		: isComputedCallback<T>(value)
			? computed(value)
			: state(value as T)

/* === Exports === */

export {
	type Signal,
	type MaybeSignal,
	type SignalValues,
	UNSET,
	isSignal,
	isComputedCallback,
	toSignal,
}
