import type { Computed } from "./computed";
export interface State<T> {
    map: <U>(fn: (value: T) => U) => Computed<U>;
}
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
    private constructor();
    /**
     * Create a new state signal
     *
     * @static method of State<T>
     * @param {T} value - initial value of the state
     * @returns {State<T>} - new state signal
     */
    static of<T>(value: T): State<T>;
    static isState: (value: unknown) => value is State<unknown>;
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
    set(value: T | StateUpdater<T>): void;
}
