type Cleanup = () => void;
type Watcher = {
    (): void;
    onCleanup(cleanup: Cleanup): void;
    stop(): void;
};
type Notifications = {
    add: readonly string[];
    change: readonly string[];
    remove: readonly string[];
    sort: readonly string[];
};
type Listener<K extends keyof Notifications> = (payload: Notifications[K]) => void;
type Listeners = {
    [K in keyof Notifications]: Set<Listener<K>>;
};
/**
 * Create a watcher that can be used to observe changes to a signal
 *
 * A watcher is a reaction function with onCleanup and stop methods
 *
 * @since 0.14.1
 * @param {() => void} react - Function to be called when the state changes
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
declare const createWatcher: (react: () => void) => Watcher;
/**
 * Subscribe by adding active watcher to the Set of watchers of a signal
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 */
declare const subscribeActiveWatcher: (watchers: Set<Watcher>) => void;
/**
 * Notify watchers of a signal change
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 */
declare const notifyWatchers: (watchers: Set<Watcher>) => void;
/**
 * Flush all pending reactions of enqueued watchers
 */
declare const flushPendingReactions: () => void;
/**
 * Batch multiple signal writes
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
declare const batchSignalWrites: (callback: () => void) => void;
/**
 * Run a function with signal reads in a tracking context (or temporarily untrack)
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
declare const trackSignalReads: (watcher: Watcher | false, run: () => void) => void;
/**
 * Emit a notification to listeners
 *
 * @param {Set<Listener>} listeners - Listeners to be notified
 * @param {Notifications[K]} payload - Payload to be sent to listeners
 */
declare const emitNotification: <T extends keyof Notifications>(listeners: Set<Listener<T>>, payload: Notifications[T]) => void;
export { type Cleanup, type Watcher, type Notifications, type Listener, type Listeners, createWatcher, subscribeActiveWatcher, notifyWatchers, flushPendingReactions, batchSignalWrites, trackSignalReads, emitNotification, };
