import { type Cleanup, type Signal } from '../graph';
import { type KeyConfig, type List } from './list';
type CollectionSource<T extends {}> = List<T> | Collection<T>;
type DeriveCollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
type Collection<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Collection';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<Signal<T>>;
    keys(): IterableIterator<string>;
    get(): T[];
    at(index: number): Signal<T> | undefined;
    byKey(key: string): Signal<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>;
    readonly length: number;
};
type CollectionChanges<T> = {
    add?: T[];
    change?: T[];
    remove?: T[];
};
type CollectionOptions<T extends {}> = {
    value?: T[];
    keyConfig?: KeyConfig<T>;
    createItem?: (key: string, value: T) => Signal<T>;
};
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
 * Items are managed by the start callback via `applyChanges(diffResult)`.
 * The collection activates when first accessed by an effect and deactivates when no longer watched.
 *
 * @since 0.18.0
 * @param watched - Callback invoked when the collection starts being watched, receives applyChanges helper
 * @param options - Optional configuration including initial value, key generation, and item signal creation
 * @returns A read-only Collection signal
 */
declare function createCollection<T extends {}>(watched: CollectionCallback<T>, options?: CollectionOptions<T>): Collection<T>;
/**
 * Checks if a value is a Collection signal.
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a Collection
 */
declare function isCollection<T extends {}>(value: unknown): value is Collection<T>;
/**
 * Checks if a value is a valid Collection source (List or Collection).
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a List or Collection
 */
declare function isCollectionSource<T extends {}>(value: unknown): value is CollectionSource<T>;
export { createCollection, deriveCollection, isCollection, isCollectionSource, type Collection, type CollectionCallback, type CollectionChanges, type CollectionOptions, type CollectionSource, type DeriveCollectionCallback, };
