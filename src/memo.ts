import { UNSET } from './signal'
import { CircularDependencyError } from './util'
import {
	type Cleanup,
	type Watcher,
	flush,
	notify,
	subscribe,
	watch,
} from './scheduler'
import { type TapMatcher, type EffectMatcher, effect } from './effect'
import {
	type Computed,
	type MapCallback,
	TYPE_COMPUTED,
	toComputed,
} from './computed'

/* === Types === */

type MemoCallback<T extends {} & { then?: void }> = () => T

/* === Functions === */

/**
 * Create a derived signal for synchronous computations
 *
 * @since 0.14.0
 * @param {MemoCallback<T>} fn - synchronous computation callback
 * @returns {Computed<T>} - Computed signal
 */
const memo = <T extends {}>(fn: MemoCallback<T>): Computed<T> => {
	const watchers: Set<Watcher> = new Set()

	// Internal state - simplified for sync only
	let value: T = UNSET
	let error: Error | undefined
	let dirty = true
	let computing = false

	// Called when notified from sources (push)
	const mark = (() => {
		dirty = true
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
			if (computing) throw new CircularDependencyError('memo')
			computing = true
			try {
				const result = fn()
				if (null == result || UNSET === result) {
					value = UNSET
					error = undefined
				} else {
					value = result
					dirty = false
					error = undefined
				}
			} catch (e) {
				value = UNSET
				error = e instanceof Error ? e : new Error(String(e))
			} finally {
				computing = false
			}
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

		/**
		 * Create a computed signal from the current computed signal
		 *
		 * @param {MapCallback<T, U>} mapFn - map callback
		 * @returns {Computed<U>} - computed signal
		 */
		map: <U extends {}>(mapFn: MapCallback<T, U>): Computed<U> =>
			toComputed(c, mapFn),

		/**
		 * Case matching for the computed signal with effect callbacks
		 *
		 * @param {TapMatcher<T> | ((v: T) => void | Cleanup)} matcher - tap matcher or effect callback
		 * @returns {Cleanup} - cleanup function for the effect
		 */
		tap: (matcher: TapMatcher<T> | ((v: T) => void | Cleanup)): Cleanup =>
			effect({
				signals: [c],
				...(typeof matcher === 'function' ? { ok: matcher } : matcher),
			} as EffectMatcher<[Computed<T>]>),
	}
	return c
}

/* === Exports === */

export { type MemoCallback, memo }
