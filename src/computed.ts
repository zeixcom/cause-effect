import { isAsyncFunction, isObjectOfType } from './util'
import { type MemoCallback, memo } from './memo'
import { type TaskCallback, task } from './task'

/* === Types === */

type Computed<T extends {}> = {
	[Symbol.toStringTag]: 'Computed'
	get(): T
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
	TYPE_COMPUTED,
	computed,
	isComputed,
}
