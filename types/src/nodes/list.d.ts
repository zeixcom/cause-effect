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
/**
 * Key generation strategy for `createList` items.
 * A string value is used as a prefix for auto-incremented keys (`prefix0`, `prefix1`, …).
 * A function receives each item and returns a stable string key, or `undefined` to fall back to auto-increment.
 *
 * @template T - The type of items in the list
 */
type KeyConfig<T> = string | ((item: T) => string | undefined);
/**
 * Configuration options for `createList`.
 *
 * @template T - The type of items in the list
 */
type ListOptions<T extends {}> = {
    /** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
    keyConfig?: KeyConfig<T>;
    /** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. */
    watched?: () => Cleanup;
    /** Equality function for item state signals. Defaults to reference equality (`===`). */
    itemEquals?: (a: T, b: T) => boolean;
};
/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `State<T>` signal; structural changes (add/remove/sort) propagate reactively.
 *
 * @template T - The type of items in the list
 */
type List<T extends {}> = {
    readonly [Symbol.toStringTag]: 'List';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<State<T>>;
    readonly length: number;
    get(): T[];
    set(next: T[]): void;
    update(fn: (prev: T[]) => T[]): void;
    at(index: number): State<T> | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): State<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    /**
     * Updates an existing item by key, propagating to all subscribers.
     * No-op if the key does not exist or the value is reference-equal to the current value.
     * @param key - Stable key of the item to update
     * @param value - New value for the item
     */
    replace(key: string, value: T): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>;
};
/** Shallow equality check for string arrays */
declare function keysEqual(a: string[], b: string[]): boolean;
declare function getKeyGenerator<T extends {}>(keyConfig?: KeyConfig<T>): [(item: T) => string, boolean];
/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param value - Initial array of items
 * @param options.keyConfig - Key generation strategy: string prefix or `(item) => string | undefined`. Defaults to auto-increment.
 * @param options.watched - Lifecycle callback invoked on first subscriber; must return a cleanup function called on last unsubscribe.
 * @returns A `List` signal with reactive per-item `State` signals
 */
declare function createList<T extends {}>(value: T[], options?: ListOptions<T>): List<T>;
/**
 * Checks if a value is a List signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
declare function isList<T extends {}>(value: unknown): value is List<T>;
export { type DiffResult, type KeyConfig, type List, type ListOptions, type UnknownRecord, createList, isList, getKeyGenerator, keysEqual, TYPE_LIST, };
