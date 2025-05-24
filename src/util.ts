/* === Utility Functions === */

const isFunction = /*#__PURE__*/ <T>(
	value: unknown,
): value is (...args: unknown[]) => T => typeof value === 'function'

const isAsyncFunction = /*#__PURE__*/ <T>(
	value: unknown,
): value is (...args: unknown[]) => Promise<T> =>
	isFunction(value) && value.constructor.name === 'AsyncFunction'

const isObjectOfType = /*#__PURE__*/ <T>(
	value: unknown,
	type: string,
): value is T => Object.prototype.toString.call(value) === `[object ${type}]`

const isError = /*#__PURE__*/ (value: unknown): value is Error =>
	value instanceof Error
const isAbortError = /*#__PURE__*/ (value: unknown): value is DOMException =>
	value instanceof DOMException && value.name === 'AbortError'
const isPromise = /*#__PURE__*/ <T>(value: unknown): value is Promise<T> =>
	value instanceof Promise
const toError = (reason: unknown): Error =>
	isError(reason) ? reason : Error(String(reason))

class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency in ${where} detected`)
		return this
	}
}

/* === Exports === */

export {
	isFunction,
	isAsyncFunction,
	isObjectOfType,
	isError,
	isAbortError,
	isPromise,
	toError,
	CircularDependencyError,
}
