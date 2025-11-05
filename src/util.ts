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

const isRecord = /*#__PURE__*/ <T extends Record<string, unknown>>(
	value: unknown,
): value is T => isObjectOfType(value, 'Object')

const arrayToRecord = /*#__PURE__*/ <T extends {}>(
	array: T[],
): Record<string, T> => {
	const record: Record<string, T> = {}
	for (let i = 0; i < array.length; i++) {
		if (i in array) record[String(i)] = array[i]
	}
	return record
}

const validArrayIndexes = /*#__PURE__*/ (keys: string[]): number[] | null => {
	if (!keys.length) return null
	const indexes = keys.map(k => parseInt(k, 10))
	return indexes.every(index => Number.isFinite(index) && index >= 0)
		? indexes.sort((a, b) => a - b)
		: null
}

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
	isFunction,
	isAsyncFunction,
	isObjectOfType,
	isRecord,
	arrayToRecord,
	validArrayIndexes,
	hasMethod,
	isAbortError,
	toError,
	CircularDependencyError,
}
