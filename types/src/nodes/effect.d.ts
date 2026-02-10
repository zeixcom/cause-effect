import { type Cleanup, type EffectCallback, type MaybeCleanup, type Signal } from '../graph';
type MaybePromise<T> = T | Promise<T>;
type MatchHandlers<T extends Signal<unknown & {}>[]> = {
    ok: (values: {
        [K in keyof T]: T[K] extends Signal<infer V> ? V : never;
    }) => MaybePromise<MaybeCleanup>;
    err?: (errors: readonly Error[]) => MaybePromise<MaybeCleanup>;
    nil?: () => MaybePromise<MaybeCleanup>;
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
 * Runs handlers based on the current values of signals.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 0.15.0
 * @throws RequiredOwnerError If called without an active owner.
 */
declare function match<T extends Signal<unknown & {}>[]>(signals: T, handlers: MatchHandlers<T>): MaybeCleanup;
export { type MaybePromise, type MatchHandlers, createEffect, match };
