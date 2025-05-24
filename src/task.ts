import { UNSET } from './signal'
import {
	CircularDependencyError,
	isAbortError,
	isPromise,
	toError,
} from './util'
import {
	type Cleanup,
	type Watcher,
	flush,
	notify,
	subscribe,
	watch,
} from './scheduler'
import {
	type Computed,
	TYPE_COMPUTED,
} from './computed'

/* === Types === */

/**
 * Callback for async computation tasks
 * This explicitly returns a Promise<T> to differentiate from MemoCallback
 * 
 * @since 0.14.0
 */
type TaskCallback<T extends {}> = (abort: AbortSignal) => Promise<T>

/* === Function === */

/**
 * Create a derived signal that supports asynchronous computations
 *
 * @since 0.14.0
 * @param {TaskCallback<T>} fn - async computation callback
 * @returns {Computed<T>} - Computed signal
 */
const task = <T extends {}>(fn: TaskCallback<T>): Computed<T> => {
	const watchers: Set<Watcher> = new Set()

	// Internal state
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let changed = false
	let computing = false
	let controller: AbortController | undefined

	// Functions to update internal state
	const ok = (v: T) => {
		if (!Object.is(v, value)) {
			value = v
			dirty = false
			error = undefined
			changed = true
		}
	}
	const nil = () => {
		changed = UNSET !== value
		value = UNSET
		error = undefined
	}
	const err = (e: unknown) => {
		const newError = toError(e)
		changed = !(
			error &&
			newError.name === error.name &&
			newError.message === error.message
		)
		value = UNSET
		error = newError
	}
	const resolve = (v: T) => {
		computing = false
		controller = undefined
		ok(v)
		if (changed) notify(watchers)
	}
	const reject = (e: unknown) => {
		computing = false
		controller = undefined
		err(e)
		if (changed) notify(watchers)
	}
	const abort = () => {
		computing = false
		controller = undefined
		compute() // retry
	}

	// Called when notified from sources (push)
	const mark = (() => {
		dirty = true
		controller?.abort('Aborted because source signal changed')
		if (watchers.size) {
			notify(watchers)
		} else {
			mark.cleanups.forEach(fn => fn())
			mark.cleanups.clear()
		}
	}) as Watcher
	mark.cleanups = new Set<Cleanup>()

	// Called when requested by dependencies (pull)
	const compute = () =>
		watch(() => {
			if (computing) throw new CircularDependencyError('task')
			changed = false
			controller = new AbortController()
			controller.signal.addEventListener('abort', abort, {
				once: true,
			})

			let result: T | Promise<T>
			computing = true
			try {
				result = fn(controller.signal)
			} catch (e) {
				if (isAbortError(e)) nil()
				else err(e)
				computing = false
				return
			}
			if (isPromise(result)) result.then(resolve, reject)
			else if (null == result || UNSET === result) nil()
			else ok(result)
			computing = false
		}, mark)

	const c: Computed<T> = {
		[Symbol.toStringTag]: TYPE_COMPUTED,

		/**
		 * Get the current value of the computed
		 *
		 * @returns {T} - current value of the computed
		 */
		get: (): T => {
			subscribe(watchers)
			flush()
			if (dirty) compute()
			if (error) throw error
			return value
		},
	}
	return c
}

/* === Exports === */

export { type TaskCallback, task }
