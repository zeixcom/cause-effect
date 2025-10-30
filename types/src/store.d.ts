import { type State } from './state';
type StoreProperty<T> = T extends (...args: unknown[]) => unknown ? never : T extends Record<string, unknown & {}> ? Store<T> : State<T & {}>;
type Store<T extends Record<string, unknown & {}> = Record<string, unknown & {}>> = {
    [Symbol.toStringTag]: 'Store';
    get(): T;
    has(key: string): boolean;
    add<K extends string, V>(key: K, value: V): Store<T & Record<K, V>>;
    delete<K extends keyof T>(key: K): Store<Omit<T, K>>;
} & {
    [K in keyof T]: StoreProperty<T[K]>;
};
type UnknownStore = Store<Record<string, unknown & {}>>;
declare const TYPE_STORE = "Store";
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
export { TYPE_STORE, isStore, store, type Store, type UnknownStore };
