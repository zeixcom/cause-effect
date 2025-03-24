import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T extends {}> = State<T> | Computed<T>;
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T | Promise<T>);
declare const UNSET: any;
/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: any) => value is Signal<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
declare const isComputedCallback: <T extends {}>(value: unknown) => value is (() => T | Promise<T>);
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T>) => Signal<T>;
export { type Signal, type MaybeSignal, UNSET, isSignal, isComputedCallback, toSignal, };
