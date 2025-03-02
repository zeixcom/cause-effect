import { type SignalValue, type UnknownSignal } from './signal';
import { type EffectCallbacks } from './effect';
export type ComputedOkCallback<T extends {}, U extends UnknownSignal[]> = (...values: {
    [K in keyof U]: SignalValue<U[K]>;
}) => T | Promise<T>;
export type ComputedCallbacks<T extends {}, U extends UnknownSignal[]> = {
    ok: ComputedOkCallback<T, U>;
    nil?: () => T | Promise<T>;
    err?: (...errors: Error[]) => T | Promise<T>;
};
export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get: () => T;
    map: <U extends {}>(fn: (value: T) => U) => Computed<U>;
    match: (callbacks: EffectCallbacks<[Computed<T>]>) => void;
};
/**
 * Create a derived state from existing states
 *
 * @since 0.9.0
 * @param {() => T} callbacksOrFn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export declare const computed: <T extends {}, U extends UnknownSignal[]>(callbacksOrFn: ComputedCallbacks<T, U> | ComputedOkCallback<T, U>, ...signals: U) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
