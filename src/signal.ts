import {
	type Computed,
	isComputed,
	isMemoCallback,
	isTaskCallback,
	Memo,
	Task,
} from './classes/computed'
import { createList, isList, type List } from './classes/list'
import { isState, State } from './classes/state'
import { createStore, isStore, type Store } from './classes/store'
import type { UnknownRecord } from './diff'
// import type { Collection } from './signals/collection'
import { isRecord, isUniformArray } from './util'

/* === Types === */

type Signal<T extends {}> = {
	get(): T
}

type MutableSignal<T extends {}> = T extends readonly (infer U extends {})[]
	? List<U>
	: T extends UnknownRecord
		? Store<T>
		: State<T>
type ReadonlySignal<T extends {}> = Computed<T> // | Collection<T>

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
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a State, Store, or List, false otherwise
 */
const isMutableSignal = /*#__PURE__*/ (
	value: unknown,
): value is MutableSignal<unknown & {}> =>
	isState(value) || isStore(value) || isList(value)

/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
function createSignal<T extends {}>(value: readonly T[]): List<T>
function createSignal<T extends {}>(value: T[]): List<T>
function createSignal<T extends UnknownRecord>(value: T): Store<T>
function createSignal<T extends {}>(value: () => T): Computed<T>
function createSignal<T extends {}>(value: T): State<T>
function createSignal(value: unknown): unknown {
	if (isMemoCallback(value)) return new Memo(value)
	if (isTaskCallback(value)) return new Task(value)
	if (isUniformArray<unknown & {}>(value)) return createList(value)
	if (isRecord(value)) return createStore(value as UnknownRecord)
	return new State(value as unknown & {})
}

/**
 * Convert a value to a MutableSignal.
 *
 * @since 0.17.0
 */
function createMutableSignal<T extends {}>(value: readonly T[]): List<T>
function createMutableSignal<T extends {}>(value: T[]): List<T>
function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>
function createMutableSignal<T extends {}>(value: T): State<T>
function createMutableSignal(value: unknown): unknown {
	if (isUniformArray<unknown & {}>(value)) return createList(value)
	if (isRecord(value)) return createStore(value as UnknownRecord)
	return new State(value as unknown & {})
}

/* === Exports === */

export {
	createMutableSignal,
	createSignal,
	isMutableSignal,
	isSignal,
	type MutableSignal,
	type ReadonlySignal,
	type Signal,
	type SignalValues,
	type UnknownSignalRecord,
}
