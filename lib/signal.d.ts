import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T extends {}> = State<T> | Computed<T>;
type UnknownSignal = Signal<{}>;
type MaybeSignal<T extends {}> = Signal<T> | T | (() => T);
type SignalValue<T> = T extends Signal<infer U> ? U : never;
export declare const UNSET: any;
/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {any} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: any) => value is Signal<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @param memo
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T>) => Signal<T>;
/**
 * Resolve signals and apply callbacks based on the results
 *
 * @since 0.12.0
 * @param {U} signals - dependency signals
 * @param {Record<string, (...args) => T | Promise<T> | Error | void>} callbacks - ok, nil, err callbacks
 * @returns {T | Promise<T> | Error | void} - result of chosen callback
 */
declare const resolveSignals: <T extends {}, U extends UnknownSignal[]>(signals: U, callbacks: {
    ok: (...values: { [K in keyof U]: SignalValue<U[K]>; }) => T | Promise<T> | Error | void;
    nil?: () => T | Promise<T> | Error | void;
    err?: (...errors: Error[]) => T | Promise<T> | Error | void;
}) => T | Promise<T> | Error | void;
export { type Signal, type UnknownSignal, type SignalValue, type MaybeSignal, isSignal, toSignal, resolveSignals, };
