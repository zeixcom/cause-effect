import { type MemoCallback, type Signal, type TaskCallback } from './graph';
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
 * @deprecated Use `createCell(value)` for a single value — the terminal v2.0 name — or
 * `createList`/`createStore` directly for the collection shapes. `createSignal(value)` also
 * accepts all of these today, but it is a **wider** replacement, not an identical one: it
 * additionally accepts a function (dispatching to `Memo`/`Task`) and an already-existing
 * signal (returned unchanged), both of which this function rejects with
 * `InvalidSignalValueError`. For a plain value, an array, or a record, both behave identically.
 * `createMutableSignal` is removed in v2.0 with no replacement — v2.0 has no single function that
 * dispatches on shape for mutable construction; call `createState`/`createList`/`createStore`
 * directly. See [MIGRATION-2.0.md](../MIGRATION-2.0.md).
 *
 * @since 0.17.0
 */
declare function createMutableSignal<T extends {}>(value: MutableSignal<T>): MutableSignal<T>;
declare function createMutableSignal<T extends {}>(value: readonly T[]): MutableList<T>;
declare function createMutableSignal<T extends UnknownRecord>(value: T): MutableStore<T>;
declare function createMutableSignal<T extends {}>(value: T): State<T>;
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
export { createMutableSignal, createSignal, isMutableSignal, isSignal, type MutableSignal, };
