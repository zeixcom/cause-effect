export type EnqueueDedupe = [Element, string];
export type Watcher = () => void;
export type Runner = () => void;
export type Updater = <T>() => T;
/**
 * Flush all pending change notifications and runs in the signal graph
 */
export declare const flush: () => void;
/**
 * Add notify function of active watcher to the set of watchers
 *
 * @param {Watcher[]} watchers - set of current watchers
 */
export declare const subscribe: (watchers: Watcher[]) => void;
/**
 * Add watchers to the pending set of change notifications
 *
 * @param {Watcher[]} watchers - set of current watchers
 */
export declare const notify: (watchers: Watcher[]) => void;
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
