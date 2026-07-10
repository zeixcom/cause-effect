/* === Constants === */

const ASYNC_FUNCTION_PROTO = Object.getPrototypeOf(async () => {})

/* === Utility Functions === */

function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T {
	return typeof fn === 'function'
}

function isAsyncFunction<T>(
	fn: unknown,
): fn is (...args: unknown[]) => Promise<T> {
	return isFunction(fn) && Object.getPrototypeOf(fn) === ASYNC_FUNCTION_PROTO
}

function isSyncFunction<T extends unknown & { then?: undefined }>(
	fn: unknown,
): fn is (...args: unknown[]) => T {
	return isFunction(fn) && Object.getPrototypeOf(fn) !== ASYNC_FUNCTION_PROTO
}

/**
 * @deprecated Use `isSignalOfType()` for signal type guards.
 * This function allocates two strings per call and will be removed in a future release.
 */
function isObjectOfType<T>(value: unknown, type: string): value is T {
	return Object.prototype.toString.call(value) === `[object ${type}]`
}

function isSignalOfType<T>(value: unknown, type: string): value is T {
	return (
		value != null &&
		(value as Record<symbol, unknown>)[Symbol.toStringTag] === type
	)
}

function isRecord<T extends Record<string, unknown>>(
	value: unknown,
): value is T {
	return (
		value !== null &&
		typeof value === 'object' &&
		Object.getPrototypeOf(value) === Object.prototype
	)
}

/**
 * @deprecated
 */
function valueString(value: unknown): string {
	if (typeof value === 'string') return `"${value}"`
	if (value != null && typeof value === 'object') {
		// JSON.stringify throws on circular references; fall back to a safe
		// representation so error constructors never mask the original
		// validation failure with a secondary TypeError.
		try {
			return JSON.stringify(value)
		} catch {
			return String(value)
		}
	}
	return String(value)
}

/* === Exports === */

export {
	isAsyncFunction,
	isFunction,
	isObjectOfType,
	isRecord,
	isSignalOfType,
	isSyncFunction,
	valueString,
}
