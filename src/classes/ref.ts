import { type Guard, validateSignalValue } from '../errors'
import { notifyWatchers, subscribeActiveWatcher, type Watcher } from '../system'
import { isObjectOfType } from '../util'

/* === Constants === */

const TYPE_REF = 'Ref'

/* === Class === */

/**
 * Create a new ref signal.
 *
 * @since 0.17.1
 */
class Ref<T extends {}> {
	#watchers = new Set<Watcher>()
	#value: T

	/**
	 * Create a new ref signal.
	 *
	 * @param {T} value - Reference to external object
	 * @param {Guard<T>} guard - Optional guard function to validate the value
	 * @throws {NullishSignalValueError} - If the value is null or undefined
	 * @throws {InvalidSignalValueError} - If the value is invalid
	 */
	constructor(value: T, guard?: Guard<T>) {
		validateSignalValue('ref', value, guard)

		this.#value = value
	}

	get [Symbol.toStringTag](): string {
		return TYPE_REF
	}

	/**
	 * Get the value of the ref signal.
	 *
	 * @returns {T} - Object reference
	 */
	get(): T {
		subscribeActiveWatcher(this.#watchers)
		return this.#value
	}

	/**
	 * Notify watchers of relevant changes in the external reference
	 */
	notify(): void {
		notifyWatchers(this.#watchers)
	}
}

/* === Functions === */

/**
 * Check if the provided value is a Ref instance
 *
 * @since 0.17.1
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Ref instance, false otherwise
 */
const isRef = /*#__PURE__*/ <T extends {}>(value: unknown): value is Ref<T> =>
	isObjectOfType(value, TYPE_REF)

export { TYPE_REF, Ref, isRef }
