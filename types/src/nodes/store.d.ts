import { type Cleanup } from '../graph';
import { type State } from './state';
type UnknownRecord = Record<string, unknown>;
type DiffResult = {
    changed: boolean;
    add: UnknownRecord;
    change: UnknownRecord;
    remove: UnknownRecord;
};
type StoreOptions = {
    watched?: () => Cleanup;
};
type Store<T extends UnknownRecord> = {
    readonly [Symbol.toStringTag]: 'Store';
    readonly [Symbol.isConcatSpreadable]: false;
    [Symbol.iterator](): IterableIterator<[string, State<T[keyof T] & {}>]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
    get(): T;
    set(newValue: T): void;
    update(fn: (oldValue: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
};
declare const TYPE_STORE: "Store";
/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
declare const isEqual: <T>(a: T, b: T, visited?: WeakSet<object>) => boolean;
/**
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult} The result of the comparison
 */
declare const diff: <T extends UnknownRecord>(oldObj: T, newObj: T) => DiffResult;
declare const createStore: <T extends UnknownRecord>(initialValue: T, options?: StoreOptions) => Store<T>;
declare const isStore: <T extends UnknownRecord>(value: unknown) => value is Store<T>;
export { createStore, diff, type DiffResult, isEqual, isStore, type Store, type StoreOptions, TYPE_STORE, };
