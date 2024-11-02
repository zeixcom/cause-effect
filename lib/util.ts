/* === Utility Functions === */

const isFunction = (value: unknown): value is (...args: any[]) => any =>
    typeof value === 'function'

const isAsyncFunction = (value: unknown): value is (...args: any[]) => Promise<any> | PromiseLike<any> =>
	isFunction(value) && /^async\s+/.test(value.toString())

const isInstanceOf = <T>(type: new (...args: any[]) => T) =>
	(value: unknown): value is T =>
		value instanceof type

const isError = isInstanceOf(Error)

const isPromise = isInstanceOf(Promise)

export { isFunction, isAsyncFunction, isError, isPromise }