import { isEqual } from '../diff'
import {
	InvalidHookError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	type Cleanup,
	HOOK_WATCH,
	type HookCallback,
	notifyWatchers,
	subscribeActiveWatcher,
	UNSET,
	type Watcher,
	type WatchHook,
} from '../system'
import { isObjectOfType } from '../util'

/* === Constants === */

const TYPE_STATE = 'State' as const

/* === Class === */

/**
 * Create a new state signal.
 *
 * @since 0.17.0
 */
class State<T extends {}> {
	#watchers = new Set<Watcher>()
	#value: T
	#watchHookCallbacks: Set<HookCallback> | undefined

	/**
	 * Create a new state signal.
	 *
	 * @param {T} initialValue - Initial value of the state
	 * @throws {NullishSignalValueError} - If the initial value is null or undefined
	 * @throws {InvalidSignalValueError} - If the initial value is invalid
	 */
	constructor(initialValue: T) {
		validateSignalValue(TYPE_STATE, initialValue)

		this.#value = initialValue
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
		subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks)

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
		if (this.#watchers.size) notifyWatchers(this.#watchers)

		// Setting to UNSET clears the watchers so the signal can be garbage collected
		if (UNSET === this.#value) this.#watchers.clear()
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

	/**
	 * Register a callback to be called when HOOK_WATCH is triggered.
	 *
	 * @param {WatchHook} type - The type of hook to register the callback for; only HOOK_WATCH is supported
	 * @param {HookCallback} callback - The callback to register
	 * @returns {Cleanup} - A function to unregister the callback
	 */
	on(type: WatchHook, callback: HookCallback): Cleanup {
		if (type === HOOK_WATCH) {
			this.#watchHookCallbacks ||= new Set()
			this.#watchHookCallbacks.add(callback)
			return () => {
				this.#watchHookCallbacks?.delete(callback)
			}
		}
		throw new InvalidHookError(this.constructor.name, type)
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
