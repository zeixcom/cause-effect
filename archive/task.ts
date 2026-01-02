import { isEqual } from '../src/diff'
import {
	CircularDependencyError,
	InvalidCallbackError,
	NullishSignalValueError,
} from '../src/errors'
import {
	createWatcher,
	flushPendingReactions,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
	type Watcher,
} from '../src/system'
import {
	isAbortError,
	isAsyncFunction,
	isObjectOfType,
	toError,
	UNSET,
} from '../src/util'

/* === Types === */

type Task<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Task'
	get(): T
}

type TaskCallback<T extends {} & { then?: undefined }> = (
	oldValue: T,
	abort: AbortSignal,
) => Promise<T>

/* === Constants === */

const TYPE_TASK = 'Task' as const

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {TaskCallback<T>} callback - Computation callback function
 * @returns {Task<T>} - Computed signal
 */
const createTask = <T extends {}>(
	callback: TaskCallback<T>,
	initialValue: T = UNSET,
): Task<T> => {
	if (!isTaskCallback(callback))
		throw new InvalidCallbackError('task', callback)
	if (initialValue == null) throw new NullishSignalValueError('task')

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
		const newError = toError(e)
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
	const watcher = createWatcher(() => {
		dirty = true
		controller?.abort()
		if (watchers.size) notifyWatchers(watchers)
		else watcher.stop()
	})
	watcher.onCleanup(() => {
		controller?.abort()
	})

	// Called when requested by dependencies (pull)
	const compute = () =>
		trackSignalReads(watcher, () => {
			if (computing) throw new CircularDependencyError('computed')
			changed = false
			// Return current value until promise resolves
			if (controller) return value

			controller = new AbortController()
			controller.signal.addEventListener(
				'abort',
				() => {
					computing = false
					controller = undefined
					compute() // Retry computation with updated state
				},
				{
					once: true,
				},
			)
			let result: T | Promise<T>
			computing = true
			try {
				result = callback(value, controller.signal)
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
		})

	const task: Record<PropertyKey, unknown> = {}
	Object.defineProperties(task, {
		[Symbol.toStringTag]: {
			value: TYPE_TASK,
		},
		get: {
			value: (): T => {
				subscribeActiveWatcher(watchers)
				flushPendingReactions()
				if (dirty) compute()
				if (error) throw error
				return value
			},
		},
	})
	return task as Task<T>
}

/**
 * Check if a value is a task signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a task signal, false otherwise
 */
const isTask = /*#__PURE__*/ <T extends {}>(value: unknown): value is Task<T> =>
	isObjectOfType(value, TYPE_TASK)

/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
const isTaskCallback = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is TaskCallback<T> => isAsyncFunction(value) && value.length < 3

/* === Exports === */

export {
	TYPE_TASK,
	createTask,
	isTask,
	isTaskCallback,
	type Task,
	type TaskCallback,
}
