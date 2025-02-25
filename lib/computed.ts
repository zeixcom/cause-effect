import { type Watcher, subscribe, notify, watch, UNSET } from "./signal"
import { isAsyncFunction, isError, isPromise } from "./util"

/* === Types === */

export type Computed<T> = {
    [Symbol.toStringTag]: "Computed"
    get: () => T
    map: <U extends {}>(fn: (value: T) => U) => Computed<U>
}

/* === Constants === */

const TYPE_COMPUTED = 'Computed'

/* === Namespace Computed === */

/**
 * Create a derived state from existing states
 * 
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export const computed =  /*#__PURE__*/ <T extends {}>(
	fn: (v?: T) => T | Promise<T>,
	memo?: boolean
): Computed<T> => {
	memo = memo ?? isAsyncFunction(fn)
	const watchers: Watcher[] = []
	let value: T = UNSET
	let error: Error | null = null
	let stale = true

	const mark: Watcher = () => {
		stale = true
		if (memo) notify(watchers)
	}

	const c: Computed<T> = {
		[Symbol.toStringTag]: TYPE_COMPUTED,
		get: () => {
			if (memo) subscribe(watchers)
			if (!memo || stale) watch(() => {
				const handleOk = (v: T) => {
					value = v
					stale = false
					error = null
				}
				const handleErr = (e: unknown) => {
					error = isError(e)
						? e
						: new Error(`Computed function failed: ${e}`)
				}
				try {
					const res = fn(value)
					isPromise(res)
						? res.then(v => {
							handleOk(v)
							notify(watchers)
						}).catch(handleErr)
						: handleOk(res)
				} catch (e) {
					handleErr(e)
				}
			}, mark)
			if (isError(error)) throw error
			return value
		},
		map: <U extends {}>(fn: (value: T) => U): Computed<U> =>
			computed(() => fn(c.get())),
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
export const isComputed = /*#__PURE__*/ <T>(value: unknown): value is Computed<T> =>
	!!value && typeof value === 'object'
		&& (value as { [key in typeof Symbol.toStringTag]: string })[Symbol.toStringTag] === TYPE_COMPUTED