import { type Computed } from "./computed";
export type StateUpdater<T> = (old: T) => T;
/**
 * Define a reactive state
 *
 * @since 0.9.0
 * @class State
 */
export declare class State<T> {
    private value;
    private watchers;
    constructor(value: T);
    /**
     * Get the current value of the state
     *
     * @method of State<T>
     * @returns {T} - current value of the state
     */
    get(): T;
    /**
     * Set a new value of the state
     *
     * @method of State<T>
     * @param {T | StateUpdater<T>} value
     * @returns {void}
     */
    set(value: T | ((v: T) => T)): void;
    map<U>(fn: (value: T) => U): Computed<U>;
}
/**
 * Create a new state signal
 *
 * @static method of State<T>
 * @param {T} value - initial value of the state
 * @returns {State<T>} - new state signal
 */
export declare const state: <T>(value: T) => State<T>;
export declare const isState: (value: unknown) => value is State<any>;
