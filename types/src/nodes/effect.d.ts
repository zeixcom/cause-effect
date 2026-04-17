import { type Cleanup, type EffectCallback, type MaybeCleanup, type Signal } from '../graph';
/** A value that is either synchronous or a `Promise` — used for handler return types in `match()`. */
type MaybePromise<T> = T | Promise<T>;
/**
 * Handlers for all states of one or more signals passed to `match()`.
 *
 * @template T - Tuple of `Signal` types being matched
 */
type MatchHandlers<T extends readonly Signal<unknown & {}>[]> = {
    /** Called when all signals have a value. Receives a tuple of resolved values. */
    ok: (values: {
        [K in keyof T]: T[K] extends Signal<infer V> ? V : never;
    }) => MaybePromise<MaybeCleanup>;
    /** Called when one or more signals hold an error. Defaults to `console.error`. */
    err?: (errors: readonly Error[]) => MaybePromise<MaybeCleanup>;
    /** Called when one or more signals are unset (pending). */
    nil?: () => MaybePromise<MaybeCleanup>;
    /** Called when all signals have a (stale) value but one or more Task signals are re-computing. Falls back to `ok` if absent. */
    stale?: () => MaybePromise<MaybeCleanup>;
};
/**
 * Handlers for a single signal passed to `match()`.
 *
 * @template T - The value type of the signal being matched
 */
type SingleMatchHandlers<T extends {}> = {
    /** Called when the signal has a value. Receives the resolved value directly. */
    ok: (value: T) => MaybePromise<MaybeCleanup>;
    /** Called when the signal holds an error. Receives the error directly. Defaults to `console.error`. */
    err?: (error: Error) => MaybePromise<MaybeCleanup>;
    /** Called when the signal is unset (pending). */
    nil?: () => MaybePromise<MaybeCleanup>;
    /** Called when the signal has a (stale) value but the Task is re-computing. Falls back to `ok` if absent. */
    stale?: () => MaybePromise<MaybeCleanup>;
};
/**
 * Creates a reactive effect that automatically runs when its dependencies change.
 * Effects run immediately upon creation and re-run when any tracked signal changes.
 * Effects are executed during the flush phase, after all updates have been batched.
 *
 * @since 0.1.0
 * @param fn - The effect function that can track dependencies and register cleanup callbacks
 * @returns A cleanup function that can be called to dispose of the effect
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const dispose = createEffect(() => {
 *   console.log('Count is:', count.get());
 * });
 *
 * count.set(1); // Logs: "Count is: 1"
 * dispose(); // Stop the effect
 * ```
 *
 * @example
 * ```ts
 * // With cleanup
 * createEffect(() => {
 *   const timer = setInterval(() => console.log(count.get()), 1000);
 *   return () => clearInterval(timer);
 * });
 * ```
 */
declare function createEffect(fn: EffectCallback): Cleanup;
/**
 * Reads one or more signals and dispatches to the appropriate handler based on their state.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 1.1
 * @param signal - A single signal to read.
 * @param handlers - Object with an `ok` branch (receives the value directly) and optional `err`, `nil`, and `stale` branches.
 * @returns An optional cleanup function if the active handler returns one.
 * @throws RequiredOwnerError If called without an active owner.
 */
declare function match<T extends {}>(signal: Signal<T>, handlers: SingleMatchHandlers<T>): MaybeCleanup;
/**
 * Reads one or more signals and dispatches to the appropriate handler based on their state.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 0.15.0
 * @param signals - Tuple of signals to read; all must have a value for `ok` to run.
 * @param handlers - Object with an `ok` branch and optional `err`, `nil`, and `stale` branches. Routing precedence: `nil` > `err` > `stale` > `ok`.
 * @returns An optional cleanup function if the active handler returns one.
 * @throws RequiredOwnerError If called without an active owner.
 *
 * @remarks
 * **Async handlers are for external side effects only** — DOM mutations, analytics, logging,
 * or any fire-and-forget API call whose result does not need to drive reactive state.
 * Do not call `.set()` on a signal inside an async handler: use a `Task` node instead,
 * which receives an `AbortSignal`, is auto-cancelled on re-run, and integrates cleanly
 * with `nil` and `err` branches.
 *
 * Rejections from async handlers are always routed to `err`, including rejections from
 * stale runs that were already superseded by a newer signal value. The library cannot
 * cancel external operations it did not start.
 */
declare function match<T extends readonly Signal<unknown & {}>[]>(signals: readonly [...T], handlers: MatchHandlers<T>): MaybeCleanup;
export { type MaybePromise, type MatchHandlers, type SingleMatchHandlers, createEffect, match, };
