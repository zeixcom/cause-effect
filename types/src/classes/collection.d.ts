import type { Signal } from '../signal';
import { type Cleanup, type Hook, type HookCallback } from '../system';
import { type Computed } from './computed';
import { type List } from './list';
type CollectionSource<T extends {}> = List<T> | Collection<T>;
type CollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
type Collection<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Collection';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<Signal<T>>;
    keys(): IterableIterator<string>;
    get: () => T[];
    at: (index: number) => Signal<T> | undefined;
    byKey: (key: string) => Signal<T> | undefined;
    keyAt: (index: number) => string | undefined;
    indexOfKey: (key: string) => number | undefined;
    on: <K extends Hook>(type: K, callback: HookCallback) => Cleanup;
    deriveCollection: <R extends {}>(callback: CollectionCallback<R, T>) => DerivedCollection<R, T>;
    readonly length: number;
};
declare const TYPE_COLLECTION: "Collection";
declare class DerivedCollection<T extends {}, U extends {}> implements Collection<T> {
    #private;
    constructor(source: CollectionSource<U> | (() => CollectionSource<U>), callback: CollectionCallback<T, U>);
    get [Symbol.toStringTag](): 'Collection';
    get [Symbol.isConcatSpreadable](): true;
    [Symbol.iterator](): IterableIterator<Computed<T>>;
    keys(): IterableIterator<string>;
    get(): T[];
    at(index: number): Computed<T> | undefined;
    byKey(key: string): Computed<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    on(type: Hook, callback: HookCallback): Cleanup;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): DerivedCollection<R, T>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): DerivedCollection<R, T>;
    get length(): number;
}
/**
 * Check if a value is a collection signal
 *
 * @since 0.17.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
declare const isCollection: <T extends {}>(value: unknown) => value is Collection<T>;
export { type Collection, type CollectionSource, type CollectionCallback, DerivedCollection, isCollection, TYPE_COLLECTION, };
