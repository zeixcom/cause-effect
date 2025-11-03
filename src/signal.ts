import {
	type Computed,
	type ComputedCallback,
	computed,
	isComputed,
	isComputedCallback,
} from './computed'
import { isState, type State, state } from './state'
import { isStore, type Store, store } from './store'
import { arrayToRecord, isRecord } from './util'

/* === Types === */

type Signal<T extends {}> = {
	get(): T
}
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>

type SignalValues<S extends Record<string, Signal<unknown & {}>>> = {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}

/* === Constants === */

// biome-ignore lint/suspicious/noExplicitAny: Deliberately using any to be used as a placeholder value in any signal
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
): value is Signal<T> => isState(value) || isComputed(value) || isStore(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 */
function toSignal<T extends Array<unknown & {}>>(
	value: T[],
): Store<Record<string, T>>
function toSignal<T extends Record<keyof T, T[keyof T]>>(value: T): Store<T>
function toSignal<T extends {}>(value: ComputedCallback<T>): Computed<T>
function toSignal<T extends {}>(value: Signal<T>): Signal<T>
function toSignal<T extends {}>(value: T): State<T>
function toSignal<T extends {}>(
	value: MaybeSignal<T> | T[],
): Signal<T> | Store<Record<string, T>> {
	if (isSignal<T>(value)) return value
	if (isComputedCallback<T>(value)) return computed(value)
	if (Array.isArray(value)) return store(arrayToRecord(value))
	if (isRecord(value)) return store(value as T)
	return state(value as T)
}

/**
 * Convert a value to a mutable Signal if it's not already a Signal
 *
 * @since 0.9.6
 */
function toMutableSignal<T extends Array<unknown & {}>>(
	value: T[],
): Store<Record<string, T>>
function toMutableSignal<T extends Record<keyof T, T[keyof T]>>(
	value: T,
): Store<T>
function toMutableSignal<T extends State<T>>(value: State<T>): State<T>
function toMutableSignal<T extends Store<T>>(value: Store<T>): Store<T>
function toMutableSignal<T extends {}>(value: T): State<T>
function toMutableSignal<T extends {}>(
	value: T | State<T> | Store<T> | T[],
): Signal<T> | Store<Record<string, T>> {
	if (isState<T>(value) || isStore<T>(value)) return value
	if (Array.isArray(value)) return store(arrayToRecord(value))
	if (isRecord(value)) return store(value as T)
	return state(value as T)
}

/* === Exports === */

export {
	type Signal,
	type MaybeSignal,
	type SignalValues,
	UNSET,
	isSignal,
	toSignal,
	toMutableSignal,
}
