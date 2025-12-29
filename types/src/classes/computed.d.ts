type Computed<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Computed';
    get(): T;
};
type MemoCallback<T extends {} & {
    then?: undefined;
}> = (oldValue: T) => T;
type TaskCallback<T extends {} & {
    then?: undefined;
}> = (oldValue: T, abort: AbortSignal) => Promise<T>;
declare const TYPE_COMPUTED: "Computed";
/**
 * Create a new memoized signal for a synchronous function.
 *
 * @since 0.17.0
 */
declare class Memo<T extends {}> {
    #private;
    /**
     * Create a new memoized signal.
     *
     * @param {MemoCallback<T>} callback - Callback function to compute the memoized value
     * @param {T} [initialValue = UNSET] - Initial value of the signal
     * @throws {InvalidCallbackError} If the callback is not an sync function
     * @throws {InvalidSignalValueError} If the initial value is not valid
     */
    constructor(callback: MemoCallback<T>, initialValue?: T);
    get [Symbol.toStringTag](): string;
    /**
     * Return the memoized value after computing it if necessary.
     *
     * @returns {T}
     * @throws {CircularDependencyError} If a circular dependency is detected
     * @throws {Error} If an error occurs during computation
     */
    get(): T;
}
/**
 * Create a new task signals that memoizes the result of an asynchronous function.
 *
 * @since 0.17.0
 */
declare class Task<T extends {}> {
    #private;
    /**
     * Create a new task signal for an asynchronous function.
     *
     * @param {TaskCallback<T>} callback - The asynchronous function to compute the memoized value
     * @param {T} [initialValue = UNSET] - Initial value of the signal
     * @throws {InvalidCallbackError} If the callback is not an async function
     * @throws {InvalidSignalValueError} If the initial value is not valid
     */
    constructor(callback: TaskCallback<T>, initialValue?: T);
    get [Symbol.toStringTag](): string;
    /**
     * Return the memoized value after executing the async function if necessary.
     *
     * @returns {T}
     * @throws {CircularDependencyError} If a circular dependency is detected
     * @throws {Error} If an error occurs during computation
     */
    get(): T;
}
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T> | TaskCallback<T>} callback - Computation callback function
 */
declare const createComputed: <T extends {}>(callback: TaskCallback<T> | MemoCallback<T>, initialValue?: T) => Task<T> | Memo<T>;
/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a computed signal, false otherwise
 */
declare const isComputed: <T extends {}>(value: unknown) => value is Memo<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
declare const isMemoCallback: <T extends {} & {
    then?: undefined;
}>(value: unknown) => value is MemoCallback<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
declare const isTaskCallback: <T extends {}>(value: unknown) => value is TaskCallback<T>;
export { TYPE_COMPUTED, createComputed, isComputed, isMemoCallback, isTaskCallback, Memo, Task, type Computed, type MemoCallback, type TaskCallback, };
