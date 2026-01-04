import { type Guard, InvalidHookError, validateSignalValue } from '../errors'
import {
	type Cleanup,
	HOOK_WATCH,
	type HookCallback,
	notifyWatchers,
	subscribeActiveWatcher,
	type Watcher,
	type WatchHook,
} from '../system'
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
	#watchHookCallbacks: Set<HookCallback> | undefined

	/**
	 * Create a new ref signal.
	 *
	 * @param {T} value - Reference to external object
	 * @param {Guard<T>} guard - Optional guard function to validate the value
	 * @throws {NullishSignalValueError} - If the value is null or undefined
	 * @throws {InvalidSignalValueError} - If the value is invalid
	 */
	constructor(value: T, guard?: Guard<T>) {
		validateSignalValue(TYPE_REF, value, guard)

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
		subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks)

		return this.#value
	}

	/**
	 * Notify watchers of relevant changes in the external reference.
	 */
	notify(): void {
		notifyWatchers(this.#watchers)
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
		throw new InvalidHookError(TYPE_REF, type)
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
