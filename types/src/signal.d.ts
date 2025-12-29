import { type Computed, Memo, Task } from './classes/computed';
import { type List } from './classes/list';
import { State } from './classes/state';
import { type Store } from './classes/store';
import type { Collection } from './signals/collection';
type Signal<T extends {}> = {
    get(): T;
};
type MutableSignal<T extends {}> = State<T> | Store<T> | List<T>;
type ReadonlySignal<T extends {}> = Computed<T> | Collection<T>;
type UnknownSignalRecord = Record<string, Signal<unknown & {}>>;
type SignalValues<S extends UnknownSignalRecord> = {
    [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
};
/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: unknown) => value is Signal<T>;
/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a State, Store, or List, false otherwise
 */
declare const isMutableSignal: <T extends {}>(value: unknown) => value is MutableSignal<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {T} value - value to convert
 */
declare const createSignal: <T extends {}>(value: T) => List<any> | State<never> | Memo<{
    then?: undefined;
}> | Task<{}> | Store<T>;
declare const createMutableSignal: <T extends {}>(value: T) => List<any> | Store<T> | State<never>;
export { createMutableSignal, createSignal, isMutableSignal, isSignal, type MutableSignal, type ReadonlySignal, type Signal, type SignalValues, type UnknownSignalRecord, };
