import { isEqual } from '../src/diff'
import {
	CircularDependencyError,
	createError,
	InvalidCallbackError,
	NullishSignalValueError,
} from '../src/errors'
import {
	createWatcher,
	flushPendingReactions,
	notifyWatchers,
	subscribeActiveWatcher,
	UNSET,
	type Watcher,
} from '../src/system'
import {
	isAbortError,
	isAsyncFunction,
	isFunction,
	isObjectOfType,
} from '../src/util'

/* === Types === */

type Computed<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Computed'
	get(): T
}

type ComputedCallback<T extends {} & { then?: undefined }> =
	| ((oldValue: T, abort: AbortSignal) => Promise<T>)
	| ((oldValue: T) => T)

/* === Constants === */

const TYPE_COMPUTED = 'Computed' as const

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} callback - Computation callback function
 * @returns {Computed<T>} - Computed signal
 */
const createComputed = <T extends {}>(
	callback: ComputedCallback<T>,
	initialValue: T = UNSET,
): Computed<T> => {
	if (!isComputedCallback(callback))
		throw new InvalidCallbackError('computed', callback)
	if (initialValue == null) throw new NullishSignalValueError('computed')

	const watchers: Set<Watcher> = new Set()

	// Internal state
	let value: T = initialValue
	let error: Error | undefined
	let controller: AbortController | undefined
	let dirty = true
	let changed = false
	let computing = false

	// Functions to update internal state
	const ok = (v: T): undefined => {
		if (!isEqual(v, value)) {
			value = v
			changed = true
		}
		error = undefined
		dirty = false
	}
	const nil = (): undefined => {
		changed = UNSET !== value
		value = UNSET
		error = undefined
	}
	const err = (e: unknown): undefined => {
		const newError = createError(e)
		changed =
			!error ||
			newError.name !== error.name ||
			newError.message !== error.message
		value = UNSET
		error = newError
	}
	const settle =
		<T>(fn: (arg: T) => void) =>
		(arg: T) => {
			computing = false
			controller = undefined
			fn(arg)
			if (changed) notifyWatchers(watchers)
		}

	// Own watcher: called when notified from sources (push)
	const watcher = createWatcher(
		() => {
			dirty = true
			controller?.abort()
			if (watchers.size) notifyWatchers(watchers)
			else watcher.stop()
		},
		() => {
			if (computing) throw new CircularDependencyError('computed')
			changed = false
			if (isAsyncFunction(callback)) {
				// Return current value until promise resolves
				if (controller) return value
				controller = new AbortController()
				controller.signal.addEventListener(
					'abort',
					() => {
						computing = false
						controller = undefined
						watcher.run() // Retry computation with updated state
					},
					{
						once: true,
					},
				)
			}
			let result: T | Promise<T>
			computing = true
			try {
				result = controller
					? callback(value, controller.signal)
					: (callback as (oldValue: T) => T)(value)
			} catch (e) {
				if (isAbortError(e)) nil()
				else err(e)
				computing = false
				return
			}
			if (result instanceof Promise) result.then(settle(ok), settle(err))
			else if (null == result || UNSET === result) nil()
			else ok(result)
			computing = false
		},
	)
	watcher.onCleanup(() => {
		controller?.abort()
	})

	const computed: Record<PropertyKey, unknown> = {}
	Object.defineProperties(computed, {
		[Symbol.toStringTag]: {
			value: TYPE_COMPUTED,
		},
		get: {
			value: (): T => {
				subscribeActiveWatcher(watchers)
				flushPendingReactions()
				if (dirty) watcher.run()
				if (error) throw error
				return value
			},
		},
	})
	return computed as Computed<T>
}

/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a computed signal, false otherwise
 */
const isComputed = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Computed<T> => isObjectOfType(value, TYPE_COMPUTED)

/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
const isComputedCallback = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is ComputedCallback<T> => isFunction(value) && value.length < 3

/* === Exports === */

export {
	TYPE_COMPUTED,
	createComputed,
	isComputed,
	isComputedCallback,
	type Computed,
	type ComputedCallback,
}
