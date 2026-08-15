import { type Cleanup, type MutableSignal, type Signal, TYPE_LIST } from '../graph';
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
type ListOptions<T extends {}, S extends MutableSignal<T> = MutableSignal<T>> = {
    /** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
    keyConfig?: KeyConfig<T>;
    /** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. Stays active through structural mutations (add/remove/sort) — only the subscriber count matters. */
    watched?: () => Cleanup;
    /** Equality function for item state signals. Defaults to `DEEP_EQUALITY`. */
    itemEquals?: (a: T, b: T) => boolean;
    /** Factory for per-item signals. Defaults to `createState`. */
    createItem?: (value: T) => S;
};
/**
 * A read-only reactive keyed sequence with per-item reactivity.
 * `deriveList()` returns one — from a computation, a seed with a watched lifecycle, or another
 * source derived per item. The shape all keyed-sequence factories converge on: `createList`
 * returns the mutable extension `MutableList<T,S>`, which is-a `List<T,S>`. See ADR-0018.
 *
 * @template T - The type of items in the sequence
 */
type List<T extends {}, S extends Signal<T> = Signal<T>> = {
    readonly [Symbol.toStringTag]: 'List';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<S>;
    readonly length: number;
    get(): T[];
    at(index: number): S | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): S | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
};
/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `MutableSignal<T>`; structural changes (add/remove/sort) propagate reactively.
 *
 * @template T - The type of items in the list
 */
type MutableList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>> = List<T, S> & {
    set(next: T[]): void;
    update(fn: (prev: T[]) => T[]): void;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    /**
     * Updates an existing item by key and propagates to every sink.
     * No-op if the key does not exist or the value is reference-equal to the current value.
     * @param key - Stable key of the item to update
     * @param value - New value for the item
     */
    replace(key: string, value: T): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
};
/** Shallow equality check for string arrays */
declare function keysEqual(a: string[], b: string[]): boolean;
declare function getKeyGenerator<T extends {}>(keyConfig?: KeyConfig<T>): [(item: T) => string, boolean];
/**
 * Compares two arrays using existing keys and returns differences as a DiffResult.
 * Avoids object conversion by working directly with arrays and keys.
 *
 * @since 0.18.0
 * @param prev - The old array
 * @param next - The new array
 * @param prevKeys - Current keys array (may be sparse or shorter than oldArray)
 * @param generateKey - Function to generate keys for new items
 * @param contentBased - When true, always use generateKey (content-based keys);
 *   when false, reuse positional keys from currentKeys (synthetic keys)
 * @returns The differences in DiffResult format plus updated keys array
 */
declare function diffArrays<T extends {}>(prev: T[], next: T[], prevKeys: string[], generateKey: (item: T) => string, contentBased: boolean, itemEquals: (a: T, b: T) => boolean): DiffResult & {
    newKeys: string[];
};
/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param value - Initial array of items
 * @param options.keyConfig - Key generation strategy: string prefix or `(item) => string | undefined`. Defaults to auto-increment.
 * @param options.watched - Lifecycle callback that runs when the list becomes watched. Must return a cleanup function.
 * @returns A `MutableList` signal with reactive per-item `MutableSignal`s
 */
declare function createList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(value: T[], options?: ListOptions<T, S>): MutableList<T, S>;
/**
 * Checks if a value is a List signal — the readonly base, matching both the mutable and
 * readonly keyed-sequence shapes. Use `isMutableList` to also require write access.
 *
 * @since 2.0.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
declare function isList<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is List<T, S>;
/**
 * Checks if a value is a mutable List signal.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a mutable List
 */
declare function isMutableList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(value: unknown): value is MutableList<T, S>;
export { createList, type DiffResult, diffArrays, getKeyGenerator, isList, isMutableList, type KeyConfig, keysEqual, type List, type ListOptions, type MutableList, TYPE_LIST, type UnknownRecord, };
