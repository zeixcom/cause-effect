import { isEqual } from './diff'
import { InvalidCallbackError, NullishSignalValueError } from './errors'
import { notify, subscribe, type Watcher } from './system'
import { isFunction, isObjectOfType, UNSET, valueString } from './util'

/* === Types === */

type State<T extends {}> = {
	readonly [Symbol.toStringTag]: 'State'
	get(): T
	set(newValue: T): void
	update(updater: (oldValue: T) => T): void
}

/* === Constants === */

const TYPE_STATE = 'State'

/* === Functions === */

/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
const createState = /*#__PURE__*/ <T extends {}>(initialValue: T): State<T> => {
	if (initialValue == null) throw new NullishSignalValueError('state')

	const watchers: Set<Watcher> = new Set()
	let value: T = initialValue

	const state: State<T> = {
		[Symbol.toStringTag]: TYPE_STATE,

		/**
		 * Get the current value of the state
		 *
		 * @since 0.9.0
		 * @returns {T} - Current value of the state
		 */
		get: (): T => {
			subscribe(watchers)
			return value
		},

		/**
		 * Set a new value of the state
		 *
		 * @since 0.9.0
		 * @param {T} newValue - New value of the state
		 * @returns {void}
		 */
		set: (newValue: T): void => {
			if (newValue == null) throw new NullishSignalValueError('state')
			if (isEqual(value, newValue)) return
			value = newValue
			notify(watchers)

			// Setting to UNSET clears the watchers so the signal can be garbage collected
			if (UNSET === value) watchers.clear()
		},

		/**
		 * Update the state with a new value using a function
		 *
		 * @since 0.10.0
		 * @param {(v: T) => T} updater - Function to update the state
		 * @returns {void}
		 */
		update: (updater: (oldValue: T) => T): void => {
			if (!isFunction(updater))
				throw new InvalidCallbackError(
					'state update',
					valueString(updater),
				)
			state.set(updater(value))
		},
	}

	return state
}

/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
const isState = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is State<T> => isObjectOfType(value, TYPE_STATE)

/* === Exports === */

export { TYPE_STATE, isState, createState, type State }
