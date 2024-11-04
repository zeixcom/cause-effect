/* === Utility Functions === */

const isFunction = /*#__PURE__*/ (value: unknown): value is (...args: any[]) => any =>
    typeof value === 'function'

const isAsyncFunction = /*#__PURE__*/ (value: unknown): value is (...args: any[]) => Promise<any> | PromiseLike<any> =>
	isFunction(value) && /^async\s+/.test(value.toString())

const isInstanceOf = /*#__PURE__*/ <T>(type: new (...args: any[]) => T) =>
	(value: unknown): value is T =>
		value instanceof type

const isError = /*#__PURE__*/ isInstanceOf(Error)
const isPromise = /*#__PURE__*/ isInstanceOf(Promise)

export { isFunction, isAsyncFunction, isInstanceOf, isError, isPromise }