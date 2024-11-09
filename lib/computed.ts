import { type Watchers, type Notifier, subscribe, notify, watch } from "./signal"
import { isAsyncFunction, isError, isPromise } from "./util"

/* === Types === */

export type Computed<T> = {
    [Symbol.toStringTag]: "Computed"
    get: () => T
    map: <U>(fn: (value: T) => U) => Computed<U>
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
export const computed =  /*#__PURE__*/ <T>(
	fn: (v?: T) => T | Promise<T>,
	memo?: boolean
): Computed<T> => {
	memo = memo ?? isAsyncFunction(fn)
	const watchers: Watchers = new Set()
	let value: T
	let error: Error | null = null
	let stale = true
	const mark: Notifier = () => {
		stale = true
		if (memo) notify(watchers)
	}
	const compute = (): T | Promise<T> | Error => {
		try {
			return fn(value)
		} catch (e) {
			return isError(e) ? e
				: new Error(`Error during reactive computation: ${e}`)
		}
	}
	const handleOk = (v: T) => {
		stale = false
		value = v
		error = null
	}
	const handleErr = (e: Error) => {
		stale = true
		error = e
	}
	const update = (v: T | Error) =>
		isError(v) ? handleErr(v) : handleOk(v)

	const c: Computed<T> = {
		[Symbol.toStringTag]: TYPE_COMPUTED,
		get: () => {
			subscribe(watchers)
			if (!memo || stale) watch(() => {
				const result = compute()
				isPromise(result)
					? result.then(update).catch(handleErr)
					: update(result)
			}, mark)
			if (isError(error)) throw error
			return value
		},
		map: <U>(fn: (value: T) => U): Computed<U> =>
			computed(() => fn(c.get())),
	}
	return c
}

export const isComputed = /*#__PURE__*/ <T>(value: unknown): value is Computed<T> =>
	!!value && typeof value === 'object'
		&& (value as { [key in typeof Symbol.toStringTag]: string })[Symbol.toStringTag] === TYPE_COMPUTED