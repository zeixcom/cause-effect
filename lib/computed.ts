import { match, UNSET, type Signal } from './signal'
import { CircularDependencyError, isAsyncFunction, isFunction, isObjectOfType, isPromise, toError } from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { type TapMatcher, type EffectMatcher, effect } from './effect'

/* === Types === */

export type MapMatcher<T extends {}, R extends {}> = {
	ok: (value: T) => R | Promise<R>
	err?: (error: Error) => R | Promise<R>
	nil?: () => R | Promise<R>
}

export type ComputedMatcher<S extends Signal<{}>[], R extends {}> = {
	signals: S,
	abort?: AbortSignal
	ok: (...values: {
		[K in keyof S]: S[K] extends Signal<infer T> ? T : never
	}) => R | Promise<R>
	err?: (...errors: Error[]) => R | Promise<R>
	nil?: () => R | Promise<R>
}

export type Computed<T extends {}> = {
    [Symbol.toStringTag]: 'Computed'
    get(): T
    map<U extends {}>(matcher: MapMatcher<T, U> | ((v: T) => U)): Computed<U>
	tap(matcher: TapMatcher<T> | ((v: T) => void | (() => void))): () => void
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Private Functions === */

const isEquivalentError = /*#__PURE__*/ (
	error1: Error,
	error2: Error | undefined
): boolean => {
    if (!error2) return false
    return error1.name === error2.name && error1.message === error2.message
}

/* === Computed Factory === */

/**
 * Create a derived signal from existing signals
 * 
 * @since 0.9.0
 * @param {ComputedMatcher<S, T> | (() => T | Promise<T>)} matcher - computed matcher or callback
 * @returns {Computed<T>} - Computed signal
 */
export const computed = <T extends {}, S extends Signal<{}>[] = []>(
	matcher: ComputedMatcher<S, T> | (() => T | Promise<T>),
): Computed<T> => {
	const watchers: Set<Watcher> = new Set()
	const m = (isFunction(matcher)
		? { signals: [] as unknown as S, ok: matcher }
		: matcher)
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let unchanged = false
	let computing = false
	let controller: AbortController | undefined

	// Functions to update internal state
	const ok = (v: T) => {
		if (!Object.is(v, value)) {
			value = v
			dirty = false
			error = undefined
			unchanged = false
		}
	}
	const nil = () => {
		unchanged = (UNSET === value)
		value = UNSET
		error = undefined
	}
	const err = (e: unknown) => {
		const newError = toError(e)
		unchanged = isEquivalentError(newError, error)
		value = UNSET
		error = newError
	}

	// Called when notified from sources (push)
	const mark = (() => {
		dirty = true
		controller?.abort('Aborted because source signal changed')
		if (watchers.size) {
			if (!unchanged) notify(watchers)
		} else {
			mark.cleanups.forEach((fn: () => void) => fn())
			mark.cleanups.clear()
		}
	}) as Watcher
	mark.cleanups = new Set()

	// Called when requested by dependencies (pull)
	const compute = () => watch(() => {
		if (computing) throw new CircularDependencyError('computed')
		unchanged = true
		computing = true
		if (isAsyncFunction(m.ok)) {
			controller = new AbortController()
			m.abort = m.abort instanceof AbortSignal
				? AbortSignal.any([m.abort, controller.signal])
				: controller.signal
		}
		let result: T | Promise<T>
		try {
			result = match<S, T | Promise<T>>(m)
		} catch (e) {
			err(toError(e))
			computing = false
			return
        }
		if (isPromise(result)) {
			nil() // sync
			result.then(v => {
				if (controller?.signal.aborted) {
					err(new DOMException(controller?.signal.reason, 'AbortError'))
					computing = false
					return compute() // retry
				} else {
					ok(v) // async
					notify(watchers)
				}
			}).catch(e => {
				// console.error('Failed to compute:', e)
				err(e)
				notify(watchers)
			})
		} else if (null == result || UNSET === result) {
			nil()
		} else {
			ok(result)
		}
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
		 * @param {MapMatcher<T, U> | ((v: T) => U | Promise<U>)} matcher - computed matcher or callback
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(
			matcher: MapMatcher<T, U> | ((v: T) => U | Promise<U>)
		): Computed<U> =>
			computed({
				signals: [c],
				...(isFunction(matcher) ? { ok: matcher } : matcher)
			} as ComputedMatcher<[Computed<T>], U>),

		/** 
		 * Case matching for the computed signal with effect callbacks
		 * 
		 * @since 0.13.0
		 * @param {TapMatcher<T> | ((v: T) => void | (() => void))} matcher - tap matcher or effect callback
		 * @returns {() => void} - cleanup function for the effect
		 */
		tap: (
			matcher: TapMatcher<T> | ((v: T) => void | (() => void))
		): () => void =>
			effect({
				signals: [c],
				...(isFunction(matcher) ? { ok: matcher } : matcher)
			} as EffectMatcher<[Computed<T>]>)
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
export const isComputed = /*#__PURE__*/ <T extends {}>(value: unknown): value is Computed<T> =>
	isObjectOfType(value, TYPE_COMPUTED)
