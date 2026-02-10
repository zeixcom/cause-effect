import {
	isAbortError,
	isAsyncFunction,
	isObjectOfType,
	isSyncFunction,
} from '../../src/util'
import { isEqual } from '../diff'
import {
	CircularDependencyError,
	createError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	createWatcher,
	flush,
	notifyOf,
	registerWatchCallbacks,
	type SignalOptions,
	subscribeTo,
	UNSET,
	type Watcher,
} from '../system'

/* === Types === */

type Computed<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Computed'
	get(): T
}

type ComputedOptions<T extends {}> = SignalOptions<T> & {
	initialValue?: T
}

type MemoCallback<T extends {} & { then?: undefined }> = (oldValue: T) => T

type TaskCallback<T extends {} & { then?: undefined }> = (
	oldValue: T,
	abort: AbortSignal,
) => Promise<T>

/* === Constants === */

const TYPE_COMPUTED = 'Computed' as const

/* === Classes === */

/**
 * Create a new memoized signal for a synchronous function.
 *
 * @since 0.17.0
 * @param {MemoCallback<T>} callback - Callback function to compute the memoized value
 * @param {T} [initialValue = UNSET] - Initial value of the signal
 * @throws {InvalidCallbackError} If the callback is not an sync function
 * @throws {InvalidSignalValueError} If the initial value is not valid
 */
class Memo<T extends {}> {
	#callback: MemoCallback<T>
	#value: T
	#error: Error | undefined
	#dirty = true
	#computing = false
	#watcher: Watcher | undefined

