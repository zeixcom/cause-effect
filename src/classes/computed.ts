import { isEqual } from '../diff'
import {
	CircularDependencyError,
	createError,
	InvalidHookError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	type Cleanup,
	createWatcher,
	flushPendingReactions,
	HOOK_CLEANUP,
	HOOK_WATCH,
	type HookCallback,
	type HookCallbacks,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
	triggerHook,
	UNSET,
	type Watcher,
	type WatchHook,
} from '../system'
import {
	isAbortError,
	isAsyncFunction,
	isObjectOfType,
	isSyncFunction,
} from '../util'

/* === Types === */

type Computed<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Computed'
	get(): T
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
 */
class Memo<T extends {}> {
	#watchers: Set<Watcher> = new Set()
	#callback: MemoCallback<T>
	#value: T
	#error: Error | undefined
	#dirty = true
	#computing = false
	#watcher: Watcher | undefined
	#hookCallbacks: HookCallbacks = {}

	/**
	 * Create a new memoized signal.
	 *
	 * @param {MemoCallback<T>} callback - Callback function to compute the memoized value
	 * @param {T} [initialValue = UNSET] - Initial value of the signal
	 * @throws {InvalidCallbackError} If the callback is not an sync function
	 * @throws {InvalidSignalValueError} If the initial value is not valid
	 */
	constructor(callback: MemoCallback<T>, initialValue: T = UNSET) {
		validateCallback(this.constructor.name, callback, isMemoCallback)
		validateSignalValue(this.constructor.name, initialValue)

		this.#callback = callback
		this.#value = initialValue
	}

	#getWatcher(): Watcher {
		if (!this.#watcher) {
			// Own watcher: called by notifyWatchers() in upstream signals (push)
			this.#watcher = createWatcher(() => {
				this.#dirty = true
				if (!notifyWatchers(this.#watchers)) this.#watcher?.stop()
			})
			const unwatch = triggerHook(this.#hookCallbacks[HOOK_WATCH])
			this.#watcher.on(HOOK_CLEANUP, () => {
				if (unwatch) unwatch()
				this.#watcher = undefined
			})
		}
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
		subscribeActiveWatcher(this.#watchers)
		flushPendingReactions()

		if (this.#dirty) {
			const watcher = this.#getWatcher()
			trackSignalReads(watcher, () => {
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
			})
		}

		if (this.#error) throw this.#error
		return this.#value
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
			this.#hookCallbacks[HOOK_WATCH] ||= new Set()
			this.#hookCallbacks[HOOK_WATCH].add(callback)
			return () => {
				this.#hookCallbacks[HOOK_WATCH]?.delete(callback)
			}
		}
		throw new InvalidHookError(this.constructor.name, type)
	}
}

/**
 * Create a new task signals that memoizes the result of an asynchronous function.
 *
 * @since 0.17.0
 */
class Task<T extends {}> {
	#watchers: Set<Watcher> = new Set()
	#callback: TaskCallback<T>
	#value: T
	#error: Error | undefined
	#dirty = true
	#computing = false
	#changed = false
	#watcher: Watcher | undefined
	#controller: AbortController | undefined
	#hookCallbacks: HookCallbacks = {}

	/**
	 * Create a new task signal for an asynchronous function.
	 *
	 * @param {TaskCallback<T>} callback - The asynchronous function to compute the memoized value
	 * @param {T} [initialValue = UNSET] - Initial value of the signal
	 * @throws {InvalidCallbackError} If the callback is not an async function
	 * @throws {InvalidSignalValueError} If the initial value is not valid
	 */
	constructor(callback: TaskCallback<T>, initialValue: T = UNSET) {
		validateCallback(this.constructor.name, callback, isTaskCallback)
		validateSignalValue(this.constructor.name, initialValue)

		this.#callback = callback
		this.#value = initialValue
	}

	#getWatcher(): Watcher {
		if (!this.#watcher) {
			// Own watcher: called by notifyWatchers() in upstream signals (push)
			this.#watcher = createWatcher(() => {
				this.#dirty = true
				this.#controller?.abort()
				if (!notifyWatchers(this.#watchers)) this.#watcher?.stop()
			})
			const unwatch = triggerHook(this.#hookCallbacks[HOOK_WATCH])
			this.#watcher.on(HOOK_CLEANUP, () => {
				this.#controller?.abort()
				this.#controller = undefined
				if (unwatch) unwatch()
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
		subscribeActiveWatcher(this.#watchers)
		flushPendingReactions()

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
				if (this.#changed && !notifyWatchers(this.#watchers))
					this.#watcher?.stop()
			}

		const compute = () =>
			trackSignalReads(this.#getWatcher(), () => {
				if (this.#computing) throw new CircularDependencyError('task')
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
						compute()
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
			})

		if (this.#dirty) compute()

		if (this.#error) throw this.#error
		return this.#value
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
			this.#hookCallbacks[HOOK_WATCH] ||= new Set()
			this.#hookCallbacks[HOOK_WATCH].add(callback)
			return () => {
				this.#hookCallbacks[HOOK_WATCH]?.delete(callback)
			}
		}
		throw new InvalidHookError(this.constructor.name, type)
	}
}

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T> | TaskCallback<T>} callback - Computation callback function
 */
const createComputed = <T extends {}>(
	callback: TaskCallback<T> | MemoCallback<T>,
	initialValue: T = UNSET,
) =>
	isAsyncFunction(callback)
		? new Task(callback as TaskCallback<T>, initialValue)
		: new Memo(callback as MemoCallback<T>, initialValue)

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
	type MemoCallback,
	type TaskCallback,
}
