import { type Signal } from './signal';
import { type TapMatcher } from './effect';
export type MapMatcher<T extends {}, U extends {}> = {
    ok: (value: T) => U | Promise<U>;
    err?: (error: Error) => U | Promise<U>;
    nil?: () => U | Promise<U>;
};
export type ComputedMatcher<S extends Signal<{}>[], U extends {}> = {
    signals: S;
    ok: (...values: {
        [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
    }) => U | Promise<U>;
    err?: (...errors: Error[]) => U | Promise<U>;
    nil?: () => U | Promise<U>;
};
export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get(): T;
    map<U extends {}>(matcher: MapMatcher<T, U> | ((v: T) => U)): Computed<U>;
    tap(matcher: TapMatcher<T> | ((v: T) => void | (() => void))): () => void;
};
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedMatcher<S, T> | (() => T | Promise<T>)} matcher - computed matcher or callback
 * @returns {Computed<T>} - Computed signal
 */
export declare const computed: <T extends {}, S extends Signal<{}>[] = []>(matcher: ComputedMatcher<S, T> | (() => T | Promise<T>)) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
