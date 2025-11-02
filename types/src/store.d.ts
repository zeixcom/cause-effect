import { type Signal } from './signal';
import { type State } from './state';
declare const TYPE_STORE = "Store";
type Store<T extends Record<string, unknown & {}> = Record<string, unknown & {}>> = {
    [K in keyof T]: T[K] extends Record<string, unknown & {}> ? Store<T[K]> : State<T[K]>;
} & {
    [Symbol.toStringTag]: 'Store';
    [Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T]>]>;
    get(): T;
    set(value: T): void;
    update(updater: (value: T) => T): void;
    additions: Signal<Partial<T>>;
    removals: Signal<Partial<T>>;
    mutations: Signal<Partial<T>>;
    size: State<number>;
};
/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object value of the store
 * @returns {Store<T>} - new store with reactive properties
 */
declare const store: <T extends Record<string, unknown & {}>>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends Record<string, unknown & {}>>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, store, type Store };
