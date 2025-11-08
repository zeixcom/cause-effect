import { type UnknownArray, type UnknownRecord, type UnknownRecordOrArray } from './diff';
import { type State } from './state';
type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never;
type StoreEventMap<T extends UnknownRecord | UnknownArray> = {
    'store-add': StoreAddEvent<T>;
    'store-change': StoreChangeEvent<T>;
    'store-remove': StoreRemoveEvent<T>;
    'store-sort': StoreSortEvent;
};
interface StoreEventTarget<T extends UnknownRecord | UnknownArray> extends EventTarget {
    addEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | EventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
}
interface BaseStore<T extends UnknownRecord | UnknownArray> extends StoreEventTarget<T> {
    readonly [Symbol.toStringTag]: 'Store';
    get(): T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    sort<U = T extends UnknownArray ? ArrayItem<T> : T[Extract<keyof T, string>]>(compareFn?: (a: U, b: U) => number): void;
    readonly size: State<number>;
}
type RecordStore<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly unknown[] | Record<string, unknown> ? Store<T[K]> : State<T[K]>;
} & {
    add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void;
    remove<K extends Extract<keyof T, string>>(key: K): void;
    [Symbol.iterator](): IterableIterator<[
        Extract<keyof T, string>,
        T[Extract<keyof T, string>] extends readonly unknown[] | Record<string, unknown> ? Store<T[Extract<keyof T, string>]> : State<T[Extract<keyof T, string>]>
    ]>;
};
type ArrayStore<T extends UnknownArray> = BaseStore<T> & {
    readonly length: number;
    [n: number]: ArrayItem<T> extends readonly unknown[] | Record<string, unknown> ? Store<ArrayItem<T>> : State<ArrayItem<T>>;
    add(value: ArrayItem<T>): void;
    remove(index: number): void;
    [Symbol.iterator](): IterableIterator<ArrayItem<T> extends readonly unknown[] | Record<string, unknown> ? Store<ArrayItem<T>> : State<ArrayItem<T>>>;
    readonly [Symbol.isConcatSpreadable]: boolean;
};
interface StoreAddEvent<T extends UnknownRecord | UnknownArray> extends CustomEvent {
    type: 'store-add';
    detail: Partial<T>;
}
interface StoreChangeEvent<T extends UnknownRecord | UnknownArray> extends CustomEvent {
    type: 'store-change';
    detail: Partial<T>;
}
interface StoreRemoveEvent<T extends UnknownRecord | UnknownArray> extends CustomEvent {
    type: 'store-remove';
    detail: Partial<T>;
}
interface StoreSortEvent extends CustomEvent {
    type: 'store-sort';
    detail: string[];
}
type Store<T> = T extends UnknownRecord ? RecordStore<T> : T extends UnknownArray ? ArrayStore<T> : never;
declare const TYPE_STORE = "Store";
/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
declare const store: <T extends UnknownRecord | UnknownArray>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecordOrArray>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, store, type Store, type StoreAddEvent, type StoreChangeEvent, type StoreRemoveEvent, type StoreSortEvent, type StoreEventMap, };
