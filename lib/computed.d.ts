import { type TapMatcher } from './effect';
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
 * @param {() => T | Promise<T>} fn - computed callback
 * @returns {Computed<T>} - Computed signal
 */
export declare const computed: <T extends {}>(fn: () => T | Promise<T>) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
