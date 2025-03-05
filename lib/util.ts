/* === Utility Functions === */

const isFunction = /*#__PURE__*/ <T>(value: unknown): value is (...args: unknown[]) => T =>
    typeof value === 'function'

const isAsyncFunction = /*#__PURE__*/ <T>(value: unknown): value is (...args: unknown[]) => Promise<T> | PromiseLike<T> =>
	isFunction(value) && /^async\s+/.test(value.toString())

const isObjectOfType = /*#__PURE__*/ <T>(value: unknown, type: string): value is T =>
	Object.prototype.toString.call(value) === `[object ${type}]`

const isInstanceOf = /*#__PURE__*/ <T>(type: new (...args: any[]) => T) =>
	(value: unknown): value is T =>
		value instanceof type

const isError = /*#__PURE__*/ isInstanceOf(Error)
const isPromise = /*#__PURE__*/ isInstanceOf(Promise)

const toError = (value: unknown): Error =>
	isError(value) ? value : new Error(String(value))

export {
	isFunction, isAsyncFunction,
	isObjectOfType, isInstanceOf, isError, isPromise, toError
}