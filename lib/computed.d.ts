export interface Computed<T> {
    map: <U>(fn: (value: T) => U) => Computed<U>;
}
/**
 * Create a derived state from existing states
 *
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export declare class Computed<T> {
    private fn;
    private watchers;
    private value;
    private error;
    private stale;
    private memo;
    private constructor();
    static of: <T_1>(fn: () => T_1 | Promise<T_1>, memo?: boolean) => Computed<T_1>;
    static isComputed: <T_1>(value: unknown) => value is Computed<T_1>;
    get(): T;
}
