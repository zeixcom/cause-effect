import { InvalidSignalValueError } from './errors'
import {
	type ComputedOptions,
	type MemoCallback,
	type Signal,
	type TaskCallback,
	TYPE_COLLECTION,
	TYPE_LIST,
	TYPE_MEMO,
	TYPE_SENSOR,
	TYPE_SLOT,
	TYPE_STATE,
	TYPE_STORE,
	TYPE_TASK,
} from './graph'
import { createList, isList, type List, type UnknownRecord } from './nodes/list'
import { createMemo, isMemo, type Memo } from './nodes/memo'
import { createState, isState, type State } from './nodes/state'
import { createStore, isStore, type Store } from './nodes/store'
import { createTask, isTask, type Task } from './nodes/task'
import { isAsyncFunction, isFunction, isRecord, isUniformArray } from './util'

/* === Types === */

type MutableSignal<T extends {}> = {
	get(): T
	set(value: T): void
	update(callback: (value: T) => T): void
}

/* === Factory Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param callback - Computation callback function
 * @param options - Optional configuration
 */
function createComputed<T extends {}>(
	callback: TaskCallback<T>,
	options?: ComputedOptions<T>,
): Task<T>
function createComputed<T extends {}>(
	callback: MemoCallback<T>,
	options?: ComputedOptions<T>,
): Memo<T>
function createComputed<T extends {}>(
	callback: TaskCallback<T> | MemoCallback<T>,
	options?: ComputedOptions<T>,
): Memo<T> | Task<T> {
	return isAsyncFunction(callback)
		? createTask(callback as TaskCallback<T>, options)
		: createMemo(callback as MemoCallback<T>, options)
}

/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
function createSignal<T extends {}>(value: Signal<T>): Signal<T>
function createSignal<T extends {}>(value: readonly T[]): List<T>
function createSignal<T extends UnknownRecord>(value: T): Store<T>
function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>
function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>
function createSignal<T extends {}>(value: T): State<T>
function createSignal(value: unknown): unknown {
	if (isSignal(value)) return value
	if (value == null) throw new InvalidSignalValueError('createSignal', value)
	if (isAsyncFunction(value))
		return createTask(value as TaskCallback<unknown & {}>)
	if (isFunction(value))
		return createMemo(value as MemoCallback<unknown & {}>)
	if (isUniformArray<unknown & {}>(value)) return createList(value)
	if (isRecord(value)) return createStore(value)
	return createState(value as unknown & {})
}

/**
 * Convert a value to a MutableSignal.
 *
 * @since 0.17.0
 */
function createMutableSignal<T extends {}>(
	value: MutableSignal<T>,
): MutableSignal<T>
function createMutableSignal<T extends {}>(value: readonly T[]): List<T>
function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>
function createMutableSignal<T extends {}>(value: T): State<T>
function createMutableSignal(value: unknown): unknown {
	if (isMutableSignal(value)) return value
	if (value == null || isFunction(value) || isSignal(value))
		throw new InvalidSignalValueError('createMutableSignal', value)
	if (isUniformArray<unknown & {}>(value)) return createList(value)
	if (isRecord(value)) return createStore(value)
	return createState(value as unknown & {})
}

/* === Guards === */

/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a computed signal, false otherwise
 */
function isComputed<T extends {}>(value: unknown): value is Memo<T> {
	return isMemo(value) || isTask(value)
}

/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
function isSignal<T extends {}>(value: unknown): value is Signal<T> {
	const signalsTypes = [
		TYPE_STATE,
		TYPE_MEMO,
		TYPE_TASK,
		TYPE_SENSOR,
		TYPE_SLOT,
		TYPE_LIST,
		TYPE_COLLECTION,
		TYPE_STORE,
	]
	const typeStyle = Object.prototype.toString.call(value).slice(8, -1)
	return signalsTypes.includes(typeStyle)
}

/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a State, Store, or List, false otherwise
 */
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}> {
	return isState(value) || isStore(value) || isList(value)
}

export {
	type MutableSignal,
	createComputed,
	createSignal,
	createMutableSignal,
	isComputed,
	isSignal,
	isMutableSignal,
}
