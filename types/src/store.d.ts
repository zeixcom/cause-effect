import { type UnknownRecord, type UnknownRecordOrArray } from './diff';
import { type Signal } from './signal';
import { type State } from './state';
declare const TYPE_STORE = "Store";
interface StoreAddEvent<T extends UnknownRecordOrArray> extends CustomEvent {
    type: 'store-add';
    detail: Partial<T>;
}
interface StoreChangeEvent<T extends UnknownRecordOrArray> extends CustomEvent {
    type: 'store-change';
    detail: Partial<T>;
}
interface StoreRemoveEvent<T extends UnknownRecordOrArray> extends CustomEvent {
    type: 'store-remove';
    detail: Partial<T>;
}
type StoreEventMap<T extends UnknownRecordOrArray> = {
    'store-add': StoreAddEvent<T>;
    'store-change': StoreChangeEvent<T>;
    'store-remove': StoreRemoveEvent<T>;
};
interface StoreEventTarget<T extends UnknownRecordOrArray> extends EventTarget {
    addEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
}
type UnknownArray = {
    [x: number]: unknown & {};
};
type ArrayToRecord<T extends UnknownArray> = {
    [K in keyof T as K extends `${number}` ? K : never]: T[K];
};
type Store<T extends {
    [x: string | number]: unknown & {};
} = UnknownRecord> = (T extends UnknownArray ? {
    [K in keyof ArrayToRecord<T>]: ArrayToRecord<T>[K] extends UnknownRecord ? Store<ArrayToRecord<T>[K]> : State<ArrayToRecord<T>[K]>;
} : {
    [K in keyof T]: T[K] extends UnknownRecord ? Store<T[K]> : State<T[K]>;
}) & StoreEventTarget<T> & {
    [Symbol.toStringTag]: 'Store';
    [Symbol.iterator](): IterableIterator<[keyof T, Signal<T[keyof T]>]>;
    add<K extends keyof T>(key: K, value: T[K]): void;
    get(): T;
    remove<K extends keyof T>(key: K): void;
    set(value: T): void;
    update(updater: (value: T) => T): void;
    size: State<number>;
};
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
declare function store<T extends {
    [x: string | number]: unknown & {};
}>(initialValue: T): Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends UnknownRecordOrArray>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, store, type Store, type StoreAddEvent, type StoreChangeEvent, type StoreRemoveEvent, type StoreEventMap, };
