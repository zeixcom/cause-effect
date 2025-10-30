import { type Cleanup } from './scheduler';
type MaybeCleanup = Cleanup | undefined | void;
type EffectCallback = (() => MaybeCleanup) | ((abort: AbortSignal) => Promise<MaybeCleanup>);
/**
 * Define what happens when a reactive state changes
 *
 * The callback can be synchronous or asynchronous. Async callbacks receive
 * an AbortSignal parameter, which is automatically aborted when the effect
 * re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectCallback} callback - Synchronous or asynchronous effect callback
 * @returns {Cleanup} - Cleanup function for the effect
 */
declare const effect: (callback: EffectCallback) => Cleanup;
export { type MaybeCleanup, type EffectCallback, effect };
