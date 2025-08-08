import {
	flush,
	notify,
	observe,
	subscribe,
	type Watcher,
	watch,
} from './scheduler'
import { UNSET } from './signal'
import {
	CircularDependencyError,
	isFunction,
	isObjectOfType,
	toError,
} from './util'

/* === Types === */

type Computed<T extends {}> = {
	[Symbol.toStringTag]: 'Computed'
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
const computed = <T extends {}>(fn: ComputedCallback<T>): Computed<T> => {
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
		if (!Object.is(v, value)) {
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
	const mark = watch(() => {
		dirty = true
		controller?.abort('Aborted because source signal changed')
		if (watchers.size) notify(watchers)
		else mark.cleanup()
	})

	// Called when requested by dependencies (pull)
	const compute = () =>
		observe(() => {
			if (computing) throw new CircularDependencyError('computed')
			changed = false
			if (isFunction(fn) && fn.constructor.name === 'AsyncFunction') {
				if (controller) return value // return current value until promise resolves
				controller = new AbortController()
				controller.signal.addEventListener(
					'abort',
					() => {
						computing = false
						controller = undefined
						compute() // retry
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
				if (e instanceof DOMException && e.name === 'AbortError') nil()
				else err(e)
				computing = false
				return
			}
			if (result instanceof Promise) result.then(settle(ok), settle(err))
			else if (null == result || UNSET === result) nil()
			else ok(result)
			computing = false
		}, mark)

	const c: Computed<T> = {
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
	return c
}

/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
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
	computed,
	isComputed,
	isComputedCallback,
	type Computed,
	type ComputedCallback,
}
