import { type Signal } from './signal';
import { type State } from './state';
declare const TYPE_STORE = "Store";
interface StoreAddEvent<T extends Record<string, unknown & {}>> extends CustomEvent {
    type: 'store-add';
    detail: Partial<T>;
}
interface StoreChangeEvent<T extends Record<string, unknown & {}>> extends CustomEvent {
    type: 'store-change';
    detail: Partial<T>;
}
interface StoreRemoveEvent<T extends Record<string, unknown & {}>> extends CustomEvent {
    type: 'store-remove';
    detail: Partial<T>;
}
type StoreEventMap<T extends Record<string, unknown & {}>> = {
    'store-add': StoreAddEvent<T>;
    'store-change': StoreChangeEvent<T>;
    'store-remove': StoreRemoveEvent<T>;
};
interface StoreEventTarget<T extends Record<string, unknown & {}>> extends EventTarget {
    addEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof StoreEventMap<T>>(type: K, listener: (event: StoreEventMap<T>[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
}
type Store<T extends Record<string, unknown & {}> = Record<string, unknown & {}>> = {
    [K in keyof T]: T[K] extends Record<string, unknown & {}> ? Store<T[K]> : State<T[K]>;
} & StoreEventTarget<T> & {
    [Symbol.toStringTag]: 'Store';
    [Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T]>]>;
    get(): T;
    set(value: T): void;
    update(updater: (value: T) => T): void;
    size: State<number>;
};
/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object value of the store
 * @returns {Store<T>} - new store with reactive properties
 */
declare const store: <T extends Record<string, unknown & {}>>(initialValue: T) => Store<T>;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
declare const isStore: <T extends Record<string, unknown & {}>>(value: unknown) => value is Store<T>;
export { TYPE_STORE, isStore, store, type Store, type StoreAddEvent, type StoreChangeEvent, type StoreRemoveEvent, type StoreEventMap, };
