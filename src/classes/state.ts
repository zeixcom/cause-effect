import { isEqual } from '../diff'
import { InvalidCallbackError, NullishSignalValueError } from '../errors'
import { notifyWatchers, subscribeActiveWatcher, type Watcher } from '../system'
import { isFunction, isObjectOfType, UNSET } from '../util'

/* === Constants === */

const TYPE_STATE = 'State' as const

/* === Class  */

/**
 * Create a new state signal
 *
 * @since 0.17.0
 * @param {T} initialValue - Initial value of the state
 * @returns {State<T>} - New state signal
 */
class State<T extends {}> {
	watchers = new Set<Watcher>()
	value: T

	constructor(initialValue: T) {
		if (initialValue == null) throw new NullishSignalValueError('state')

		this.value = initialValue
	}

	get [Symbol.toStringTag]() {
		return TYPE_STATE
	}

	get(): T {
		subscribeActiveWatcher(this.watchers)
		return this.value
	}

	set(newValue: T) {
		if (newValue == null) throw new NullishSignalValueError('state')

		if (isEqual(this.value, newValue)) return
		this.value = newValue
		notifyWatchers(this.watchers)

		// Setting to UNSET clears the watchers so the signal can be garbage collected
		if (UNSET === this.value) this.watchers.clear()
	}

	update(updater: (oldValue: T) => T) {
		if (!isFunction(updater))
			throw new InvalidCallbackError('state update', updater)

		this.set(updater(this.value))
	}
}

/* === Functions === */

/**
 * Factory function to create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - Initial value of the state
 * @returns {State<T>} - New state signal
 */
const createState = <T extends {}>(initialValue: T): State<T> =>
	new State(initialValue)

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

export { TYPE_STATE, createState, isState, State }
