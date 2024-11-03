import { State } from "./state";
import { Computed } from "./computed";
export type Signal<T> = State<T> | Computed<T>;
export declare function map<T, U>(this: Signal<T>, fn: (value: T) => U): Computed<U>;
export declare const isSignal: (value: unknown) => value is Signal<unknown>;
/**
 * Add notify function of active watchers to the set of watchers
 *
 * @param {Set<() => void>} watchers - set of current watchers
 */
export declare const subscribe: (watchers: Set<() => void>) => void;
/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 *
 * @param {Set<() => void>} watchers
 */
export declare const notify: (watchers: Set<() => void>) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
export declare const watch: (fn: () => void, notify: () => void) => void;
export declare const batch: (fn: () => void) => void;
