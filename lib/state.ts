import { type Watcher, subscribe, notify } from "./signal"
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
export class State<T extends {}> {
    private watchers: Watcher[] = []

    constructor(private value: T) {}

	/**
	 * Get the current value of the state
	 * 
	 * @since 0.9.0
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
	 * @since 0.9.0
	 * @method of State<T>
	 * @param {T} value
	 * @returns {void}
	 */
    set(value: T): void {
		if (UNSET !== value) {
			if (Object.is(this.value, value)) return
			this.value = value
		}
		notify(this.watchers)

		// Setting to UNSET clears the watchers so the signal can be garbage collected
		if (UNSET === value) this.watchers = []
    }

	/**
	 * Update the state with a new value using a function
	 * 
	 * @since 0.10.0
	 * @method of State<T>
	 * @param {(value: T) => T} fn
	 * @returns {void} - updates the state with the result of the function
	 */
	update(fn: (value: T) => T): void {
		this.set(fn(this.value))
    }

	/**
	 * Create a derived state from an existing state
	 * 
	 * @since 0.9.0
	 * @method of State<T>
	 * @param {(value: T) => U} fn
	 * @returns {Computed<U>} - derived state
	 */
    map<U>(fn: (value: T) => U): Computed<U> {
        return computed<U>(() => fn(this.get()))
    }
}

/* === Helper Functions === */

/**
 * Create a new state signal
 * 
 * @since 0.9.0
 * @param {T} value - initial value of the state
 * @returns {State<T>} - new state signal
 */
export const state = /*#__PURE__*/ <T extends {}>(value: T): State<T> =>
	new State(value)

/**
 * Check if the provided value is a State instance
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
export const isState = /*#__PURE__*/ <T extends {}>(value: unknown): value is State<T> =>
	value instanceof State
