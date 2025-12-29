import { type DiffResult, type UnknownRecord } from '../diff';
import { createMutableSignal } from '../signal';
import { type Cleanup, type Listener, type Listeners, type Watcher } from '../system';
import type { List } from './list';
import type { State } from './state';
type MutableSignal<T extends {}> = State<T> | BaseStore<T> | List<T>;
type Store<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends Record<string, unknown & {}> ? Store<T[K]> : State<T[K] & {}>;
};
declare const TYPE_STORE: "Store";
declare class BaseStore<T extends UnknownRecord> {
    protected watchers: Set<Watcher>;
    protected listeners: Omit<Listeners, 'sort'>;
    protected signals: Map<string, MutableSignal<T[Extract<keyof T, string>] & {}>>;
    protected ownWatchers: Map<string, Watcher>;
    protected batching: boolean;
    /**
     * Create a new store with the given initial value.
     *
     * @param {T} initialValue - The initial value of the store
     * @throws {NullishSignalValueError} - If the initial value is null or undefined
     * @throws {InvalidSignalValueError} - If the initial value is not an object
     */
    constructor(initialValue: T);
    protected isValidValue<K extends keyof T & string>(key: K, value: unknown): value is NonNullable<T[K]>;
    protected addOwnWatcher<K extends keyof T & string>(key: K, signal: MutableSignal<T[K] & {}>): void;
    protected addProperty<K extends keyof T & string>(key: K, value: T[K], single?: boolean): boolean;
    protected removeProperty<K extends keyof T & string>(key: K, single?: boolean): void;
    protected batchChanges(changes: DiffResult, initialRun?: boolean): boolean;
    protected reconcile(oldValue: T, newValue: T, initialRun?: boolean): boolean;
    get [Symbol.toStringTag](): 'Store';
    get [Symbol.isConcatSpreadable](): boolean;
    [Symbol.iterator](): IterableIterator<[
        string,
        MutableSignal<T[Extract<keyof T, string>] & {}>
    ]>;
    get(): T;
    set(newValue: T): void;
    keys(): IterableIterator<string>;
    byKey(key: string): MutableSignal<T[Extract<keyof T, string>] & {}> | undefined;
    update(fn: (oldValue: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
    on<K extends keyof Omit<Listeners, 'sort'>>(type: K, listener: Listener<K>): Cleanup;
}
/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - Initial object or array value of the store
 * @returns {Store<T>} - New store with reactive properties that preserves the original type T
 */
declare const createStore: <T extends UnknownRecord>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecord>(value: unknown) => value is BaseStore<T>;
export { createStore, isStore, BaseStore, TYPE_STORE, createMutableSignal, type MutableSignal, type Store, };