	constructor(callback: MemoCallback<T>, options?: ComputedOptions<T>) {
		validateCallback(this.constructor.name, callback, isMemoCallback)
		const initialValue = options?.initialValue ?? UNSET
		validateSignalValue(this.constructor.name, initialValue, options?.guard)

		this.#callback = callback
		this.#value = initialValue
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	#getWatcher(): Watcher {
		// Own watcher: called by notifyWatchers() in upstream signals (push)
		this.#watcher ||= createWatcher(
			() => {
				this.#dirty = true
				if (!notifyOf(this)) this.#watcher?.stop()
			},
			() => {
				if (this.#computing) throw new CircularDependencyError('memo')

				let result: T
				this.#computing = true
				try {
					result = this.#callback(this.#value)
				} catch (e) {
					// Err track
					this.#value = UNSET
					this.#error = createError(e)
					this.#computing = false
					return
				}

				if (null == result || UNSET === result) {
					// Nil track
					this.#value = UNSET
					this.#error = undefined
				} else {
					// Ok track
					this.#value = result
					this.#error = undefined
					this.#dirty = false
				}
				this.#computing = false
			},
		)
		this.#watcher.onCleanup(() => {
			this.#watcher = undefined
		})

		return this.#watcher
	}

	get [Symbol.toStringTag](): 'Computed' {
		return TYPE_COMPUTED
	}

	/**
	 * Return the memoized value after computing it if necessary.
	 *
	 * @returns {T}
	 * @throws {CircularDependencyError} If a circular dependency is detected
	 * @throws {Error} If an error occurs during computation
	 */
	get(): T {
		subscribeTo(this)
		flush()

		if (this.#dirty) this.#getWatcher().run()
		if (this.#error) throw this.#error
		return this.#value
	}
}

/**
 * Create a new task signals that memoizes the result of an asynchronous function.
 *
 * @since 0.17.0
 * @param {TaskCallback<T>} callback - The asynchronous function to compute the memoized value
 * @param {T} [initialValue = UNSET] - Initial value of the signal
 * @throws {InvalidCallbackError} If the callback is not an async function
 * @throws {InvalidSignalValueError} If the initial value is not valid
 */
class Task<T extends {}> {
	#callback: TaskCallback<T>
	#value: T
	#error: Error | undefined
	#dirty = true
	#computing = false
	#changed = false
	#watcher: Watcher | undefined
	#controller: AbortController | undefined

	constructor(callback: TaskCallback<T>, options?: ComputedOptions<T>) {
		validateCallback(this.constructor.name, callback, isTaskCallback)
		const initialValue = options?.initialValue ?? UNSET
		validateSignalValue(this.constructor.name, initialValue, options?.guard)

		this.#callback = callback
		this.#value = initialValue
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	#getWatcher(): Watcher {
		if (!this.#watcher) {
			// Functions to update internal state
			const ok = (v: T): undefined => {
				if (!isEqual(v, this.#value)) {
					this.#value = v
					this.#changed = true
				}
				this.#error = undefined
				this.#dirty = false
			}
			const nil = (): undefined => {
				this.#changed = UNSET !== this.#value
				this.#value = UNSET
				this.#error = undefined
			}
			const err = (e: unknown): undefined => {
				const newError = createError(e)
				this.#changed =
					!this.#error ||
					newError.name !== this.#error.name ||
					newError.message !== this.#error.message
				this.#value = UNSET
				this.#error = newError
			}
			const settle =
				<T>(fn: (arg: T) => void) =>
				(arg: T) => {
					this.#computing = false
					this.#controller = undefined
					fn(arg)
					if (this.#changed && !notifyOf(this)) this.#watcher?.stop()
				}

			// Own watcher: called by notifyOf() in upstream signals (push)
			this.#watcher = createWatcher(
				() => {
					this.#dirty = true
					this.#controller?.abort()
					if (!notifyOf(this)) this.#watcher?.stop()
				},
				() => {
					if (this.#computing)
						throw new CircularDependencyError('task')
					this.#changed = false

					// Return current value until promise resolves
					if (this.#controller) return this.#value

					this.#controller = new AbortController()
					this.#controller.signal.addEventListener(
						'abort',
						() => {
							this.#computing = false
							this.#controller = undefined

							// Retry computation with updated state
							this.#getWatcher().run()
						},
						{
							once: true,
						},
					)
					let result: Promise<T>
					this.#computing = true
					try {
						result = this.#callback(
							this.#value,
							this.#controller.signal,
						)
					} catch (e) {
						if (isAbortError(e)) nil()
						else err(e)
						this.#computing = false
						return
					}

					if (result instanceof Promise)
						result.then(settle(ok), settle(err))
					else if (null == result || UNSET === result) nil()
					else ok(result)
					this.#computing = false
				},
			)
			this.#watcher.onCleanup(() => {
				this.#controller?.abort()
				this.#controller = undefined
				this.#watcher = undefined
			})
		}

		return this.#watcher
	}

	get [Symbol.toStringTag](): 'Computed' {
		return TYPE_COMPUTED
	}

	/**
	 * Return the memoized value after executing the async function if necessary.
	 *
	 * @returns {T}
	 * @throws {CircularDependencyError} If a circular dependency is detected
	 * @throws {Error} If an error occurs during computation
	 */
	get(): T {
		subscribeTo(this)
		flush()

		if (this.#dirty) this.#getWatcher().run()
		if (this.#error) throw this.#error
		return this.#value
	}
}

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T> | TaskCallback<T>} callback - Computation callback function
 * @param {ComputedOptions<T>} options - Optional configuration
 */
const createComputed = <T extends {}>(
	callback: TaskCallback<T> | MemoCallback<T>,
	options?: ComputedOptions<T>,
) =>
	isAsyncFunction(callback)
		? new Task(callback as TaskCallback<T>, options)
		: new Memo(callback as MemoCallback<T>, options)

/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a computed signal, false otherwise
 */
const isComputed = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Memo<T> => isObjectOfType(value, TYPE_COMPUTED)

/**
 * Check if the provided value is a callback that may be used as input for createSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
const isMemoCallback = /*#__PURE__*/ <T extends {} & { then?: undefined }>(
	value: unknown,
): value is MemoCallback<T> => isSyncFunction(value) && value.length < 2

/**
 * Check if the provided value is a callback that may be used as input for createSignal() to derive a computed state
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
const isTaskCallback = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is TaskCallback<T> => isAsyncFunction(value) && value.length < 3

/* === Exports === */

export {
	TYPE_COMPUTED,
	createComputed,
	isComputed,
	isMemoCallback,
	isTaskCallback,
	Memo,
	Task,
	type Computed,
	type ComputedOptions,
	type MemoCallback,
	type TaskCallback,
}
