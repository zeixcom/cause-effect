import { type Cleanup, type ComputedOptions, type MemoCallback, type Signal, type SignalOptions, type TaskCallback } from './graph';
import { type MutableList, type UnknownRecord } from './nodes/list';
import { type Memo } from './nodes/memo';
import { type State } from './nodes/state';
import { type MutableStore } from './nodes/store';
import { type Task } from './nodes/task';
/**
 * A readable and writable signal — the type union of `State`, `Store`, and `List`.
 * Use as a parameter type for generic code that accepts any writable signal.
 *
 * @template T - The type of value held by the signal
 */
type MutableSignal<T extends {}> = {
    get(): T;
    set(value: T): void;
    update(callback: (value: T) => T): void;
};
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
    initial?: T;
    /**
     * Optional callback invoked when the signal is first watched by an effect.
     * Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
     * Must return a cleanup function that is called when the signal is no longer watched.
     */
    watched?: (invalidate: () => void) => Cleanup;
};
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
declare function createComputed<T extends {}>(callback: TaskCallback<T>, options?: ComputedOptions<T>): Task<T>;
declare function createComputed<T extends {}>(callback: MemoCallback<T>, options?: ComputedOptions<T>): Memo<T>;
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
declare function deriveSignal<T extends {}>(input: MemoCallback<T>, options?: DeriveSignalOptions<T>): Signal<T>;
declare function deriveSignal<T extends {}>(input: TaskCallback<T>, options?: DeriveSignalOptions<T>): Signal<T>;
declare function deriveSignal<T extends {}>(input: T, options: SignalOptions<T> & {
    watched: (set: (next: T) => void) => Cleanup;
}): Signal<T>;
/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
declare function createSignal<T extends {}>(value: Signal<T>): Signal<T>;
declare function createSignal<T extends {}>(value: readonly T[]): MutableList<T>;
declare function createSignal<T extends UnknownRecord>(value: T): MutableStore<T>;
declare function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>;
declare function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>;
declare function createSignal<T extends {}>(value: T): State<T>;
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
declare function createMutableSignal<T extends {}>(value: MutableSignal<T>): MutableSignal<T>;
declare function createMutableSignal<T extends {}>(value: readonly T[]): MutableList<T>;
declare function createMutableSignal<T extends UnknownRecord>(value: T): MutableStore<T>;
declare function createMutableSignal<T extends {}>(value: T): State<T>;
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
declare function isComputed<T extends {}>(value: unknown): value is Memo<T> | Task<T>;
/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
declare function isSignal<T extends {}>(value: unknown): value is Signal<T>;
/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a State, Store, or List, false otherwise
 */
declare function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}>;
export { createComputed, createMutableSignal, createSignal, type DeriveSignalOptions, deriveSignal, isComputed, isMutableSignal, isSignal, type MutableSignal, };
