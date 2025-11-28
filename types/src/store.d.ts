import { type UnknownArray, type UnknownRecord, type UnknownRecordOrArray } from './diff';
import { type State } from './state';
import { type Cleanup } from './system';
type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never;
type StoreChanges<T> = {
    add: Partial<T>;
    change: Partial<T>;
    remove: Partial<T>;
    sort: string[];
};
interface BaseStore<T extends UnknownRecord | UnknownArray> {
    readonly [Symbol.toStringTag]: 'Store';
    get(): T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T extends UnknownArray ? ArrayItem<T> : T[Extract<keyof T, string>]>(compareFn?: (a: U, b: U) => number): void;
    on<K extends keyof StoreChanges<T>>(type: K, listener: (change: StoreChanges<T>[K]) => void): Cleanup;
    readonly size: State<number>;
}
type RecordStore<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly unknown[] | Record<string, unknown> ? Store<T[K]> : State<T[K]>;
} & {
    add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void;
    remove<K extends Extract<keyof T, string>>(key: K): void;
    [Symbol.iterator](): IterableIterator<[
        Extract<keyof T, string>,
        T[Extract<keyof T, string>] extends readonly unknown[] | Record<string, unknown> ? Store<T[Extract<keyof T, string>]> : State<T[Extract<keyof T, string>]>
    ]>;
};
type ArrayStore<T extends UnknownArray> = BaseStore<T> & {
    readonly length: number;
    [n: number]: ArrayItem<T> extends readonly unknown[] | Record<string, unknown> ? Store<ArrayItem<T>> : State<ArrayItem<T>>;
    add(value: ArrayItem<T>): void;
    remove(index: number): void;
    [Symbol.iterator](): IterableIterator<ArrayItem<T> extends readonly unknown[] | Record<string, unknown> ? Store<ArrayItem<T>> : State<ArrayItem<T>>>;
    readonly [Symbol.isConcatSpreadable]: boolean;
};
type Store<T> = T extends UnknownRecord ? RecordStore<T> : T extends UnknownArray ? ArrayStore<T> : never;
declare const TYPE_STORE = "Store";
/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
declare const createStore: <T extends UnknownRecord | UnknownArray>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecordOrArray>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, createStore, type Store };
