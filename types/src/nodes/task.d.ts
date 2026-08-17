import { type DeriveSignalOptions, type TaskCallback } from '../graph';
import type { Cell } from './cell';
/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 * The shape this factory returns is `Cell<T>` — the single-value, readonly member of the
 * shape-indexed value-type set. See ADR-0018.
 *
 * Pending state and abort control are graph utilities rather than methods on the returned
 * signal — asynchrony is an origin, not a shape, so any of the three shapes can be derived
 * asynchronously. Use `isPending(signal)` and `abort(signal)` from the graph module.
 *
 * @since 0.18.0
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @param options.initial - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the task is first watched by an effect.
 *   Receives an `invalidate` function to mark the task dirty and trigger re-execution.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Cell object with a get() method
 *
 * @example
 * ```ts
 * const userId = createState(1);
 * const user = createTask(async (prev, abortSignal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal });
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
 * if (isPending(user)) {
 *   console.log('Loading...');
 * }
 * ```
 */
declare function createTask<T extends {}>(fn: (prev: T, abortSignal: AbortSignal) => Promise<T>, options: DeriveSignalOptions<T> & {
    initial: T;
}): Cell<T>;
declare function createTask<T extends {}>(fn: TaskCallback<T>, options?: DeriveSignalOptions<T>): Cell<T>;
export { createTask };
