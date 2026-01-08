import { isEqual } from '../diff'
import { validateCallback, validateSignalValue } from '../errors'
import {
	type SignalOptions,
	registerWatchCallbacks,
	notifyOf,
	subscribeTo,
	UNSET,
	unsubscribeAllFrom,
} from '../system'
import { isObjectOfType } from '../util'

/* === Constants === */

const TYPE_STATE = 'State' as const

/* === Class === */

/**
 * Create a new state signal.
 *
 * @since 0.17.0
 * @param {T} initialValue - Initial value of the state
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is invalid
 */
class State<T extends {}> {
	#value: T

	constructor(initialValue: T, options?: SignalOptions<T>) {
		validateSignalValue(TYPE_STATE, initialValue, options?.guard)

		this.#value = initialValue
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	get [Symbol.toStringTag](): string {
		return TYPE_STATE
	}

	/**
	 * Get the current value of the state signal.
	 *
	 * @returns {T} - Current value of the state
	 */
	get(): T {
		subscribeTo(this)
		return this.#value
	}

	/**
	 * Set the value of the state signal.
	 *
	 * @param {T} newValue - New value of the state
	 * @returns {void}
	 * @throws {NullishSignalValueError} - If the initial value is null or undefined
	 * @throws {InvalidSignalValueError} - If the initial value is invalid
	 */
	set(newValue: T): void {
		validateSignalValue(TYPE_STATE, newValue)

		if (isEqual(this.#value, newValue)) return
		this.#value = newValue
		notifyOf(this)

		// Setting to UNSET clears the watchers so the signal can be garbage collected
		if (UNSET === this.#value) unsubscribeAllFrom(this)
	}

	/**
	 * Update the value of the state signal.
	 *
	 * @param {Function} updater - Function that takes the current value and returns the new value
	 * @returns {void}
	 * @throws {InvalidCallbackError} - If the updater function is not a function
	 * @throws {NullishSignalValueError} - If the initial value is null or undefined
	 * @throws {InvalidSignalValueError} - If the initial value is invalid
	 */
	update(updater: (oldValue: T) => T): void {
		validateCallback(`${TYPE_STATE} update`, updater)

		this.set(updater(this.#value))
	}
}

/* === Functions === */

/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a State instance, false otherwise
 */
const isState = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is State<T> => isObjectOfType(value, TYPE_STATE)

/* === Exports === */

export { TYPE_STATE, isState, State }
