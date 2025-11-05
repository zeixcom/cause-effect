import { type Computed, type ComputedCallback } from './computed';
import { type State } from './state';
import { type Store } from './store';
type Signal<T extends {}> = {
    get(): T;
};
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
type UnknownSignalRecord = Record<string, Signal<unknown & {}>>;
type SignalValues<S extends UnknownSignalRecord> = {
    [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
};
declare const UNSET: any;
/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: unknown) => value is Signal<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {T} value - value to convert
 * @returns {Signal<T>} - Signal instance
 */
declare function toSignal<T extends {}>(value: T[]): Store<Record<string, T>>;
declare function toSignal<T extends {}>(value: (() => T) | ((abort: AbortSignal) => Promise<T>)): Computed<T>;
declare function toSignal<T extends {}>(value: T): T extends Store<infer U> ? Store<U> : T extends State<infer U> ? State<U> : T extends Computed<infer U> ? Computed<U> : T extends Signal<infer U> ? Signal<U> : T extends Record<string, unknown & {}> ? Store<{
    [K in keyof T]: T[K];
}> : State<T>;
/**
 * Convert a value to a mutable Signal if it's not already a Signal
 *
 * @since 0.15.0
 * @param {T} value - value to convert
 * @returns {State<T> | Store<T>} - Signal instance
 */
declare function toMutableSignal<T extends {}>(value: T[]): Store<Record<string, T>>;
declare function toMutableSignal<T extends {}>(value: T): T extends Store<infer U> ? Store<U> : T extends State<infer U> ? State<U> : T extends Record<string, unknown & {}> ? Store<{
    [K in keyof T]: T[K];
}> : State<T>;
export { type Signal, type MaybeSignal, type UnknownSignalRecord, type SignalValues, UNSET, isSignal, toSignal, toMutableSignal, };
