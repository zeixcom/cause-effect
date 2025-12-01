type State<T extends {}> = {
    readonly [Symbol.toStringTag]: 'State';
    get(): T;
    set(newValue: T): void;
    update(updater: (oldValue: T) => T): void;
};
declare const TYPE_STATE = "State";
/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
declare const createState: <T extends {}>(initialValue: T) => State<T>;
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
declare const isState: <T extends {}>(value: unknown) => value is State<T>;
export { TYPE_STATE, isState, createState, type State };
