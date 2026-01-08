import { type Guard } from './errors';
import type { UnknownSignal } from './signal';
type Cleanup = () => void;
type MaybeCleanup = Cleanup | undefined | void;
type Watcher = {
    (): void;
    run(): void;
    onCleanup(cleanup: Cleanup): void;
    stop(): void;
};
type SignalOptions<T extends unknown & {}> = {
    guard?: Guard<T>;
    watched?: () => void;
    unwatched?: () => void;
};
declare const UNSET: any;
/**
 * Create a watcher to observe changes in signals.
 *
 * A watcher combines push and pull reaction functions with onCleanup and stop methods
 *
 * @since 0.17.3
 * @param {() => void} push - Function to be called when the state changes (push)
 * @param {() => void} pull - Function to be called on demand from consumers (pull)
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
declare const createWatcher: (push: () => void, pull: () => void) => Watcher;
/**
 * Run a function with signal reads in a non-tracking context.
 *
 * @param {() => void} callback - Callback
 */
declare const untrack: (callback: () => void) => void;
declare const registerWatchCallbacks: (signal: UnknownSignal, watched: () => void, unwatched?: () => void) => void;
/**
 * Subscribe active watcher to a signal.
 *
 * @param {UnknownSignal} signal - Signal to subscribe to
 * @returns {boolean} - true if the active watcher was subscribed,
 *                      false if the watcher was already subscribed or there was no active watcher
 */
declare const subscribeTo: (signal: UnknownSignal) => boolean;
declare const subscribeActiveWatcher: (watchers: Set<Watcher>) => boolean;
/**
 * Unsubscribe all watchers from a signal so it can be garbage collected.
 *
 * @param {UnknownSignal} signal - Signal to unsubscribe from
 * @returns {void}
 */
declare const unsubscribeAllFrom: (signal: UnknownSignal) => void;
/**
 * Notify watchers of a signal change.
 *
 * @param {UnknownSignal} signal - Signal to notify watchers of
 * @returns {boolean} - Whether any watchers were notified
 */
declare const notifyOf: (signal: UnknownSignal) => boolean;
declare const notifyWatchers: (watchers: Set<Watcher>) => boolean;
/**
 * Flush all pending reactions of enqueued watchers.
 */
declare const flush: () => void;
/**
 * Batch multiple signal writes.
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
declare const batch: (callback: () => void) => void;
/**
 * Run a function with signal reads in a tracking context (or temporarily untrack).
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
declare const track: (watcher: Watcher | false, run: () => void) => void;
export { type Cleanup, type MaybeCleanup, type Watcher, type SignalOptions, UNSET, createWatcher, registerWatchCallbacks, subscribeTo, subscribeActiveWatcher, unsubscribeAllFrom, notifyOf, notifyWatchers, flush, batch, track, untrack, };
