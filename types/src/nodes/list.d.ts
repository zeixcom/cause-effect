import { type Cleanup } from '../graph';
import { type Collection } from './collection';
import { type State } from './state';
type UnknownRecord = Record<string, unknown>;
type DiffResult = {
    changed: boolean;
    add: UnknownRecord;
    change: UnknownRecord;
    remove: UnknownRecord;
};
type KeyConfig<T> = string | ((item: T) => string);
type ListOptions<T extends {}> = {
    keyConfig?: KeyConfig<T>;
    watched?: () => Cleanup;
};
type List<T extends {}> = {
    readonly [Symbol.toStringTag]: 'List';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<State<T>>;
    readonly length: number;
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
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>;
};
declare const TYPE_LIST: "List";
/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
declare const isEqual: <T>(a: T, b: T, visited?: WeakSet<object>) => boolean;
declare const createList: <T extends {}>(initialValue: T[], options?: ListOptions<T>) => List<T>;
declare const isList: <T extends {}>(value: unknown) => value is List<T>;
export { type DiffResult, type KeyConfig, type List, type ListOptions, type UnknownRecord, createList, isEqual, isList, TYPE_LIST, };
