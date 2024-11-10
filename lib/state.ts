import { isFunction, isInstanceOf } from "./util"
import { type Watchers, subscribe, notify } from "./signal"
import { type Computed, computed } from "./computed"

/* === Constants === */

export const UNSET: any = Symbol()

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
	 * @param {T | ((v: T) => T)} value
	 * @returns {void}
	 */
    set(value: T | ((v: T) => T)): void {
		if (UNSET !== value) {
			const newValue = isFunction(value) ? value(this.value) : value
			if (Object.is(this.value, newValue)) return
			this.value = newValue
		}
		notify(this.watchers)

		// Setting to null clears the watchers so the signal can be garbage collected
		if (UNSET === value) this.watchers.clear()
    }

    map<U>(fn: (value: T) => U): Computed<U> {
        return computed<U>(() => fn(this.get()))
    }
}

/**
 * Create a new state signal
 * 
 * @static method of State<T>
 * @param {T} value - initial value of the state
 * @returns {State<T>} - new state signal
 */
export const state = /*#__PURE__*/ <T>(value: T): State<T> =>
	new State(value)

export const isState = /*#__PURE__*/ isInstanceOf(State)
