import { type Signal, type ComputedCallback, match, UNSET } from './signal'
import {
	CircularDependencyError,
	isAbortError,
	isAsyncFunction,
	isFunction,
	isObjectOfType,
	isPromise,
	toError,
} from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { type TapMatcher, type EffectMatcher, effect } from './effect'

/* === Types === */

export type ComputedMatcher<S extends Signal<{}>[], R extends {}> = {
	signals: S
	abort?: AbortSignal
	ok: (
		...values: {
			[K in keyof S]: S[K] extends Signal<infer T> ? T : never
		}
	) => R | Promise<R>
	err?: (...errors: Error[]) => R | Promise<R>
	nil?: () => R | Promise<R>
}

export type Computed<T extends {}> = {
	[Symbol.toStringTag]: 'Computed'
	get(): T
	map<U extends {}>(fn: (v: T) => U | Promise<U>): Computed<U>
	tap(matcher: TapMatcher<T> | ((v: T) => void | (() => void))): () => void
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Private Functions === */

const isEquivalentError = /*#__PURE__*/ (
	error1: Error,
	error2: Error | undefined,
): boolean => {
	if (!error2) return false
	return error1.name === error2.name && error1.message === error2.message
}

/* === Computed Factory === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedMatcher<S, T> | ComputedCallback<T>} matcher - computed matcher or callback
 * @returns {Computed<T>} - Computed signal
 */
export const computed = <T extends {}, S extends Signal<{}>[] = []>(
	matcher: ComputedMatcher<S, T> | ComputedCallback<T>,
): Computed<T> => {
	const watchers: Set<Watcher> = new Set()
	const m = isFunction(matcher)
		? undefined
		: ({
				nil: () => UNSET,
				err: (...errors: Error[]) => {
					if (errors.length > 1) throw new AggregateError(errors)
					else throw errors[0]
				},
				...matcher,
			} as Required<ComputedMatcher<S, T>>)
	const fn = (m ? m.ok : matcher) as ComputedCallback<T>

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
		changed = !isEquivalentError(newError, error)
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
			mark.cleanups.forEach((fn: () => void) => fn())
			mark.cleanups.clear()
		}
	}) as Watcher
	mark.cleanups = new Set()

	// Called when requested by dependencies (pull)
	const compute = () =>
		watch(() => {
			if (computing) throw new CircularDependencyError('computed')
			changed = false
			if (isAsyncFunction(fn)) {
				if (controller) return value // return current value until promise resolves
				controller = new AbortController()
				if (m)
					m.abort =
						m.abort instanceof AbortSignal
							? AbortSignal.any([m.abort, controller.signal])
							: controller.signal
				controller.signal.addEventListener('abort', abort, {
					once: true,
				})
			}
			let result: T | Promise<T>
			computing = true
			try {
				result =
					m && m.signals.length
						? match<S, T>(m)
						: fn(controller?.signal)
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

		/**
		 * Create a computed signal from the current computed signal
		 *
		 * @since 0.9.0
		 * @param {((v: T) => U | Promise<U>)} fn - computed callback
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(fn: (v: T) => U | Promise<U>): Computed<U> =>
			computed({
				signals: [c],
				ok: fn,
			}),

		/**
		 * Case matching for the computed signal with effect callbacks
		 *
		 * @since 0.13.0
		 * @param {TapMatcher<T> | ((v: T) => void | (() => void))} matcher - tap matcher or effect callback
		 * @returns {() => void} - cleanup function for the effect
		 */
		tap: (
			matcher: TapMatcher<T> | ((v: T) => void | (() => void)),
		): (() => void) =>
			effect({
				signals: [c],
				...(isFunction(matcher) ? { ok: matcher } : matcher),
			} as EffectMatcher<[Computed<T>]>),
	}
	return c
}

/* === Helper Functions === */

/**
 * Check if a value is a computed state
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
export const isComputed = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Computed<T> => isObjectOfType(value, TYPE_COMPUTED)
