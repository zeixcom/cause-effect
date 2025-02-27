import { type Watcher, subscribe, notify, UNSET } from "./signal"
import { type Computed, computed } from "./computed"
import { isObjectOfType } from "./util";

/* === Types === */

export type State<T extends {}> = {
    get(): T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    map<U extends {}>(fn: (value: T) => U): Computed<U>;
    [Symbol.toStringTag]: string;
}

/* === Constants === */

const TYPE_STATE = 'State'

/* === State Factory === */

/**
 * Create a new state signal
 * 
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
export const state = /*#__PURE__*/ <T extends {}>(initialValue: T): State<T> => {
	const watchers: Watcher[] = []
	let value: T = initialValue

	const s: State<T> = {
		[Symbol.toStringTag]: TYPE_STATE,

		/**
		 * Get the current value of the state
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @returns {T} - current value of the state
		 */
        get: (): T => {
			subscribe(watchers)
        	return value
		},

		/**
		 * Set a new value of the state
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @param {T} newValue
		 * @returns {void}
		 */
        set: (newValue: T): void => {
            if (Object.is(value, newValue)) return
            value = newValue
            notify(watchers)

            // Setting to UNSET clears the watchers so the signal can be garbage collected
            if (UNSET === value) watchers.length = 0
        },

		/**
		 * Update the state with a new value using a function
		 * 
		 * @since 0.10.0
		 * @method of State<T>
		 * @param {(value: T) => T} fn
		 * @returns {void} - updates the state with the result of the function
		 */
        update: (fn: (value: T) => T): void => {
            s.set(fn(value))
        },

		/**
		 * Create a derived state from an existing state
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @param {(value: T) => U} fn
		 * @returns {Computed<U>} - derived state
		 */
        map: <U extends {}>(fn: (value: T) => U): Computed<U> => {
            return computed<U>(() => fn(value))
        }
	}

	return s
}

/**
 * Check if the provided value is a State instance
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
export const isState = /*#__PURE__*/ <T extends {}>(value: unknown): value is State<T> =>
	isObjectOfType(value, TYPE_STATE)
