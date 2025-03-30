/* === Utility Functions === */

const isFunction = /*#__PURE__*/ <T>(value: unknown): value is (...args: unknown[]) => T =>
    typeof value === 'function'

const isAsyncFunction = /*#__PURE__*/ <T>(value: unknown): value is (...args: unknown[]) => Promise<T> | PromiseLike<T> =>
	isFunction(value) && value.constructor.name === 'AsyncFunction'

const isObjectOfType = /*#__PURE__*/ <T>(value: unknown, type: string): value is T =>
	Object.prototype.toString.call(value) === `[object ${type}]`

const isError = /*#__PURE__*/ (value: unknown): value is Error =>
	value instanceof Error
const isAbortError = /*#__PURE__*/ (value: unknown): value is DOMException =>
	value instanceof DOMException && value.name === 'AbortError'
const isPromise = /*#__PURE__*/ (value: unknown): value is Promise<unknown> =>
	value instanceof Promise

const toError = (value: unknown): Error =>
	isError(value) ? value : Error(String(value))

class CircularDependencyError extends Error {
	constructor(where: string) {
        super(`Circular dependency in ${where} detected`)
		return this
    }
}

export {
	isFunction, isAsyncFunction,
	isObjectOfType, isError, isAbortError, isPromise, toError,
	CircularDependencyError
}