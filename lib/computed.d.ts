type ComputedValue<T> = T | undefined | Error;
/**
 * Create a derived state from existing states
 *
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export declare class Computed<T> {
    private fn;
    private sinks;
    private value;
    private error;
    private stale;
    private memo;
    private async;
    private constructor();
    static of<T>(fn: () => ComputedValue<T> | Promise<ComputedValue<T>>, memo?: boolean): Computed<T>;
    static isComputed: <T_1>(value: unknown) => value is Computed<T_1>;
    get(): T | undefined | void;
}
export {};
