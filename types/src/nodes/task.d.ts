import { type ComputedOptions, type TaskCallback } from '../graph';
/**
 * An asynchronous reactive computation (colorless async).
 * Automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics and pending state tracking.
 *
 * @template T - The type of value resolved by the task
 */
type Task<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Task';
    /**
     * Gets the current value of the task.
     * Returns the last resolved value, even while a new computation is pending.
     * When called inside another reactive context, creates a dependency.
     * @returns The current value
     */
    get(): T;
    /**
     * Checks if the task is currently executing.
     * @returns True if a computation is in progress
     */
    isPending(): boolean;
    /**
     * Aborts the current computation if one is running.
     * The task's AbortSignal will be triggered.
     */
    abort(): void;
};
/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 *
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @returns A Task object with get(), isPending(), abort(), and stop() methods
 *
 * @example
 * ```ts
 * const userId = createState(1);
 * const user = createTask(async (prev, signal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal });
 *   return response.json();
 * });
 *
 * // When userId changes, the previous fetch is aborted
 * userId.set(2);
 * ```
 *
 * @example
 * ```ts
 * // Check pending state
 * if (user.isPending()) {
 *   console.log('Loading...');
 * }
 * ```
 */
declare const createTask: <T extends {}>(fn: TaskCallback<T>, options?: ComputedOptions<T>) => Task<T>;
/**
 * Checks if a value is a Task signal.
 *
 * @param value - The value to check
 * @returns True if the value is a Task
 *
 * @example
 * ```ts
 * const task = createTask(async () => 42, null);
 * if (isTask(task)) {
 *   task.abort(); // TypeScript knows task has abort()
 * }
 * ```
 */
declare const isTask: <T extends {} = {}>(value: unknown) => value is Task<T>;
export { createTask, isTask, type Task };
