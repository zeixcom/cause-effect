import { type MemoCallback } from './memo';
import { type TaskCallback } from './task';
type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get(): T;
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
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
export { type Computed, type ComputedCallback, TYPE_COMPUTED, computed, isComputed, };
