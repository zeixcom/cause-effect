import { isEqual } from '../src/diff'
import { InvalidCallbackError, NullishSignalValueError } from '../src/errors'
import {
	notifyWatchers,
	subscribeActiveWatcher,
	UNSET,
	type Watcher,
} from '../src/system'
import { isFunction, isObjectOfType } from '../src/util'

/* === Types === */

type State<T extends {}> = {
	readonly [Symbol.toStringTag]: 'State'
	get(): T
	set(newValue: T): void
	update(updater: (oldValue: T) => T): void
}

/* === Constants === */

const TYPE_STATE = 'State' as const

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

	const setValue = (newValue: T) => {
		if (newValue == null) throw new NullishSignalValueError('state')
		if (isEqual(value, newValue)) return
		value = newValue
		notifyWatchers(watchers)

		// Setting to UNSET clears the watchers so the signal can be garbage collected
		if (UNSET === value) watchers.clear()
	}

	const state: Record<PropertyKey, unknown> = {}
	Object.defineProperties(state, {
		[Symbol.toStringTag]: {
			value: TYPE_STATE,
		},
		get: {
			value: () => {
				subscribeActiveWatcher(watchers)
				return value
			},
		},
		set: {
			value: (newValue: T) => {
				setValue(newValue)
			},
		},
		update: {
			value: (updater: (oldValue: T) => T) => {
				if (!isFunction(updater))
					throw new InvalidCallbackError('state update', updater)

				setValue(updater(value))
			},
		},
	})
	return state as State<T>
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
