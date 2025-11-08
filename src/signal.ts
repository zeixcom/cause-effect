import {
	type Computed,
	type ComputedCallback,
	computed,
	isComputed,
	isComputedCallback,
} from './computed'
import { isState, type State, state } from './state'
import { isStore, type Store, store } from './store'
import { isRecord } from './util'

/* === Types === */

type Signal<T extends {}> = {
	get(): T
}

type UnknownSignalRecord = Record<string, Signal<unknown & {}>>

type SignalValues<S extends UnknownSignalRecord> = {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}

/* === Functions === */

/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
const isSignal = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Signal<T> => isState(value) || isComputed(value) || isStore(value)

/**
 * Check whether a value is a State or Store
 *
 * @since 0.15.2
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a State or Store, false otherwise
 */
const isMutableSignal = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is State<T> | Store<T> => isState(value) || isStore(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {T} value - value to convert
 * @returns {Signal<T>} - Signal instance
 */
function toSignal<T extends {}>(
	value: T,
): T extends Store<infer U>
	? Store<U>
	: T extends State<infer U>
		? State<U>
		: T extends Computed<infer U>
			? Computed<U>
			: T extends Signal<infer U>
				? Signal<U>
				: T extends ReadonlyArray<infer U extends {}>
					? Store<U[]>
					: T extends Record<string, unknown & {}>
						? Store<{ [K in keyof T]: T[K] }>
						: T extends ComputedCallback<infer U extends {}>
							? Computed<U>
							: State<T>
function toSignal<T extends {}>(value: T) {
	if (isSignal<T>(value)) return value
	if (isComputedCallback(value)) return computed(value)
	if (Array.isArray(value) || isRecord(value)) return store(value)
	return state(value)
}

/* === Exports === */

export {
	type Signal,
	type UnknownSignalRecord,
	type SignalValues,
	isSignal,
	isMutableSignal,
	toSignal,
}
