import { isFunction } from "./util";
import { subscribe, notify, map } from "./signal";
import type { Computed } from "./computed";

/* === Types === */

export interface State<T> {
	map: <U>(fn: (value: T) => U) => Computed<U>
}

export type StateUpdater<T> = (old: T) => T

/* === Class State === */

/**
 * Define a reactive state
 * 
 * @since 0.9.0
 * @class State
 */
export class State<T> {
	private watchers: Set<() => void> = new Set()

	private constructor(private value: T) {}

	/**
	 * Create a new state signal
	 * 
	 * @static method of State<T>
	 * @param {T} value - initial value of the state
	 * @returns {State<T>} - new state signal
	 */
	static of<T>(value: T): State<T> {
		return new State(value);
	}

	static isState = (value: unknown): value is State<unknown> =>
			value instanceof State

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
	set(value: T | StateUpdater<T>): void {
		const newValue = isFunction(value) ? value(this.value) : value
		if (Object.is(this.value, newValue)) return
		this.value = newValue
		notify(this.watchers)
	}
}

State.prototype.map = map
