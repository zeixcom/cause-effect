import type { Signal } from './signal';
import type { Cleanup } from './scheduler';
import type { TapMatcher } from './effect';
import { type MemoCallback } from './memo';
import { type TaskCallback } from './task';
type MaybePromise<T extends {}> = (T & {
    then?: void;
}) | Promise<T>;
type MapCallback<T, U extends {} & {
    then?: void;
}> = (v: T) => MaybePromise<U>;
type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get(): T;
    map<U extends {}>(mapFn: MapCallback<T, U>): Computed<U>;
    tap(matcher: TapMatcher<T> | ((v: T) => void | Cleanup)): Cleanup;
};
type ComputedCallback<T extends {} & {
    then?: void;
}> = TaskCallback<T> | MemoCallback<T>;
declare const TYPE_COMPUTED = "Computed";
/**
 * Create a derived signal from existing signals
 *
 * This function delegates to either memo() for synchronous computations
 * or task() for asynchronous computations, providing better performance
 * for each case.
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} fn - computation callback function
 * @returns {Computed<T>} - Computed signal
 */
declare const computed: <T extends {}>(fn: ComputedCallback<T>) => Computed<T>;
/**
 * Creates a computed signal based on a map function's internal signal
 *
 * @since 0.14.0
 * @param {Signal<T>} signal - input signal
 * @param {MapCallback<T, U>} fn - map callback function
 * @returns {Computed<U>} - Computed signal with appropriate type
 */
declare const toComputed: <T extends {}, U extends {}>(signal: Signal<T>, fn: MapCallback<T, U>) => Computed<U>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
export { type Computed, type ComputedCallback, type MapCallback, TYPE_COMPUTED, computed, toComputed, isComputed, };
