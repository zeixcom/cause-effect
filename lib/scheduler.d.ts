export type EnqueueDedupe = [Element, string];
export type Watcher = () => void;
export type Updater = <T>() => T | boolean | void;
/**
 * Add active watcher to the array of watchers
 *
 * @param {Watcher[]} watchers - watchers of the signal
 */
export declare const subscribe: (watchers: Watcher[]) => void;
/**
 * Add watchers to the pending set of change notifications
 *
 * @param {Watcher[]} watchers - watchers of the signal
 */
export declare const notify: (watchers: Watcher[]) => void;
/**
 * Flush all pending changes to notify watchers
 */
export declare const flush: () => void;
/**
 * Batch multiple changes in a single signal graph and DOM update cycle
 *
 * @param {() => void} fn - function with multiple signal writes to be batched
 */
export declare const batch: (fn: () => void) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} mark - function to be called when the state changes or undefined for temporary unwatching while inserting auto-hydrating DOM nodes that might read signals (e.g., web components)
 */
export declare const watch: (run: () => void, mark?: Watcher) => void;
/**
 * Enqueue a function to be executed on the next animation frame
 *
 * @param {Updater} fn - function to be executed on the next animation frame; can return updated value <T>, success <boolean> or void
 * @param {EnqueueDedupe} dedupe - [element, operation] pair for deduplication
 */
export declare const enqueue: <T>(fn: Updater, dedupe?: EnqueueDedupe) => Promise<boolean | void | T>;
