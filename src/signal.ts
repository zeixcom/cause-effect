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
import type { Collection } from './signals/collection'
import { isRecord } from './util'

/* === Types === */

type Signal<T extends {}> = {
	get(): T
}

type MutableSignal<T extends {}> = State<T> | Store<T> | List<T>
type ReadonlySignal<T extends {}> = Computed<T> | Collection<T>

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
const isMutableSignal = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is MutableSignal<T> =>
	isState(value) || isStore(value) || isList(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {T} value - value to convert
 */
const createSignal = <T extends {}>(value: T) => {
	if (isMemoCallback(value)) return new Memo(value)
	if (isTaskCallback(value)) return new Task(value)
	if (Array.isArray(value)) return createList(value)
	if (isRecord(value)) return createStore(value)
	return new State(value)
}

const createMutableSignal = <T extends {}>(value: T) => {
	if (Array.isArray(value)) return createList(value)
	if (isRecord(value)) return createStore(value)
	return new State(value)
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
