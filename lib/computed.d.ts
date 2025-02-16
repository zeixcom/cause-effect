export type Computed<T> = {
    [Symbol.toStringTag]: "Computed";
    get: () => T;
    map: <U extends {}>(fn: (value: T) => U) => Computed<U>;
};
/**
 * Create a derived state from existing states
 *
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export declare const computed: <T extends {}>(fn: (v?: T) => T | Promise<T>, memo?: boolean) => Computed<T>;
/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export declare const isComputed: <T>(value: unknown) => value is Computed<T>;
