import type { Signal } from './signal'
import { isAsyncFunction, isObjectOfType } from './util'
import type { Cleanup } from './scheduler'
import type { TapMatcher } from './effect'
import { type MemoCallback, memo } from './memo'
import { type TaskCallback, task } from './task'

/* === Types === */

type MaybePromise<T extends {}> = (T & { then?: void }) | Promise<T>
type MapCallback<T, U extends {} & { then?: void }> = (v: T) => MaybePromise<U>

type Computed<T extends {}> = {
	[Symbol.toStringTag]: 'Computed'
	get(): T
	map<U extends {}>(mapFn: MapCallback<T, U>): Computed<U>
	tap(matcher: TapMatcher<T> | ((v: T) => void | Cleanup)): Cleanup
}
type ComputedCallback<T extends {} & { then?: void }> =
	| TaskCallback<T>
	| MemoCallback<T>

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * This function delegates to either memo() for synchronous computations
 * or task() for asynchronous computations, providing better performance
 * for each case.
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} fn - computation callback function
 * @returns {Computed<T>} - Computed signal
 */
const computed = <T extends {}>(fn: ComputedCallback<T>): Computed<T> =>
	isAsyncFunction<T>(fn) ? task<T>(fn) : memo<T>(fn as MemoCallback<T>)

/**
 * Creates a computed signal based on a map function's internal signal
 *
 * @since 0.14.0
 * @param {Signal<T>} signal - input signal
 * @param {MapCallback<T, U>} fn - map callback function
 * @returns {Computed<U>} - Computed signal with appropriate type
 */
const toComputed = <T extends {}, U extends {}>(
	signal: Signal<T>,
	fn: MapCallback<T, U>,
): Computed<U> =>
	isAsyncFunction<U>(fn)
		? task<U>(() => fn(signal.get()))
		: memo<U>(() => (fn as (v: T) => U)(signal.get()))

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

/* === Exports === */

export {
	type Computed,
	type ComputedCallback,
	type MapCallback,
	TYPE_COMPUTED,
	computed,
	toComputed,
	isComputed,
}
