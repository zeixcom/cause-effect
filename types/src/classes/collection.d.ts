import { type Cleanup, type Listener, type Listeners } from '../system';
import { type Computed } from './computed';
import type { BaseList, List } from './list';
type CollectionSource<T extends {}> = List<T> | BaseList<T> | Collection<T, unknown & {}> | BaseCollection<T, unknown & {}>;
type CollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
type Collection<T extends {}, U extends {}> = BaseCollection<T, U> & {
    [n: number]: Computed<T>;
};
declare const TYPE_COLLECTION: "Collection";
declare class BaseCollection<T extends {}, U extends {}> {
    #private;
    constructor(source: CollectionSource<U>, callback: CollectionCallback<T, U>);
    get [Symbol.toStringTag](): 'Collection';
    get [Symbol.isConcatSpreadable](): boolean;
    [Symbol.iterator](): IterableIterator<Computed<T>>;
    get length(): number;
    get(): T[];
    at(index: number): Computed<T> | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): Computed<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    on<K extends keyof Listeners>(type: K, listener: Listener<K>): Cleanup;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R, T>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R, T>;
}
/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.17.0
 * @param {CollectionSource<U>} source - Source of collection to derive values from
 * @param {CollectionCallback<T, U>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
declare function createCollection<T extends {}, U extends {}>(source: CollectionSource<U> | (() => CollectionSource<U>), callback: (sourceValue: U) => T): Collection<T, U>;
declare function createCollection<T extends {}, U extends {}>(source: CollectionSource<U> | (() => CollectionSource<U>), callback: (sourceValue: U, abort: AbortSignal) => Promise<T>): Collection<T, U>;
/**
 * Check if a value is a collection signal
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
declare const isCollection: <T extends {}, U extends {}>(value: unknown) => value is Collection<T, U>;
export { type Collection, type CollectionSource, type CollectionCallback, createCollection, isCollection, TYPE_COLLECTION, };
