import { InvalidSignalValueError } from './errors'
import {
	type ComputedOptions,
	type MemoCallback,
	type MutableSignal,
	type Signal,
	type TaskCallback,
	TYPE_SIGNAL,
	TYPE_SLOT,
} from './graph'
import {
	createList,
	isList,
	isMutableList,
	type MutableList,
	type UnknownRecord,
} from './nodes/list'
import { createMemo } from './nodes/memo'
import { createState } from './nodes/state'
import {
	createStore,
	isMutableStore,
	isStore,
	type MutableStore,
} from './nodes/store'
import { createTask } from './nodes/task'
import { isAsyncFunction, isFunction, isRecord, isSignalOfType } from './util'

/** Local, non-generic Slot check — avoids `isSignalOfType`'s generic inferring `unknown`. */
function isSlotLike(value: unknown): boolean {
	return (
		value != null &&
		(value as Record<symbol, unknown>)[Symbol.toStringTag] === TYPE_SLOT
	)
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
	callback: TaskCallback<T> | MemoCallback<T>,
	options?: ComputedOptions<T>,
): Signal<T> {
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
function createSignal<T extends {}>(value: readonly T[]): MutableList<T>
function createSignal<T extends UnknownRecord>(value: T): MutableStore<T>
function createSignal<T extends {}>(
	value: TaskCallback<T> | MemoCallback<T>,
): Signal<T>
function createSignal<T extends {}>(value: T): MutableSignal<T>
function createSignal(value: unknown): unknown {
	// Broader than the exported `isSignal` guard (which matches only the single-value
	// shape): this idempotency check accepts any signal this module can construct, so
	// re-wrapping an existing List, Store, or Slot is a no-op rather than a coercion error.
	if (isSignal(value) || isList(value) || isStore(value) || isSlotLike(value))
		return value
	if (value == null) throw new InvalidSignalValueError('createSignal', value)
	if (isAsyncFunction(value))
		return createTask(value as TaskCallback<unknown & {}>)
	if (isFunction(value)) return createMemo(value as MemoCallback<unknown & {}>)
	if (Array.isArray(value) && value.every(item => item != null))
		return createList(value as (unknown & {})[])
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
function createMutableSignal<T extends {}>(value: readonly T[]): MutableList<T>
function createMutableSignal<T extends UnknownRecord>(value: T): MutableStore<T>
function createMutableSignal<T extends {}>(value: T): MutableSignal<T>
function createMutableSignal(value: unknown): unknown {
	if (isMutableSignal(value) || isMutableList(value) || isMutableStore(value))
		return value
	if (
		value == null ||
		isFunction(value) ||
		isSignal(value) ||
		isList(value) ||
		isStore(value) ||
		isSlotLike(value)
	)
		throw new InvalidSignalValueError('createMutableSignal', value)
	if (Array.isArray(value) && value.every(item => item != null))
		return createList(value as (unknown & {})[])
	if (isRecord(value)) return createStore(value)
	return createState(value as unknown & {})
}

/* === Guards === */

/**
 * Check whether a value is a Signal — the single-value shape, matching both the mutable
 * and readonly single-value signals. Use `isMutableSignal` to also require write access.
 * `List` and `Store` are distinct shapes with their own guards. See ADR-0018.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
function isSignal<T extends {}>(value: unknown): value is Signal<T> {
	return isSignalOfType(value, TYPE_SIGNAL)
}

/**
 * Check whether a value is a mutable Signal.
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a mutable Signal, false otherwise
 */
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}> {
	return (
		isSignal(value) &&
		typeof (value as Record<string, unknown>).set === 'function'
	)
}

export {
	createComputed,
	createMutableSignal,
	createSignal,
	isMutableSignal,
	isSignal,
}
