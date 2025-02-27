import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T extends {}> = State<T> | Computed<T>;
type MaybeSignal<T extends {}> = State<T> | Computed<T> | T | ((old?: T) => T);
type Watcher = () => void;
export declare const UNSET: any;
/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {any} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: any) => value is Signal<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @param memo
 * @returns {Signal<T>} - converted Signal
 */
declare const toSignal: <T extends {}>(value: MaybeSignal<T>) => Signal<T>;
/**
 * Add notify function of active watchers to the set of watchers
 *
 * @param {Watcher[]} watchers - set of current watchers
 */
declare const subscribe: (watchers: Watcher[]) => void;
/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 *
 * @param {Watcher[]} watchers
 */
declare const notify: (watchers: Watcher[]) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} mark - function to be called when the state changes
 */
declare const watch: (run: () => void, mark: Watcher) => void;
/**
 * Batch multiple state changes into a single update
 *
 * @param {() => void} run - function to run the batch of state changes
 */
declare const batch: (run: () => void) => void;
export { type Signal, type MaybeSignal, type Watcher, isSignal, toSignal, subscribe, notify, watch, batch };
