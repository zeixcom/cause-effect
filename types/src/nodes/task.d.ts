import { type ComputedOptions, type TaskCallback } from '../graph';
/**
 * An asynchronous reactive computation (colorless async).
 * Automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics and pending state tracking.
 *
 * @deprecated `Task` is removed in v2.0 with no mechanical replacement — origin is no longer
 * part of the consumption contract. Use `isSignal`/`isMutableSignal` or a plain property check
 * instead of matching on this type; use the graph-level `isPending`/`abort` functions instead of
 * the methods on this type. See [MIGRATION-2.0.md](../../MIGRATION-2.0.md) § Origin guards and
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md).
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
     * @throws UnsetSignalValueError If the task value is still unset when read.
     */
    get(): T;
    /**
     * Checks if the task is currently executing.
     * Used by `match()` to route to the `stale` handler when the task has a retained value.
     * @returns True if a computation is in progress
     */
    isPending(): boolean;
    /**
     * Aborts the current computation if one is running.
     * The task's AbortSignal aborts.
     */
    abort(): void;
};
/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 *
 * @since 0.18.0
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @param options.value - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the task is first watched by an effect.
 *   Receives an `invalidate` function to mark the task dirty and trigger re-execution.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Task object with get(), isPending(), and abort() methods
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
declare function createTask<T extends {}>(fn: (prev: T, signal: AbortSignal) => Promise<T>, options: ComputedOptions<T> & {
    value: T;
}): Task<T>;
declare function createTask<T extends {}>(fn: TaskCallback<T>, options?: ComputedOptions<T>): Task<T>;
/**
 * Checks if a value is a Task signal.
 *
 * @deprecated Removed in v2.0 with no mechanical replacement — use `isSignal`/`isMutableSignal`
 * or a plain property check instead. See [MIGRATION-2.0.md](../../MIGRATION-2.0.md) § Origin
 * guards.
 *
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Task
 */
declare function isTask<T extends {} = unknown & {}>(value: unknown): value is Task<T>;
export { createTask, isTask, type Task };
