/* === Utility Functions === */

const isNumber = /*#__PURE__*/ (value: unknown): value is number =>
	typeof value === 'number'

const isString = /*#__PURE__*/ (value: unknown): value is string =>
	typeof value === 'string'

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

const isPrimitive = /*#__PURE__*/ (value: unknown): boolean =>
	!isObjectOfType(value, 'Object') &&
	!Array.isArray(value) &&
	!isFunction(value)

const hasMethod = /*#__PURE__*/ <
	T extends object & Record<string, (...args: unknown[]) => unknown>,
>(
	obj: T,
	methodName: string,
): obj is T & Record<string, (...args: unknown[]) => unknown> =>
	methodName in obj && isFunction(obj[methodName])

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
	isNumber,
	isString,
	isFunction,
	isAsyncFunction,
	isObjectOfType,
	isPrimitive,
	hasMethod,
	isAbortError,
	toError,
	CircularDependencyError,
}
