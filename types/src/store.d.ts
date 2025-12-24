import { type PartialRecord, type UnknownArray, type UnknownRecord } from './diff';
import { type State } from './state';
import { type Cleanup } from './system';
type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never;
type StoreKeySignal<T extends {}> = T extends readonly unknown[] | Record<string, unknown> ? Store<T> : State<T>;
type KeyConfig<T> = string | ((item: ArrayItem<T>) => string);
type StoreChanges<T> = {
    add: PartialRecord<T>;
    change: PartialRecord<T>;
    remove: PartialRecord<T>;
    sort: string[];
};
interface BaseStore {
    readonly [Symbol.toStringTag]: 'Store';
    readonly length: number;
}
type RecordStore<T extends UnknownRecord> = BaseStore & {
    [K in keyof T]: T[K] extends readonly unknown[] | Record<string, unknown> ? Store<T[K]> : State<T[K]>;
} & {
    [Symbol.iterator](): IterableIterator<[
        Extract<keyof T, string>,
        StoreKeySignal<T[Extract<keyof T, string>]>
    ]>;
    add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void;
    byKey<K extends Extract<keyof T, string>>(key: K): StoreKeySignal<T[K]>;
    get(): T;
    keyAt(index: number): undefined;
    indexByKey(key: string): undefined;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T[Extract<keyof T, string>]>(compareFn?: (a: U, b: U) => number): void;
    on<K extends keyof StoreChanges<T>>(type: K, listener: (change: StoreChanges<T>[K]) => void): Cleanup;
    remove<K extends Extract<keyof T, string>>(key: K): void;
};
type ArrayStore<T extends UnknownArray> = BaseStore & {
    [Symbol.iterator](): IterableIterator<StoreKeySignal<ArrayItem<T>>>;
    readonly [Symbol.isConcatSpreadable]: boolean;
    [n: number]: StoreKeySignal<ArrayItem<T>>;
    add(value: ArrayItem<T>): void;
    byKey(key: string): StoreKeySignal<ArrayItem<T>> | undefined;
    get(): T;
    keyAt(index: number): string | undefined;
    indexByKey(key: string): number | undefined;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = ArrayItem<T>>(compareFn?: (a: U, b: U) => number): void;
    on<K extends keyof StoreChanges<T>>(type: K, listener: (change: StoreChanges<T>[K]) => void): Cleanup;
    remove(index: number): void;
};
type Store<T extends UnknownRecord | UnknownArray> = T extends UnknownRecord ? RecordStore<T> : T extends UnknownArray ? ArrayStore<T> : never;
declare const TYPE_STORE = "Store";
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
 * @param {KeyConfig<T>} keyConfig - optional key configuration for array-like stores:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
declare const createStore: <T extends UnknownRecord | UnknownArray>(initialValue: T, keyConfig?: T extends UnknownArray ? KeyConfig<T> : never) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecord | UnknownArray>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, createStore, type Store, type StoreChanges, type KeyConfig, };
