import {
	CircularDependencyError,
	createError,
	InvalidCallbackError,
	NullishSignalValueError,
} from '../src/errors'
import {
	createWatcher,
	flushPendingReactions,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
	UNSET,
	type Watcher,
} from '../src/system'
import { isObjectOfType, isSyncFunction } from '../src/util'

/* === Types === */

type Memo<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Memo'
	get(): T
}

type MemoCallback<T extends {} & { then?: undefined }> = (oldValue: T) => T

/* === Constants === */

const TYPE_MEMO = 'Memo' as const

/* === Functions === */

/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T>} callback - Computation callback function
 * @returns {Memo<T>} - Computed signal
 */
const createMemo = <T extends {}>(
	callback: MemoCallback<T>,
	initialValue: T = UNSET,
): Memo<T> => {
	if (!isMemoCallback(callback))
		throw new InvalidCallbackError('memo', callback)
	if (initialValue == null) throw new NullishSignalValueError('memo')

	const watchers: Set<Watcher> = new Set()

	// Internal state
	let value: T = initialValue
	let error: Error | undefined
	let dirty = true
	let computing = false

	// Own watcher: called when notified from sources (push)
	const watcher = createWatcher(() => {
		dirty = true
		if (watchers.size) notifyWatchers(watchers)
		else watcher.stop()
	})

	// Called when requested by dependencies (pull)
	const compute = () =>
		trackSignalReads(watcher, () => {
			if (computing) throw new CircularDependencyError('memo')
			let result: T
			computing = true
			try {
				result = callback(value)
			} catch (e) {
				// Err track
				value = UNSET
				error = createError(e)
				computing = false
				return
			}

			if (null == result || UNSET === result) {
				// Nil track
				value = UNSET
				error = undefined
			} else {
				// Ok track
				value = result
				error = undefined
				dirty = false
			}
			computing = false
		})

	const memo: Record<PropertyKey, unknown> = {}
	Object.defineProperties(memo, {
		[Symbol.toStringTag]: {
			value: TYPE_MEMO,
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
	return memo as Memo<T>
}

/**
 * Check if a value is a memoized signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a memo signal, false otherwise
 */
const isMemo = /*#__PURE__*/ <T extends {}>(value: unknown): value is Memo<T> =>
	isObjectOfType(value, TYPE_MEMO)

/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
const isMemoCallback = /*#__PURE__*/ <T extends {} & { then?: undefined }>(
	value: unknown,
): value is MemoCallback<T> => isSyncFunction(value) && value.length < 2

/* === Exports === */

export {
	TYPE_MEMO,
	createMemo,
	isMemo,
	isMemoCallback,
	type Memo,
	type MemoCallback,
}
