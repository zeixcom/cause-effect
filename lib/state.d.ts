import { type Computed } from "./computed";
export declare const UNSET: any;
/**
 * Define a reactive state
 *
 * @since 0.9.0
 * @class State
 */
export declare class State<T extends {}> {
    private value;
    private watchers;
    constructor(value: T);
    /**
     * Get the current value of the state
     *
     * @since 0.9.0
     * @method of State<T>
     * @returns {T} - current value of the state
     */
    get(): T;
    /**
     * Set a new value of the state
     *
     * @since 0.9.0
     * @method of State<T>
     * @param {T} value
     * @returns {void}
     */
    set(value: T): void;
    /**
     * Update the state with a new value using a function
     *
     * @since 0.10.0
     * @method of State<T>
     * @param {(value: T) => T} fn
     * @returns {void} - updates the state with the result of the function
     */
    update(fn: (value: T) => T): void;
    /**
     * Create a derived state from an existing state
     *
     * @since 0.9.0
     * @method of State<T>
     * @param {(value: T) => U} fn
     * @returns {Computed<U>} - derived state
     */
    map<U extends {}>(fn: (value: T) => U): Computed<U>;
}
/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} value - initial value of the state
 * @returns {State<T>} - new state signal
 */
export declare const state: <T extends {}>(value: T) => State<T>;
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
export declare const isState: <T extends {}>(value: unknown) => value is State<T>;
