import { type Cleanup } from './scheduler';
import { type Signal, type SignalValues } from './signal';
type MaybeCleanup = Cleanup | undefined | void;
type SyncOkCallback<S extends Record<string, Signal<unknown & {}>>> = (values: SignalValues<S>) => MaybeCleanup;
type AsyncOkCallback<S extends Record<string, Signal<unknown & {}>>> = (values: SignalValues<S>, abort: AbortSignal) => Promise<MaybeCleanup>;
type SyncErrCallback = (errors: readonly Error[]) => MaybeCleanup;
type AsyncErrCallback = (errors: readonly Error[], abort: AbortSignal) => Promise<MaybeCleanup>;
type SyncNilCallback = () => MaybeCleanup;
type AsyncNilCallback = (abort: AbortSignal) => Promise<MaybeCleanup>;
type EffectMatcher<S extends Record<string, Signal<unknown & {}>>> = {
    signals: S;
    ok?: SyncOkCallback<S> | AsyncOkCallback<S>;
    err?: SyncErrCallback | AsyncErrCallback;
    nil?: SyncNilCallback | AsyncNilCallback;
};
/**
 * Define what happens when a reactive state changes
 *
 * Callbacks can be synchronous or asynchronous. Async callbacks that return
 * cleanup functions will have their cleanup registered once the promise resolves.
 *
 * Async callbacks receive an AbortSignal as their second parameter,
 * which is automatically aborted when the effect re-runs or is cleaned up,
 * preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - Effect matcher with sync callbacks
 * @returns {Cleanup} - Cleanup function for the effect
 */
declare function effect<S extends Record<string, Signal<unknown & {}>>>(matcher: EffectMatcher<S>): Cleanup;
declare function effect(callback: () => MaybeCleanup): Cleanup;
declare function effect(callback: (abort: AbortSignal) => Promise<MaybeCleanup>): Cleanup;
export { type EffectMatcher, type MaybeCleanup, effect };
