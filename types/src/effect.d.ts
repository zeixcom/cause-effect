import { type Cleanup } from './scheduler';
import { type Signal } from './signal';
type MaybeCleanup = Cleanup | undefined | void;
type SyncCallback<T extends unknown[]> = (...args: T) => MaybeCleanup;
type AsyncCallback<T extends unknown[]> = (abort: AbortSignal, ...args: T) => Promise<MaybeCleanup>;
type EffectMatcher<S extends Signal<unknown & {}>[]> = {
    signals: S;
    ok: SyncCallback<S> | AsyncCallback<S>;
    err?: SyncCallback<Error[]> | AsyncCallback<Error[]>;
    nil?: SyncCallback<[]> | AsyncCallback<[]>;
};
/**
 * Define what happens when a reactive state changes
 *
 * Callbacks can be synchronous or asynchronous. Async callbacks that return
 * cleanup functions will have their cleanup registered once the promise resolves.
 *
 * Async callbacks receive an AbortSignal as their first parameter, which is automatically
 * aborted when the effect re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - Effect matcher or callback (sync or async)
 * @returns {Cleanup} - Cleanup function for the effect
 */
declare function effect<S extends Signal<unknown & {}>[]>(matcher: EffectMatcher<S> | SyncCallback<[]> | AsyncCallback<[]>): Cleanup;
/**
 * Helper function to call an effect callback with an AbortSignal
 *
 * @param {((...args: T) => MaybeCleanup) | ((abort: AbortSignal, ...args: T) => Promise<MaybeCleanup>) | undefined} fn - Effect callback to call
 * @param {AbortSignal | undefined} abort - Abort signal to pass to the effect callback
 * @param {T} args - Arguments to pass to the effect callback
 * @returns {MaybeCleanup | Promise<MaybeCleanup>} - Cleanup function or promise of cleanup function
 * /
function callWithAbort<T extends unknown[]>(
    fn: (...args: T) => MaybeCleanup,
    abort: undefined,
    ...args: T
): MaybeCleanup
function callWithAbort<T extends unknown[]>(
    fn: (abort: AbortSignal, ...args: T) => Promise<MaybeCleanup>,
    abort: AbortSignal,
    ...args: T
): Promise<MaybeCleanup>
function callWithAbort<T extends unknown[]>(
    fn: undefined,
    abort: undefined,
    ...args: T
): void
function callWithAbort<T extends unknown[]>(
    fn: unknown,
    abort: AbortSignal | undefined,
    ...args: T
): MaybeCleanup | Promise<MaybeCleanup> {
    return !fn
        ? undefined
        : isAsyncFunction<MaybeCleanup>(fn) && abort
            ? fn(abort, ...args)
            : isFunction<MaybeCleanup>(fn)
                ? fn(...args)
                : undefined
}

/* === Exports === */
export { type EffectMatcher, type MaybeCleanup, effect };
