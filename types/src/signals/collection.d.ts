import { type Computed } from './computed';
import type { UnknownArray } from '../diff';
import type { List } from './list';
import { type Cleanup, type Listener, type Notifications } from '../system';
type CollectionKeySignal<T extends {}> = T extends UnknownArray ? Collection<T> : Computed<T>;
type CollectionCallback<T extends {} & {
    then?: undefined;
}, O extends {}> = ((originValue: O, abort: AbortSignal) => Promise<T>) | ((originValue: O) => T);
type Collection<T extends {}> = {
    readonly [Symbol.toStringTag]: typeof TYPE_COLLECTION;
    readonly [Symbol.isConcatSpreadable]: boolean;
    [Symbol.iterator](): IterableIterator<CollectionKeySignal<T>>;
    readonly [n: number]: CollectionKeySignal<T>;
    readonly length: number;
    byKey(key: string): CollectionKeySignal<T> | undefined;
    get(): T[];
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup;
    sort(compareFn?: (a: T, b: T) => number): void;
};
declare const TYPE_COLLECTION: "Collection";
/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.16.2
 * @param {List<O> | Collection<O>} origin - Origin of collection to derive values from
 * @param {ComputedCallback<ArrayItem<T>>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
declare const createCollection: <T extends {}, O extends {}>(origin: List<O> | Collection<O>, callback: CollectionCallback<T, O>) => Collection<T>;
declare const isCollection: <T extends UnknownArray>(value: unknown) => value is Collection<T>;
export { type Collection, type CollectionCallback, createCollection, isCollection, TYPE_COLLECTION, };
