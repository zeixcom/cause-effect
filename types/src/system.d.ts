type Cleanup = () => void;
type Watcher = {
    (): void;
    unwatch(cleanup: Cleanup): void;
    cleanup(): void;
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
 * @since 0.14.1
 * @param {() => void} watch - Function to be called when the state changes
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
declare const createWatcher: (watch: () => void) => Watcher;
/**
 * Add active watcher to the Set of watchers
 *
 * @param {Set<Watcher>} watchers - watchers of the signal
 */
declare const subscribe: (watchers: Set<Watcher>) => void;
/**
 * Add watchers to the pending set of change notifications
 *
 * @param {Set<Watcher>} watchers - watchers of the signal
 */
declare const notify: (watchers: Set<Watcher>) => void;
/**
 * Flush all pending changes to notify watchers
 */
declare const flush: () => void;
/**
 * Batch multiple changes in a single signal graph and DOM update cycle
 *
 * @param {() => void} fn - function with multiple signal writes to be batched
 */
declare const batch: (fn: () => void) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} watcher - function to be called when the state changes or undefined for temporary unwatching while inserting auto-hydrating DOM nodes that might read signals (e.g., web components)
 */
declare const observe: (run: () => void, watcher?: Watcher) => void;
/**
 * Emit a notification to listeners
 *
 * @param {Set<Listener>} listeners - Listeners to be notified
 * @param {Notifications[keyof Notifications]} payload - Payload to be sent to listeners
 */
declare const emit: <T extends keyof Notifications>(listeners: Set<Listener<T>>, payload: Notifications[T]) => void;
export { type Cleanup, type Watcher, type Notifications, type Listener, type Listeners, subscribe, notify, flush, batch, createWatcher, observe, emit, };
