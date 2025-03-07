import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T extends {}> = State<T> | Computed<T>;
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T | Promise<T>);
type OkCallback<T, U extends Signal<{}>[]> = (...values: {
    [K in keyof U]: U[K] extends Signal<infer T> ? T : never;
}) => T | Promise<T> | Error;
type NilCallback<T> = () => T | Promise<T> | Error;
type ErrCallback<T> = (...errors: Error[]) => T | Promise<T> | Error;
type ComputedCallbacks<T extends {}, U extends Signal<{}>[]> = OkCallback<T, U> | {
    ok: OkCallback<T, U>;
    nil?: NilCallback<T>;
    err?: ErrCallback<T>;
};
type EffectCallbacks<U extends Signal<{}>[]> = OkCallback<void, U> | {
    ok: OkCallback<void, U>;
    nil?: NilCallback<void>;
    err?: ErrCallback<void>;
};
type CallbackReturnType<T> = T | Promise<T> | Error | void;
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
 * Check if the provided value is a callback or callbacks object of { ok, nil?, err? } that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.4
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
declare const isComputedCallbacks: <T extends {}>(value: unknown) => value is ComputedCallbacks<T, []>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @param memo
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T> | ComputedCallbacks<T, []>) => Signal<T>;
/**
 * Resolve signals or functions using signals and apply callbacks based on the results
 *
 * @since 0.12.0
 * @param {U} signals - dependency signals (or functions using signals)
 * @param {Record<string, (...args) => CallbackReturnType<T>} cb - object of ok, nil, err callbacks or just ok callback
 * @returns {CallbackReturnType<T>} - result of chosen callback
 */
declare const resolve: <T, U extends Signal<{}>[]>(signals: U, cb: OkCallback<T | Promise<T>, U> | {
    ok: OkCallback<T | Promise<T>, U>;
    nil?: NilCallback<T>;
    err?: ErrCallback<T>;
}) => CallbackReturnType<T>;
export { type Signal, type MaybeSignal, type EffectCallbacks, type ComputedCallbacks, type CallbackReturnType, UNSET, isSignal, isComputedCallbacks, toSignal, resolve, };
