import { UNSET } from './signal'
import { CircularDependencyError, isFunction, isObjectOfType, isPromise, toError } from './util'
import { type Watcher, flush, notify, subscribe, watch } from './scheduler'
import { type TapMatcher, type EffectMatcher, effect } from './effect'

/* === Types === */

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
 * @param {() => T | Promise<T>} fn - computed callback
 * @returns {Computed<T>} - Computed signal
 */
export const computed = <T extends {}>(
	fn: () => T | Promise<T>,
): Computed<T> => {
	const watchers: Set<Watcher> = new Set()
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let unchanged = false
	let computing = false

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
		if (!unchanged) notify(watchers)
	}) as Watcher
	mark.cleanups = new Set()

	// Called when requested by dependencies (pull)
	const compute = () => watch(() => {
		if (computing) throw new CircularDependencyError('computed')
		unchanged = true
		computing = true
		let result: T | Promise<T>
		try {
			result = fn()
		} catch (e) {
			err(toError(e))
			computing = false
			return
        }
		if (isPromise(result)) {
			nil() // sync
			result.then(v => {
				ok(v) // async
                notify(watchers)
			}).catch(err)
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
		 * @param {(v: T) => U | Promise<U>} fn - computed callback
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(fn: (v: T) => U | Promise<U>): Computed<U> =>
			computed(() => fn(c.get())),

		/**
		 * Case matching for the computed signal with effect callbacks
		 * 
		 * @since 0.13.0
		 * @param {TapMatcher<[Computed<T>]> | ((v: T) => void | (() => void))} matcher - tap matcher or effect callback
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
