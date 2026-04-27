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
 * @deprecated Use Array.isArray(value) && value.every(guard) instead.
 */
function isUniformArray<T>(
	value: unknown,
	guard: (item: T) => item is T & {} = (item): item is T & {} => item != null,
): value is T[] {
	return Array.isArray(value) && value.every(guard)
}

/**
 * @deprecated
 */
function valueString(value: unknown): string {
	return typeof value === 'string'
		? `"${value}"`
		: !!value && typeof value === 'object'
			? JSON.stringify(value)
			: String(value)
}

/* === Exports === */

export {
	isFunction,
	isAsyncFunction,
	isSyncFunction,
	isObjectOfType,
	isSignalOfType,
	isRecord,
	isUniformArray,
	valueString,
}
