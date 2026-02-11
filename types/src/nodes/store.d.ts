import { type Cleanup, TYPE_STORE } from '../graph';
import { type List, type UnknownRecord } from './list';
import { type State } from './state';
type StoreOptions = {
    watched?: () => Cleanup;
};
type BaseStore<T extends UnknownRecord> = {
    readonly [Symbol.toStringTag]: 'Store';
    readonly [Symbol.isConcatSpreadable]: false;
    [Symbol.iterator](): IterableIterator<[
        string,
        State<T[keyof T] & {}> | Store<UnknownRecord> | List<unknown & {}>
    ]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
    get(): T;
    set(newValue: T): void;
    update(fn: (oldValue: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
};
type Store<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
};
/**
 * Creates a reactive store with deeply nested reactive properties.
 * Each property becomes its own signal (State for primitives, nested Store for objects, List for arrays).
 * Properties are accessible directly via proxy.
 *
 * @since 0.15.0
 * @param initialValue - Initial object value of the store
 * @param options - Optional configuration for watch lifecycle
 * @returns A Store with reactive properties
 *
 * @example
 * ```ts
 * const user = createStore({ name: 'Alice', age: 30 });
 * user.name.set('Bob'); // Only name subscribers react
 * console.log(user.get()); // { name: 'Bob', age: 30 }
 * ```
 */
declare function createStore<T extends UnknownRecord>(initialValue: T, options?: StoreOptions): Store<T>;
/**
 * Checks if a value is a Store signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a Store
 */
declare function isStore<T extends UnknownRecord>(value: unknown): value is Store<T>;
export { createStore, isStore, type Store, type StoreOptions, TYPE_STORE };
