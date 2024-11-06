export type Computed<T> = {
    [Symbol.toStringTag]: "Computed";
    get: () => T;
    map: <U>(fn: (value: T) => U) => Computed<U>;
};
/**
 * Create a derived state from existing states
 *
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export declare const computed: <T>(fn: () => T | Promise<T>, memo?: boolean) => Computed<T>;
export declare const isComputed: <T>(value: unknown) => value is Computed<T>;
