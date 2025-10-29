import { type Cleanup } from './scheduler';
type MaybeCleanup = Cleanup | undefined | void;
/**
 * Define what happens when a reactive state changes
 *
 * The callback can be synchronous or asynchronous. Async callbacks receive
 * an AbortSignal parameter, which is automatically aborted when the effect
 * re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {() => MaybeCleanup} callback - Synchronous effect callback
 * @returns {Cleanup} - Cleanup function for the effect
 */
declare function effect(callback: () => MaybeCleanup): Cleanup;
declare function effect(callback: (abort: AbortSignal) => Promise<MaybeCleanup>): Cleanup;
export { type MaybeCleanup, effect };
