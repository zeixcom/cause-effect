type Computed<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Computed';
    get(): T;
};
type ComputedCallback<T extends {} & {
    then?: undefined;
}> = ((oldValue: T, abort: AbortSignal) => Promise<T>) | ((oldValue: T) => T);
declare const TYPE_COMPUTED: "Computed";
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} callback - Computation callback function
 * @returns {Computed<T>} - Computed signal
 */
declare const createComputed: <T extends {}>(callback: ComputedCallback<T>, initialValue?: T) => Computed<T>;
/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a computed signal, false otherwise
 */
declare const isComputed: <T extends {}>(value: unknown) => value is Computed<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
declare const isComputedCallback: <T extends {}>(value: unknown) => value is ComputedCallback<T>;
export { TYPE_COMPUTED, createComputed, isComputed, isComputedCallback, type Computed, type ComputedCallback, };
