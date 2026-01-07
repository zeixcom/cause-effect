import { type UnknownArray } from '../src/diff';
import { type MutableSignal } from '../src/signal';
import { type Collection, type CollectionCallback } from './collection';
type ArrayToRecord<T extends UnknownArray> = {
    [key: string]: T extends Array<infer U extends {}> ? U : never;
};
type KeyConfig<T> = string | ((item: T) => string);
type List<T extends {}> = {
    readonly [Symbol.toStringTag]: 'List';
    [Symbol.iterator](): IterableIterator<MutableSignal<T>>;
    readonly [Symbol.isConcatSpreadable]: boolean;
    [n: number]: MutableSignal<T>;
    readonly length: number;
    add(value: T): string;
    byKey(key: string): MutableSignal<T> | undefined;
    deriveCollection<U extends {}>(callback: CollectionCallback<U, T extends UnknownArray ? T : never>): Collection<U>;
    get(): T;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T>(compareFn?: (a: U, b: U) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    remove(index: number): void;
};
declare const TYPE_LIST: "List";
/**
 * Create a new list with deeply nested reactive list items
 *
 * @since 0.16.2
 * @param {T} initialValue - Initial array of the list
 * @param {KeyConfig<T>} keyConfig - Optional key configuration:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {List<T>} - New list with reactive items of type T
 */
declare const createList: <T extends {}>(initialValue: T[], keyConfig?: KeyConfig<T>) => List<T>;
/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a List instance, false otherwise
 */
declare const isList: <T extends {}>(value: unknown) => value is List<T>;
export { TYPE_LIST, isList, createList, type ArrayToRecord, type List, type KeyConfig, };
