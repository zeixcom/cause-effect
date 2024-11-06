import { type State } from "./state";
import { type Computed } from "./computed";
type Signal<T> = State<T> | Computed<T>;
type Notifier = () => void;
type Watchers = Set<Notifier>;
declare const isSignal: (value: unknown) => value is Signal<unknown>;
/**
 * Add notify function of active watchers to the set of watchers
 *
 * @param {Set<() => void>} watchers - set of current watchers
 */
declare const subscribe: (watchers: Set<() => void>) => void;
/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 *
 * @param {Set<() => void>} watchers
 */
declare const notify: (watchers: Set<() => void>) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
declare const watch: (fn: () => void, notify: () => void) => void;
declare const batch: (fn: () => void) => void;
export { type Signal, type Notifier, type Watchers, isSignal, subscribe, notify, watch, batch };
