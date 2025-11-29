import type { UnknownArray } from './diff';
import { type Store, type StoreChanges } from './store';
import { type Cleanup } from './system';
type Collection<T extends UnknownArray> = {
    readonly [Symbol.toStringTag]: 'Collection';
    get(): T;
    on<K extends keyof StoreChanges<T>>(type: K, listener: (change: StoreChanges<T>[K]) => void): Cleanup;
};
type CollectionCallback<T extends UnknownArray> = (store: Store<T>) => T;
declare const TYPE_COLLECTION = "Collection";
/**
 * Create a collection signal
 *
 * @param {CollectionCallback<T>} fn - callback function to create the collection
 * @returns {Collection<T>} - collection signal
 */
declare const createCollection: <T extends UnknownArray>(fn: CollectionCallback<T>) => Collection<T>;
/**
 * Check if a value is a collection signal
 *
 * @since 0.16.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
declare const isCollection: <T extends UnknownArray>(value: unknown) => value is Collection<T>;
export { TYPE_COLLECTION, createCollection, isCollection, type Collection };
