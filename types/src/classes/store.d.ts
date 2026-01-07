import { type UnknownRecord } from '../diff';
import { type MutableSignal } from '../signal';
import { type SignalOptions } from '../system';
import type { List } from './list';
import type { State } from './state';
type Store<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : State<T[K] & {}>;
};
declare const TYPE_STORE: "Store";
/**
 * Create a new store with the given initial value.
 *
 * @since 0.17.0
 * @param {T} initialValue - The initial value of the store
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is not an object
 */
declare class BaseStore<T extends UnknownRecord> {
    #private;
    constructor(initialValue: T, options?: SignalOptions<T>);
    get [Symbol.toStringTag](): 'Store';
    get [Symbol.isConcatSpreadable](): boolean;
    [Symbol.iterator](): IterableIterator<[
        string,
        MutableSignal<T[keyof T] & {}>
    ]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
    get(): T;
    set(newValue: T): void;
    update(fn: (oldValue: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
}
/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - Initial object or array value of the store
 * @param {SignalOptions<T>} options - Options for the store
 * @returns {Store<T>} - New store with reactive properties that preserves the original type T
 */
declare const createStore: <T extends UnknownRecord>(initialValue: T, options?: SignalOptions<T>) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecord>(value: unknown) => value is BaseStore<T>;
export { createStore, isStore, BaseStore, TYPE_STORE, type Store };
