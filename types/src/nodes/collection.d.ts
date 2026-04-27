import { type Cleanup, type Signal } from '../graph';
import { type KeyConfig, type List } from './list';
type CollectionSource<T extends {}> = List<T> | Collection<T>;
/**
 * Transformation callback for `deriveCollection` — sync or async.
 * Sync callbacks produce a `Memo<T>` per item; async callbacks produce a `Task<T>`
 * with automatic cancellation when the source item changes.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type DeriveCollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
/**
 * A read-only reactive keyed collection with per-item reactivity.
 * Created by `createCollection` (externally driven) or via `.deriveCollection()` on a `List` or `Collection`.
 *
 * @template T - The type of items in the collection
 */
type Collection<T extends {}, S extends Signal<T> = Signal<T>> = {
    readonly [Symbol.toStringTag]: 'Collection';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<S>;
    keys(): IterableIterator<string>;
    get(): T[];
    at(index: number): S | undefined;
    byKey(key: string): S | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>;
    readonly length: number;
};
/**
 * Granular mutation descriptor passed to the `applyChanges` callback inside a `CollectionCallback`.
 *
 * @template T - The type of items in the collection
 */
type CollectionChanges<T> = {
    /** Items to add. Each item is assigned a new key via the configured `keyConfig`. */
    add?: T[];
    /** Items whose values have changed. Matched to existing entries by key. */
    change?: T[];
    /** Items to remove. Matched to existing entries by key. */
    remove?: T[];
};
/**
 * Configuration options for `createCollection`.
 *
 * @template T - The type of items in the collection
 */
type CollectionOptions<T extends {}, S extends Signal<T> = Signal<T>> = {
    /** Initial items. Defaults to `[]`. */
    value?: T[];
    /** Key generation strategy. See `KeyConfig`. Defaults to auto-increment. */
    keyConfig?: KeyConfig<T>;
    /** Factory for per-item signals. Defaults to `createState`. */
    createItem?: (value: T) => S;
    /** Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided. */
    itemEquals?: (a: T, b: T) => boolean;
};
/**
 * Setup callback for `createCollection`. Invoked when the collection gains its first downstream
 * subscriber; receives an `applyChanges` function to push granular mutations into the graph.
 *
 * @template T - The type of items in the collection
 * @param apply - Call with a `CollectionChanges` object to add, update, or remove items
 * @returns A cleanup function invoked when the collection loses all subscribers
 */
type CollectionCallback<T extends {}> = (apply: (changes: CollectionChanges<T>) => void) => Cleanup;
/**
 * Creates a derived Collection from a List or another Collection with item-level memoization.
 * Sync callbacks use createMemo, async callbacks use createTask.
 * Structural changes are tracked reactively via the source's keys.
 *
 * @since 0.18.0
 * @param source - The source List or Collection to derive from
 * @param callback - Transformation function applied to each item
 * @returns A Collection signal
 */
declare function deriveCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U) => T): Collection<T>;
declare function deriveCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U, abort: AbortSignal) => Promise<T>): Collection<T>;
/**
 * Creates an externally-driven Collection with a watched lifecycle.
 * Items are managed via the `applyChanges(changes)` helper passed to the watched callback.
 * The collection activates when first accessed by an effect and deactivates when no longer watched.
 *
 * @since 0.18.0
 * @param watched - Callback invoked when the collection starts being watched, receives applyChanges helper
 * @param options - Optional configuration including initial value, key generation, and item signal creation
 * @returns A read-only Collection signal
 */
declare function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(watched: CollectionCallback<T>, options?: CollectionOptions<T, S>): Collection<T, S>;
/**
 * Checks if a value is a Collection signal.
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a Collection
 */
declare function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is Collection<T, S>;
export { createCollection, deriveCollection, isCollection, type Collection, type CollectionCallback, type CollectionChanges, type CollectionOptions, type CollectionSource, type DeriveCollectionCallback, };
