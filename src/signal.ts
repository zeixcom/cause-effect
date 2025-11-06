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
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>

type UnknownSignalRecord = Record<string, Signal<unknown & {}>>

type SignalValues<S extends UnknownSignalRecord> = {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}

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
): value is Signal<T> => isState(value) || isComputed(value) || isStore(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {T} value - value to convert
 * @returns {Signal<T>} - Signal instance
 */
function toSignal<T extends {}>(value: T[]): Store<Record<number, T>>
function toSignal<T extends {}>(
	value: (() => T) | ((abort: AbortSignal) => Promise<T>),
): Computed<T>
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
				: T extends Record<string | number, unknown & {}>
					? Store<{ [K in keyof T]: T[K] }>
					: State<T>
function toSignal<T extends {}>(value: MaybeSignal<T>) {
	if (isSignal<T>(value)) return value
	if (isComputedCallback(value)) return computed(value)
	if (Array.isArray(value)) return store(value as T)
	if (Array.isArray(value) || isRecord(value)) return store(value)
	return state(value)
}

/**
 * Convert a value to a mutable Signal if it's not already a Signal
 *
 * @since 0.15.0
 * @param {T} value - value to convert
 * @returns {State<T> | Store<T>} - Signal instance
 */
function toMutableSignal<T extends {}>(value: T[]): Store<Record<string, T>>
function toMutableSignal<T extends {}>(
	value: T,
): T extends Store<infer U>
	? Store<U>
	: T extends State<infer U>
		? State<U>
		: T extends Record<string | number, unknown & {}>
			? Store<{ [K in keyof T]: T[K] }>
			: State<T>
function toMutableSignal<T extends {}>(value: T): State<T> | Store<T> {
	if (isState<T>(value) || isStore<T>(value)) return value
	if (Array.isArray(value)) return store(value as T)
	if (isRecord(value)) return store(value)
	return state(value)
}

/* === Exports === */

export {
	type Signal,
	type MaybeSignal,
	type UnknownSignalRecord,
	type SignalValues,
	isSignal,
	toSignal,
	toMutableSignal,
}
