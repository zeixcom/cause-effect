import { isFunction } from "./util";
import { autorun, autotrack } from "./signal";

/* === Types === */

type StateValue<T> = T | undefined
type StateUpdater<T> = (old: StateValue<T>) => StateValue<T>

/* === Class State === */

/**
 * Define a reactive state
 * 
 * @since 0.9.0
 * @class State
 */
export class State<T> {
	private sinks: Set<() => void> = new Set()

	private constructor(private value: StateValue<T>) {}

	/**
	 * Create a new state signal
	 * 
	 * @static method of State<T>
	 * @param {StateValue<T>} value - initial value of the state
	 * @returns {State<T>} - new state signal
	 */
	static of<T>(value: StateValue<T>): State<T> {
		return new State(value);
	}

	static isState = (value: unknown): value is State<unknown> =>
			value instanceof State

	/**
	 * Get the current value of the state
	 * 
	 * @method of State<T>
	 * @returns {T | undefined} - current value of the state
	 */
	get(): T | undefined {
		autotrack(this.sinks)
		return this.value
	}

	/**
	 * Set a new value of the state
	 * 
	 * @method of State<T>
	 * @param {StateValue<T> | StateUpdater<T>} value
	 * @returns {void}
	 */
	set(value: StateValue<T> | StateUpdater<T>): void {
		const newValue = isFunction(value) ? value(this.value)
			: value
		if (!Object.is(this.value, newValue)) {
			this.value = newValue
			autorun(this.sinks)
		}
	}

	/**
	 * Subscriptions for the state
	 * 
	 * @property {Array<() => void>} targets - list of listeners when the state changes
	 * /
	get targets(): Array<() => void> {
		return [...this.sinks]
	} */
}