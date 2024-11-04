import { isFunction, isInstanceOf } from "./util";
import { type Watchers, subscribe, notify } from "./signal";
import { Computed } from "./computed";

/* === Types === */

export type StateUpdater<T> = (old: T) => T

/* === Class State === */

/**
 * Define a reactive state
 * 
 * @since 0.9.0
 * @class State
 */
export class State<T> {
    private watchers: Watchers = new Set()

    constructor(private value: T) {}

	/**
	 * Create a new state signal
	 * 
	 * @static method of State<T>
	 * @param {T} value - initial value of the state
	 * @returns {State<T>} - new state signal
	 */
    static of<T>(value: T): State<T> {
		return /*#__PURE__*/ new State(value);
	}

    static isState = /*#__PURE__*/ isInstanceOf(State)

	/**
	 * Get the current value of the state
	 * 
	 * @method of State<T>
	 * @returns {T} - current value of the state
	 */
    get(): T {
        subscribe(this.watchers)
        return this.value
    }

	/**
	 * Set a new value of the state
	 * 
	 * @method of State<T>
	 * @param {T | StateUpdater<T>} value
	 * @returns {void}
	 */
    set(value: T | ((v: T) => T)): void {
        const newValue = isFunction(value) ? value(this.value) : value
		if (Object.is(this.value, newValue)) return
		this.value = newValue
		notify(this.watchers)
    }

    map<U>(fn: (value: T) => U): Computed<U> {
        return Computed.of<U>(() => fn(this.get()))
    }
}
