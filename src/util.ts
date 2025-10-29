/* === Utility Functions === */

const isFunction = /*#__PURE__*/ <T>(
	fn: unknown,
): fn is (...args: unknown[]) => T => typeof fn === 'function'

const isAsyncFunction = /*#__PURE__*/ <T>(
	fn: unknown,
): fn is (...args: unknown[]) => Promise<T> =>
	isFunction(fn) && fn.constructor.name === 'AsyncFunction'

const isObjectOfType = /*#__PURE__*/ <T>(
	value: unknown,
	type: string,
): value is T => Object.prototype.toString.call(value) === `[object ${type}]`

const isAbortError = /*#__PURE__*/ (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError'

const toError = /*#__PURE__*/ (reason: unknown): Error =>
	reason instanceof Error ? reason : Error(String(reason))

class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency in ${where} detected`)
		this.name = 'CircularDependencyError'
	}
}

/* === Exports === */

export {
	isFunction,
	isAsyncFunction,
	isObjectOfType,
	isAbortError,
	toError,
	CircularDependencyError,
}
