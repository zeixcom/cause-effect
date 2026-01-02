import { type Cleanup, type Listener, type Listeners } from '../system';
import { type Computed } from './computed';
import { type List } from './list';
type CollectionSource<T extends {}> = List<T> | Collection<T, any>;
type CollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
declare const TYPE_COLLECTION: "Collection";
declare class Collection<T extends {}, U extends {}> {
    #private;
    constructor(source: CollectionSource<U> | (() => CollectionSource<U>), callback: CollectionCallback<T, U>);
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
 * Check if a value is a collection signal
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
declare const isCollection: <T extends {}, U extends {}>(value: unknown) => value is Collection<T, U>;
export { Collection, type CollectionSource, type CollectionCallback, isCollection, TYPE_COLLECTION, };
