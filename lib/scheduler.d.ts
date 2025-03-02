export type EnqueueDedupe = [Element, string];
export type Watcher = () => void;
export type Updater = <T>() => T;
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
 * @param {Watcher} mark - function to be called when the state changes
 */
export declare const watch: (run: () => void, mark: Watcher) => void;
/**
 * Enqueue a function to be executed on the next animation frame
 *
 * @param callback
 * @param dedupe
 * @returns
 */
export declare const enqueue: <T>(update: Updater, dedupe?: EnqueueDedupe) => Promise<T>;
export declare const animationFrame: () => Promise<number>;
