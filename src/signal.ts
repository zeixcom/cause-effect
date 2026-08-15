import { InvalidSignalValueError, validateCallback } from './errors'
import {
	type Cleanup,
	type ComputedOptions,
	type MemoCallback,
	type Signal,
	type SignalOptions,
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
import {
	createList,
	isMutableList,
	type MutableList,
	type UnknownRecord,
} from './nodes/list'
import { createMemo, isMemo, type Memo } from './nodes/memo'
import { createSensor } from './nodes/sensor'
import { createState, isState, type State } from './nodes/state'
import { createStore, type MutableStore } from './nodes/store'
import { createTask, isTask, type Task } from './nodes/task'
import {
	isAsyncFunction,
	isFunction,
	isRecord,
	isSignalOfType,
	isSyncFunction,
} from './util'

/* === Types === */

/**
 * A readable and writable signal — the type union of `State`, `Store`, and `List`.
 * Use as a parameter type for generic code that accepts any writable signal.
 *
 * @template T - The type of value held by the signal
 */
type MutableSignal<T extends {}> = {
	get(): T
	set(value: T): void
	update(callback: (value: T) => T): void
}

/**
 * Configuration options for `deriveSignal`'s function-input forms (sync and async).
 * Mirrors `ComputedOptions`, renamed to the `initial` vocabulary `deriveList`/`deriveStore`
 * already use, so the whole `derive*` family reads consistently.
 *
 * Unlike `deriveList`/`deriveStore`, `initial` stays optional here: those two default to an
 * empty array/record so a collection is never unset, but `Signal<T>` has no such universal
 * empty value for an unconstrained `T`. An early read before the first resolution throws
 * `UnsetSignalValueError`, exactly as `createTask` already behaves — see
 * [ADR-0018](../adr/0018-shape-indexed-signal-types.md) §3, which scopes the
 * required-`initial` rule to `List`/`Store` only.
 *
 * @template T - The type of value the signal holds
 */
type DeriveSignalOptions<T extends {}> = SignalOptions<T> & {
	/** Initial value. Seeds a reducer pattern, or the value read before an async computation first resolves. */
	initial?: T
	/**
	 * Optional callback invoked when the signal is first watched by an effect.
	 * Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
	 * Must return a cleanup function that is called when the signal is no longer watched.
	 */
	watched?: (invalidate: () => void) => Cleanup
}

/* === Constants === */

const SIGNAL_TYPES = new Set([
	TYPE_STATE,
	TYPE_MEMO,
	TYPE_TASK,
	TYPE_SENSOR,
	TYPE_SLOT,
	TYPE_LIST,
	TYPE_COLLECTION,
	TYPE_STORE,
])

/* === Factory Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @deprecated Use `deriveSignal(callback, options?)` instead — same dispatch (sync function →
 * `Memo`, async function → `Task`), returned as `Signal<T>` rather than the deprecated
 * `Memo`/`Task` union. `createComputed` is removed in v2.0. See
 * [MIGRATION-2.0.md](../MIGRATION-2.0.md).
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
 * Create a read-only signal from any origin — the 1.5.0 bridge for `createComputed`, ahead of
 * v2.0's `deriveSignal`. Dispatches on `input`: a sync function derives a `Memo`, an async
 * function derives a `Task`, and a seed value with `options.watched` derives a `Sensor`. All
 * three are returned as `Signal<T>` — origin is not part of the return type, matching the 2.0
 * taxonomy ([ADR-0018](../adr/0018-shape-indexed-signal-types.md)).
 *
 * @since 1.5.0
 * @template T - The type of value the signal holds
 * @param input - A computation function or a seed value
 * @param options - Optional configuration; `watched` is required when `input` is a seed value
 * @returns A read-only Signal
 *
 * @example
 * ```ts
 * const userId = createSignal(1)
 * const user = deriveSignal(async (_prev, abort) => {
 *   const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
 *   return res.json()
 * }, { initial: fallbackUser })
 * ```
 */
function deriveSignal<T extends {}>(
	input: MemoCallback<T>,
	options?: DeriveSignalOptions<T>,
): Signal<T>
function deriveSignal<T extends {}>(
	input: TaskCallback<T>,
	options?: DeriveSignalOptions<T>,
): Signal<T>
function deriveSignal<T extends {}>(
	input: T,
	options: SignalOptions<T> & { watched: (set: (next: T) => void) => Cleanup },
): Signal<T>
function deriveSignal<T extends {}>(
	input: MemoCallback<T> | TaskCallback<T> | T,
	options?:
		| DeriveSignalOptions<T>
		| (SignalOptions<T> & { watched: (set: (next: T) => void) => Cleanup }),
): Signal<T> {
	if (isFunction(input)) {
		const { initial, watched, ...rest } = (options ??
			{}) as DeriveSignalOptions<T>
		const computedOptions = {
			...rest,
			value: initial,
			watched,
		} as ComputedOptions<T>
		return isAsyncFunction(input)
			? createTask(input as TaskCallback<T>, computedOptions)
			: createMemo(input as MemoCallback<T>, computedOptions)
	}

	const { watched, ...rest } = options as SignalOptions<T> & {
		watched: (set: (next: T) => void) => Cleanup
	}
	validateCallback('deriveSignal', watched, isSyncFunction)
	return createSensor(watched, { ...rest, value: input as T })
}

/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
function createSignal<T extends {}>(value: Signal<T>): Signal<T>
function createSignal<T extends {}>(value: readonly T[]): MutableList<T>
function createSignal<T extends UnknownRecord>(value: T): MutableStore<T>
function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>
function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>
function createSignal<T extends {}>(value: T): State<T>
function createSignal(value: unknown): unknown {
	if (isSignal(value)) return value
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
 * @deprecated Use `createSignal(value)` instead. `createSignal` is a **wider** replacement, not
 * an identical one: it additionally accepts a function (dispatching to `Memo`/`Task`) and an
 * already-existing signal (returned unchanged), both of which this function rejects with
 * `InvalidSignalValueError`. For a plain value, an array, or a record, both behave identically.
 * `createMutableSignal` is removed in v2.0 with no replacement — v2.0 has no single function that
 * dispatches on shape for mutable construction; call `createState`/`createList`/`createStore`
 * directly. See [MIGRATION-2.0.md](../MIGRATION-2.0.md) § The `createSignal` shape coercion.
 *
 * @since 0.17.0
 */
function createMutableSignal<T extends {}>(
	value: MutableSignal<T>,
): MutableSignal<T>
function createMutableSignal<T extends {}>(value: readonly T[]): MutableList<T>
function createMutableSignal<T extends UnknownRecord>(value: T): MutableStore<T>
function createMutableSignal<T extends {}>(value: T): State<T>
function createMutableSignal(value: unknown): unknown {
	if (isMutableSignal(value)) return value
	if (value == null || isFunction(value) || isSignal(value))
		throw new InvalidSignalValueError('createMutableSignal', value)
	if (Array.isArray(value) && value.every(item => item != null))
		return createList(value as (unknown & {})[])
	if (isRecord(value)) return createStore(value)
	return createState(value as unknown & {})
}

/* === Guards === */

/**
 * Check if a value is a computed signal
 *
 * @deprecated Removed in v2.0 with no mechanical replacement — origin is no longer part of the
 * consumption contract. Use `isSignal`/`isMutableSignal` or a plain property check instead. See
 * [MIGRATION-2.0.md](../MIGRATION-2.0.md) § Origin guards.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a computed signal, false otherwise
 */
function isComputed<T extends {}>(value: unknown): value is Memo<T> | Task<T> {
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
	return (
		value != null &&
		SIGNAL_TYPES.has(
			(value as Record<symbol, unknown>)[Symbol.toStringTag] as string,
		)
	)
}

/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a State, Store, or List, false otherwise
 */
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}> {
	// Deliberately the broad tag check, not `isMutableStore`: a `DerivedStore` shares the
	// 'Store' tag and this guard has matched it since `deriveStore` exists — narrowing it
	// would be a silent runtime flip. See MIGRATION-2.0.md.
	return (
		isState(value) || isSignalOfType(value, TYPE_STORE) || isMutableList(value)
	)
}

export {
	createComputed,
	createMutableSignal,
	createSignal,
	type DeriveSignalOptions,
	deriveSignal,
	isComputed,
	isMutableSignal,
	isSignal,
	type MutableSignal,
}
