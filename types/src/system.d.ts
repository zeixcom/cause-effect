type Cleanup = () => void;
type MaybeCleanup = Cleanup | undefined | void;
type Watcher = {
    (): void;
    on(type: Hook, cleanup: Cleanup): void;
    stop(): void;
};
type Hook = 'add' | 'change' | 'cleanup' | 'remove' | 'sort' | 'watch';
type CleanupHook = 'cleanup';
type WatchHook = 'watch';
type HookCallback = (payload?: readonly string[]) => MaybeCleanup;
type HookCallbacks = {
    [K in Hook]?: Set<HookCallback>;
};
declare const UNSET: any;
declare const HOOK_ADD = "add";
declare const HOOK_CHANGE = "change";
declare const HOOK_CLEANUP = "cleanup";
declare const HOOK_REMOVE = "remove";
declare const HOOK_SORT = "sort";
declare const HOOK_WATCH = "watch";
/**
 * Create a watcher to observe changes to a signal.
 *
 * A watcher is a reaction function with onCleanup and stop methods
 *
 * @since 0.14.1
 * @param {() => void} react - Function to be called when the state changes
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
declare const createWatcher: (react: () => void) => Watcher;
/**
 * Subscribe by adding active watcher to the Set of watchers of a signal.
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 * @returns {boolean} - Whether the watcher was the first to subscribe
 */
declare const subscribeActiveWatcher: (watchers: Set<Watcher>) => boolean;
/**
 * Notify watchers of a signal change.
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 * @returns {boolean} - Whether any watchers were notified
 */
declare const notifyWatchers: (watchers: Set<Watcher>) => boolean;
/**
 * Flush all pending reactions of enqueued watchers.
 */
declare const flushPendingReactions: () => void;
/**
 * Batch multiple signal writes.
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
declare const batchSignalWrites: (callback: () => void) => void;
/**
 * Run a function with signal reads in a tracking context (or temporarily untrack).
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
declare const trackSignalReads: (watcher: Watcher | false, run: () => void) => void;
/**
 * Trigger a hook.
 *
 * @param {Set<HookCallback>} callbacks - Callbacks to be called when the hook is triggered
 * @param {readonly string[] | undefined} payload - Payload to be sent to listeners
 * @return {Cleanup | undefined} Cleanup function to be called when the hook is unmounted
 */
declare const triggerHook: (callbacks: Set<HookCallback> | undefined, payload?: readonly string[]) => Cleanup | undefined;
/**
 * Check whether a hook type is handled in a signal.
 *
 * @param {Hook} type - Type of hook to check
 * @param {readonly (keyof Notification)[]} handled - List of handled hook types
 * @returns {type is keyof Notification}
 */
declare const isHandledHook: <T extends readonly Hook[]>(type: Hook, handled: T) => type is T[number];
export { type Cleanup, type MaybeCleanup, type Watcher, type Hook, type CleanupHook, type WatchHook, type HookCallback, type HookCallbacks, HOOK_ADD, HOOK_CHANGE, HOOK_CLEANUP, HOOK_REMOVE, HOOK_SORT, HOOK_WATCH, UNSET, createWatcher, subscribeActiveWatcher, notifyWatchers, flushPendingReactions, batchSignalWrites, trackSignalReads, triggerHook, isHandledHook, };
