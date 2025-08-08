import { type ComputedCallback, isComputedCallback } from './computed';
type Signal<T extends {}> = {
    get(): T;
};
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
type SignalValues<S extends Signal<unknown & {}>[]> = {
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
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T>) => Signal<T>;
export { type Signal, type MaybeSignal, type SignalValues, UNSET, isSignal, isComputedCallback, toSignal, };
