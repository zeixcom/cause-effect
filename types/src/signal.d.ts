import { type ComputedOptions, type MemoCallback, type Signal, type TaskCallback } from './graph';
import { type List, type UnknownRecord } from './nodes/list';
import { type Memo } from './nodes/memo';
import { type State } from './nodes/state';
import { type Store } from './nodes/store';
import { type Task } from './nodes/task';
type MutableSignal<T extends {}> = {
    get(): T;
    set(value: T): void;
    update(callback: (value: T) => T): void;
};
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param callback - Computation callback function
 * @param options - Optional configuration
 */
declare function createComputed<T extends {}>(callback: TaskCallback<T>, options?: ComputedOptions<T>): Task<T>;
declare function createComputed<T extends {}>(callback: MemoCallback<T>, options?: ComputedOptions<T>): Memo<T>;
/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
declare function createSignal<T extends {}>(value: Signal<T>): Signal<T>;
declare function createSignal<T extends {}>(value: readonly T[]): List<T>;
declare function createSignal<T extends UnknownRecord>(value: T): Store<T>;
declare function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>;
declare function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>;
declare function createSignal<T extends {}>(value: T): State<T>;
/**
 * Convert a value to a MutableSignal.
 *
 * @since 0.17.0
 */
declare function createMutableSignal<T extends {}>(value: MutableSignal<T>): MutableSignal<T>;
declare function createMutableSignal<T extends {}>(value: readonly T[]): List<T>;
declare function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>;
declare function createMutableSignal<T extends {}>(value: T): State<T>;
/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a computed signal, false otherwise
 */
declare function isComputed<T extends {}>(value: unknown): value is Memo<T>;
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
export { type MutableSignal, createComputed, createSignal, createMutableSignal, isComputed, isSignal, isMutableSignal, };
