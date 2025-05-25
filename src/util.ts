/* === Utility Functions === */

const isFunction = /*#__PURE__*/ <T>(
	value: unknown,
): value is (...args: unknown[]) => T => typeof value === 'function'

const isObjectOfType = /*#__PURE__*/ <T>(
	value: unknown,
	type: string,
): value is T => Object.prototype.toString.call(value) === `[object ${type}]`

const toError = (reason: unknown): Error =>
	reason instanceof Error ? reason : Error(String(reason))

class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency in ${where} detected`)
		return this
	}
}

/* === Exports === */

export { isFunction, isObjectOfType, toError, CircularDependencyError }
