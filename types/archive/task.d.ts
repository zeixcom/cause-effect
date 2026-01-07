type Task<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Task';
    get(): T;
};
type TaskCallback<T extends {} & {
    then?: undefined;
}> = (oldValue: T, abort: AbortSignal) => Promise<T>;
declare const TYPE_TASK: "Task";
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {TaskCallback<T>} callback - Computation callback function
 * @returns {Task<T>} - Computed signal
 */
declare const createTask: <T extends {}>(callback: TaskCallback<T>, initialValue?: T) => Task<T>;
/**
 * Check if a value is a task signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a task signal, false otherwise
 */
declare const isTask: <T extends {}>(value: unknown) => value is Task<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
declare const isTaskCallback: <T extends {}>(value: unknown) => value is TaskCallback<T>;
export { TYPE_TASK, createTask, isTask, isTaskCallback, type Task, type TaskCallback, };
