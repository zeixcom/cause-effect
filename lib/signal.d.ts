import { State } from "./state";
import { Computed } from "./computed";
type Signal<T> = State<T> | Computed<T>;
/**
 * Add notify function of active listener to the set of listeners
 *
 * @param {Set<() => void>} targets - set of current listeners
 */
export declare const autotrack: (targets: Set<() => void>) => void;
/**
 * Run all notify function of dependent listeners
 *
 * @param {Set<() => void>} targets
 */
export declare const autorun: (targets: Set<() => void>) => void;
/**
 * Run a function in a reactive context
 *
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
export declare const reactive: (fn: () => void, notify: () => void) => void;
export declare const isSignal: (value: unknown) => value is Signal<unknown>;
export {};
