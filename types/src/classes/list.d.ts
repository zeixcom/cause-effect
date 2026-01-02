import { type UnknownArray } from '../diff';
import { type Cleanup, type Listener, type Notifications } from '../system';
import { Collection } from './collection';
import { State } from './state';
type ArrayToRecord<T extends UnknownArray> = {
    [key: string]: T extends Array<infer U extends {}> ? U : never;
};
type KeyConfig<T> = string | ((item: T) => string);
declare const TYPE_LIST: "List";
declare class List<T extends {}> {
    #private;
    constructor(initialValue: T[], keyConfig?: KeyConfig<T>);
    get [Symbol.toStringTag](): 'List';
    get [Symbol.isConcatSpreadable](): boolean;
    [Symbol.iterator](): IterableIterator<State<T>>;
    get length(): number;
    get(): T[];
    set(newValue: T[]): void;
    update(fn: (oldValue: T[]) => T[]): void;
    at(index: number): State<T> | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): State<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R, T>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R, T>;
}
/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a List instance, false otherwise
 */
declare const isList: <T extends {}>(value: unknown) => value is List<T>;
export { isList, List, TYPE_LIST, type ArrayToRecord, type KeyConfig };
