import { isEqual } from './diff'
import { CircularDependencyError } from './errors'
import {
	createWatcher,
	flush,
	notify,
	observe,
	subscribe,
	type Watcher,
} from './system'
import {
	isAbortError,
	isAsyncFunction,
	isFunction,
	isObjectOfType,
	toError,
	UNSET,
} from './util'

/* === Types === */

type Computed<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Computed'
	get(): T
}
type ComputedCallback<T extends {} & { then?: undefined }> =
	| ((abort: AbortSignal) => Promise<T>)
	| (() => T)

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} fn - computation callback function
 * @returns {Computed<T>} - Computed signal
 */
const createComputed = <T extends {}>(fn: ComputedCallback<T>): Computed<T> => {
	const watchers: Set<Watcher> = new Set()

	// Internal state
	let value: T = UNSET
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
		<T>(settleFn: (arg: T) => void) =>
		(arg: T) => {
			computing = false
			controller = undefined
			settleFn(arg)
			if (changed) notify(watchers)
		}

	// Own watcher: called when notified from sources (push)
	const mark = createWatcher(() => {
		dirty = true
		controller?.abort()
		if (watchers.size) notify(watchers)
		else mark.cleanup()
	})
	mark.off(() => {
		controller?.abort()
	})

	// Called when requested by dependencies (pull)
	const compute = () =>
		observe(() => {
			if (computing) throw new CircularDependencyError('computed')
			changed = false
			if (isAsyncFunction(fn)) {
				// Return current value until promise resolves
				if (controller) return value
				controller = new AbortController()
				controller.signal.addEventListener(
					'abort',
					() => {
						computing = false
						controller = undefined

						// Retry computation with updated state
						compute()
					},
					{
						once: true,
					},
				)
			}
			let result: T | Promise<T>
			computing = true
			try {
				result = controller ? fn(controller.signal) : (fn as () => T)()
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
		}, mark)

	return {
		[Symbol.toStringTag]: TYPE_COMPUTED,

		/**
		 * Get the current value of the computed
		 *
		 * @since 0.9.0
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
}

/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed signal, false otherwise
 */
const isComputed = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Computed<T> => isObjectOfType(value, TYPE_COMPUTED)

/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
const isComputedCallback = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is ComputedCallback<T> => isFunction(value) && value.length < 2

/* === Exports === */

export {
	TYPE_COMPUTED,
	createComputed,
	isComputed,
	isComputedCallback,
	type Computed,
	type ComputedCallback,
}
