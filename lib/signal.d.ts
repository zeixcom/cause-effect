import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T extends {}> = State<T> | Computed<T>;
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T) | ((abort: AbortSignal) => Promise<T>);
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
declare const isComputedCallback: <T extends {}>(value: unknown) => value is (abort?: AbortSignal) => T | Promise<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T>) => Signal<T>;
/**
 * Resolve signals or functions using signals and apply callbacks based on the results
 *
 * @since 0.13.0
 * @param {SignalMatcher<S, R>} matcher - SignalMatcher to match
 * @returns {R | Promise<R>} - result of the matched callback
 */
declare const match: <S extends Signal<{}>[], R>(matcher: {
    signals: S;
    abort?: AbortSignal;
    ok: ((...values: { [K in keyof S]: S[K] extends Signal<infer T> ? T : never; }) => R | Promise<R>);
    err: ((...errors: Error[]) => R | Promise<R>);
    nil: (abort?: AbortSignal) => R | Promise<R>;
}) => R | Promise<R>;
export { type Signal, type MaybeSignal, UNSET, isSignal, isComputedCallback, toSignal, match, };
