import { validateSignalValue } from '../errors'
import {
	notifyOf,
	registerWatchCallbacks,
	type SignalOptions,
	subscribeTo,
} from '../system'
import { isObjectOfType } from '../../src/util'

/* === Constants === */

const TYPE_REF = 'Ref'

/* === Class === */

/**
 * Create a new ref signal.
 *
 * @since 0.17.1
 * @param {T} value - Reference to external object
 * @param {Guard<T>} guard - Optional guard function to validate the value
 * @throws {NullishSignalValueError} - If the value is null or undefined
 * @throws {InvalidSignalValueError} - If the value is invalid
 */
class Ref<T extends {}> {
	#value: T

	constructor(value: T, options?: SignalOptions<T>) {
		validateSignalValue(TYPE_REF, value, options?.guard)

		this.#value = value
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
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
		subscribeTo(this)
		return this.#value
	}

	/**
	 * Notify watchers of relevant changes in the external reference.
	 */
	notify(): void {
		notifyOf(this)
	}
}

/* === Functions === */

/**
 * Check if the provided value is a Ref instance
 *
 * @since 0.17.1
 * @param {unknown} value - Value to check
 * @returns {boolean} - Whether the value is a Ref instance
 */
const isRef = /*#__PURE__*/ <T extends {}>(value: unknown): value is Ref<T> =>
	isObjectOfType(value, TYPE_REF)

export { TYPE_REF, Ref, isRef }
