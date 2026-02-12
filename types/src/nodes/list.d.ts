import { type Cleanup, TYPE_LIST } from '../graph';
import { type Collection } from './collection';
import { type State } from './state';
type UnknownRecord = Record<string, unknown>;
type DiffResult = {
    changed: boolean;
    add: UnknownRecord;
    change: UnknownRecord;
    remove: UnknownRecord;
};
type KeyConfig<T> = string | ((item: T) => string | undefined);
type ListOptions<T extends {}> = {
    keyConfig?: KeyConfig<T>;
    watched?: () => Cleanup;
};
type List<T extends {}> = {
    readonly [Symbol.toStringTag]: 'List';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<State<T>>;
    readonly length: number;
    get(): T[];
    set(newValue: T[]): void;
    update(fn: (oldValue: T[]) => T[]): void;
    at(index: number): State<T> | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): State<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>;
};
/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
/** Shallow equality check for string arrays */
declare function keysEqual(a: string[], b: string[]): boolean;
declare function isEqual<T>(a: T, b: T, visited?: WeakSet<object>): boolean;
/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param initialValue - Initial array of items
 * @param options - Optional configuration for key generation and watch lifecycle
 * @returns A List signal
 */
declare function createList<T extends {}>(initialValue: T[], options?: ListOptions<T>): List<T>;
/**
 * Checks if a value is a List signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
declare function isList<T extends {}>(value: unknown): value is List<T>;
export { type DiffResult, type KeyConfig, type List, type ListOptions, type UnknownRecord, createList, isEqual, isList, keysEqual, TYPE_LIST, };
