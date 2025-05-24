import { type Computed } from './computed';
/**
 * Callback for async computation tasks
 * This explicitly returns a Promise<T> to differentiate from MemoCallback
 *
 * @since 0.14.0
 */
type TaskCallback<T extends {}> = (abort: AbortSignal) => Promise<T>;
/**
 * Create a derived signal that supports asynchronous computations
 *
 * @since 0.14.0
 * @param {TaskCallback<T>} fn - async computation callback
 * @returns {Computed<T>} - Computed signal
 */
declare const task: <T extends {}>(fn: TaskCallback<T>) => Computed<T>;
export { type TaskCallback, task };
