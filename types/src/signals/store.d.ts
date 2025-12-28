import { type UnknownRecord } from '../diff';
import { type Cleanup, type Listener, type Notifications } from '../system';
import type { List } from './list';
import { type State } from './state';
type StoreKeySignal<T extends {}> = T extends readonly (infer U extends {})[] ? List<U> : T extends UnknownRecord ? Store<T> : State<T>;
interface BaseStore {
    readonly [Symbol.toStringTag]: 'Store';
    readonly length: number;
}
type Store<T extends UnknownRecord> = BaseStore & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T extends Record<string, unknown> ? Store<T[K]> : State<T[K]>;
} & {
    [Symbol.iterator](): IterableIterator<[
        Extract<keyof T, string>,
        StoreKeySignal<T[Extract<keyof T, string>]>
    ]>;
    add<K extends Extract<keyof T, string>>(key: K, value: T[K]): K;
    byKey<K extends Extract<keyof T, string>>(key: K): StoreKeySignal<T[K]>;
    get(): T;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T[Extract<keyof T, string>]>(compareFn?: (a: U, b: U) => number): void;
    on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup;
    remove<K extends Extract<keyof T, string>>(key: K): void;
};
declare const TYPE_STORE: "Store";
/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * For array-like stores, an optional keyConfig parameter can be provided to
 * generate stable keys for array items. This creates persistent references
 * that remain stable across sort and compact operations.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
declare const createStore: <T extends UnknownRecord>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecord>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, createStore, type Store };
