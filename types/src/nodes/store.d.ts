import { type Cleanup } from '../graph';
import { type List, type UnknownRecord } from './list';
import { type State } from './state';
type StoreOptions = {
    watched?: () => Cleanup;
};
type BaseStore<T extends UnknownRecord> = {
    readonly [Symbol.toStringTag]: 'Store';
    readonly [Symbol.isConcatSpreadable]: false;
    [Symbol.iterator](): IterableIterator<[string, State<T[keyof T] & {}>]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
    get(): T;
    set(newValue: T): void;
    update(fn: (oldValue: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
};
type Store<T extends UnknownRecord> = BaseStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
};
declare const TYPE_STORE: "Store";
declare const createStore: <T extends UnknownRecord>(initialValue: T, options?: StoreOptions) => Store<T>;
declare const isStore: <T extends UnknownRecord>(value: unknown) => value is Store<T>;
export { createStore, isStore, type Store, type StoreOptions, TYPE_STORE };
