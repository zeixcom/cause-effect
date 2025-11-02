import { type Computed } from './computed';
import { type Signal } from './signal';
import { type State } from './state';
type StoreProperty<T> = T extends (...args: unknown[]) => unknown ? never : T extends Record<string, unknown & {}> ? Store<T> : State<T & {}>;
type Addition<T = unknown> = {
    key: string;
    value: T;
    timestamp: number;
};
type Mutation<T = unknown> = {
    key: string;
    value: T;
    oldValue: T;
    timestamp: number;
};
type Deletion<T = unknown> = {
    key: string;
    oldValue: T;
    timestamp: number;
};
type Store<T extends Record<string, unknown & {}> = Record<string, unknown & {}>> = {
    [Symbol.toStringTag]: 'Store';
    [Symbol.iterator](): IterableIterator<[string, StoreProperty<T[keyof T]>]>;
    clear(): void;
    delete(key: string): boolean;
    entries(): IterableIterator<[string, StoreProperty<T[keyof T]>]>;
    forEach(callback: (value: StoreProperty<T[keyof T]>, key: string, store: Store<T>) => void): void;
    get(key: string): StoreProperty<T[keyof T]> | undefined;
    has(key: string): boolean;
    keys(): IterableIterator<string>;
    set<K extends string, V>(key: K, value: V): Store<T & Record<K, V>>;
    values(): IterableIterator<StoreProperty<T[keyof T]>>;
    toObject(): T;
    size: Computed<number>;
    additions: Signal<Addition<T[keyof T]>[]>;
    mutations: Signal<Mutation<T[keyof T]>[]>;
    deletions: Signal<Deletion<T[keyof T]>[]>;
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
export { TYPE_STORE, isStore, store, type Store, type UnknownStore, type Addition, type Mutation, type Deletion, };
