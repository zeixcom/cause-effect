type EnqueueDedupe = [Element, string];
type Cleanup = () => void;
type Watcher = {
    (): void;
    cleanups: Set<Cleanup>;
};
type Updater = <T>() => T | boolean | void;
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
 * @param {Watcher} mark - function to be called when the state changes or undefined for temporary unwatching while inserting auto-hydrating DOM nodes that might read signals (e.g., web components)
 */
declare const watch: (run: () => void, mark?: Watcher) => void;
/**
 * Enqueue a function to be executed on the next animation frame
 *
 * @param {Updater} fn - function to be executed on the next animation frame; can return updated value <T>, success <boolean> or void
 * @param {EnqueueDedupe} dedupe - [element, operation] pair for deduplication
 */
declare const enqueue: <T>(fn: Updater, dedupe: EnqueueDedupe) => Promise<boolean | void | T>;
export { type EnqueueDedupe, type Cleanup, type Watcher, type Updater, subscribe, notify, flush, batch, watch, enqueue, };
