import { type SignalOptions } from '../system';
declare const TYPE_STATE: "State";
/**
 * Create a new state signal.
 *
 * @since 0.17.0
 * @param {T} initialValue - Initial value of the state
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is invalid
 */
declare class State<T extends {}> {
    #private;
    constructor(initialValue: T, options?: SignalOptions<T>);
    get [Symbol.toStringTag](): string;
    /**
     * Get the current value of the state signal.
     *
     * @returns {T} - Current value of the state
     */
    get(): T;
    /**
     * Set the value of the state signal.
     *
     * @param {T} newValue - New value of the state
     * @returns {void}
     * @throws {NullishSignalValueError} - If the initial value is null or undefined
     * @throws {InvalidSignalValueError} - If the initial value is invalid
     */
    set(newValue: T): void;
    /**
     * Update the value of the state signal.
     *
     * @param {Function} updater - Function that takes the current value and returns the new value
     * @returns {void}
     * @throws {InvalidCallbackError} - If the updater function is not a function
     * @throws {NullishSignalValueError} - If the initial value is null or undefined
     * @throws {InvalidSignalValueError} - If the initial value is invalid
     */
    update(updater: (oldValue: T) => T): void;
}
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a State instance, false otherwise
 */
declare const isState: <T extends {}>(value: unknown) => value is State<T>;
export { TYPE_STATE, isState, State };
