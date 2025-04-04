import { type Signal, type ComputedCallback } from './signal';
import { type TapMatcher } from './effect';
export type ComputedMatcher<S extends Signal<{}>[], R extends {}> = {
    signals: S;
    abort?: AbortSignal;
    ok: (...values: {
        [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
    }) => R | Promise<R>;
    err?: (...errors: Error[]) => R | Promise<R>;
    nil?: () => R | Promise<R>;
};
export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed';
    get(): T;
    map<U extends {}>(fn: (v: T) => U | Promise<U>): Computed<U>;
    tap(matcher: TapMatcher<T> | ((v: T) => void | (() => void))): () => void;
};
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedMatcher<S, T> | ComputedCallback<T>} matcher - computed matcher or callback
 * @returns {Computed<T>} - Computed signal
 */
export declare const computed: <T extends {}, S extends Signal<{}>[] = []>(matcher: ComputedMatcher<S, T> | ComputedCallback<T>) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
