import { type MaybeSignal, type EffectCallbacks, type ComputedCallbacks } from './signal';
export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get: () => T;
    map: <U extends {}>(cb: ComputedCallbacks<U, [Computed<T>]>) => Computed<U>;
    match: (cb: EffectCallbacks<[Computed<T>]>) => void;
};
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {() => T} cb - compute callback or object of ok, nil, err callbacks to derive state
 * @param {U} maybeSignals - signals of functions using signals this values depends on
 * @returns {Computed<T>} - Computed signal
 */
export declare const computed: <T extends {}, U extends MaybeSignal<{}>[]>(cb: ComputedCallbacks<T, U>, ...maybeSignals: U) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
