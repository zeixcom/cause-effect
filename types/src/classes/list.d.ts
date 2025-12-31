import { type UnknownArray, type UnknownRecord } from '../diff';
import type { MutableSignal } from '../signal';
import { type Cleanup, type Listener, type Notifications } from '../system';
import { type Collection, type CollectionCallback } from './collection';
import type { State } from './state';
import type { Store } from './store';
type ArrayToRecord<T extends UnknownArray> = {
    [key: string]: T extends Array<infer U extends {}> ? U : never;
};
type KeyConfig<T> = string | ((item: T) => string);
type List<T extends {}> = BaseList<T> & {
    [n: number]: T extends readonly (infer U extends {})[] ? List<U> : T extends UnknownRecord ? Store<T> : State<T>;
};
declare const TYPE_LIST: "List";
declare class BaseList<T extends {}> {
    #private;
    constructor(initialValue: T[], keyConfig?: KeyConfig<T>);
    get [Symbol.toStringTag](): 'List';
    get [Symbol.isConcatSpreadable](): boolean;
    [Symbol.iterator](): IterableIterator<MutableSignal<T>>;
    get length(): number;
    get(): T[];
    set(newValue: T[]): void;
    update(fn: (oldValue: T[]) => T[]): void;
    at(index: number): MutableSignal<T> | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): MutableSignal<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup;
    deriveCollection<U extends {}>(callback: CollectionCallback<U, T>): Collection<U, T>;
}
/**
 * Create a new list with deeply nested reactive list items
 *
 * @since 0.16.2
 * @param {T[]} initialValue - Initial array of the list
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
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a List instance, false otherwise
 */
declare const isList: <T extends {}>(value: unknown) => value is List<T>;
export { createList, isList, BaseList, TYPE_LIST, type ArrayToRecord, type KeyConfig, type List, };
