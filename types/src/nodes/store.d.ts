import { type Cleanup, TYPE_STORE } from '../graph';
import { type List, type UnknownRecord } from './list';
import { type State } from './state';
/**
 * Configuration options for `createStore`.
 */
type StoreOptions = {
    /** Invoked when the store gains its first downstream subscriber; returns a cleanup called when the last one unsubscribes. */
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
    set(next: T): void;
    update(fn: (prev: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
};
/**
 * A reactive object with per-property reactivity.
 * Each property is wrapped as a `State`, nested `Store`, or `List` signal, accessible directly via proxy.
 * Updating one property only re-runs effects that read that property.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type Store<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
};
/**
 * Creates a reactive store with deeply nested reactive properties.
 * Each property becomes its own signal (State for primitives, nested Store for objects, List for arrays).
 * Properties are accessible directly via proxy.
 *
 * @since 0.15.0
 * @param value - Initial object value of the store
 * @param options - Optional configuration for watch lifecycle
 * @returns A Store with reactive properties
 *
 * @example
 * ```ts
 * const user = createStore({ name: 'Alice', age: 30 });
 * user.name.set('Bob'); // Only name subscribers react
 * console.log(user.get()); // { name: 'Bob', age: 30 }
 * ```
 *
 * Direct property assignment, deletion, or `Object.defineProperty` through the
 * proxy throws `InvalidStoreMutationError` — use `store.key.set(value)`,
 * `store.set(next)`, `store.add(key, value)`, or `store.remove(key)` instead.
 * Properties are typed as signals (not raw values) so destructuring preserves
 * reactivity; this means proxy assignment is a compile-time error for typed
 * stores. The runtime guard extends that protection to `any`-typed access,
 * JS consumers, and `Object.assign`. See ADR-0017 for the full rationale.
 *
 * Note: a data key named like a base method (`get`, `set`, `keys`, `update`,
 * `add`, `remove`, `byKey`) shadows the method via proxy access. Use
 * `store.byKey(key)` to reach such a property.
 */
declare function createStore<T extends UnknownRecord>(value: T, options?: StoreOptions): Store<T>;
/**
 * Checks if a value is a Store signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a Store
 */
declare function isStore<T extends UnknownRecord>(value: unknown): value is Store<T>;
export { createStore, isStore, type Store, type StoreOptions, TYPE_STORE };
