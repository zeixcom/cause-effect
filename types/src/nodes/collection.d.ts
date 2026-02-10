import { type Signal } from '../graph';
import { type List } from './list';
type CollectionSource<T extends {}> = List<T> | Collection<T>;
type CollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
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
declare function createCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U) => T): Collection<T>;
declare function createCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U, abort: AbortSignal) => Promise<T>): Collection<T>;
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
export { createCollection, isCollection, isCollectionSource, type Collection, type CollectionCallback, type CollectionSource, };
