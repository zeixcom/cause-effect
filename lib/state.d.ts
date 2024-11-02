type StateValue<T> = T | undefined;
type StateUpdater<T> = (old: StateValue<T>) => StateValue<T>;
/**
 * Define a reactive state
 *
 * @since 0.9.0
 * @class State
 */
export declare class State<T> {
    private value;
    private sinks;
    private constructor();
    /**
     * Create a new state signal
     *
     * @static method of State<T>
     * @param {StateValue<T>} value - initial value of the state
     * @returns {State<T>} - new state signal
     */
    static of<T>(value: StateValue<T>): State<T>;
    static isState: (value: unknown) => value is State<unknown>;
    /**
     * Get the current value of the state
     *
     * @method of State<T>
     * @returns {T | undefined} - current value of the state
     */
    get(): T | undefined;
    /**
     * Set a new value of the state
     *
     * @method of State<T>
     * @param {StateValue<T> | StateUpdater<T>} value
     * @returns {void}
     */
    set(value: StateValue<T> | StateUpdater<T>): void;
}
export {};
