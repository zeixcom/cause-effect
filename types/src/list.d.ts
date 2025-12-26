import { type Collection, type CollectionCallback } from './collection';
import { type UnknownArray, type UnknownRecord } from './diff';
import { type State } from './state';
import { type Store } from './store';
import { type Cleanup, type Listener, type Notifications } from './system';
type ArrayToRecord<T extends UnknownArray> = {
    [key: string]: T extends Array<infer U extends {}> ? U : never;
};
type ListItemSignal<T extends {}> = T extends readonly (infer U extends {})[] ? List<U> : T extends UnknownRecord ? Store<T> : State<T>;
type KeyConfig<T> = string | ((item: T) => string);
type List<T extends {}> = {
    readonly [Symbol.toStringTag]: 'List';
    [Symbol.iterator](): IterableIterator<ListItemSignal<T>>;
    readonly [Symbol.isConcatSpreadable]: boolean;
    [n: number]: ListItemSignal<T>;
    readonly length: number;
    add(value: T): string;
    byKey(key: string): ListItemSignal<T> | undefined;
    deriveCollection<U extends {}>(callback: CollectionCallback<U, T extends UnknownArray ? T : never>): Collection<U>;
    get(): T;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T>(compareFn?: (a: U, b: U) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup;
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
