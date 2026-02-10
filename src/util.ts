/* === Utility Functions === */

function isString(value: unknown): value is string {
	return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number'
}

function isSymbol(value: unknown): value is symbol {
	return typeof value === 'symbol'
}

function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T {
	return typeof fn === 'function'
}

function isAsyncFunction<T>(
	fn: unknown,
): fn is (...args: unknown[]) => Promise<T> {
	return isFunction(fn) && fn.constructor.name === 'AsyncFunction'
}

function isSyncFunction<T extends unknown & { then?: undefined }>(
	fn: unknown,
): fn is (...args: unknown[]) => T {
	return isFunction(fn) && fn.constructor.name !== 'AsyncFunction'
}

function isNonNullObject(value: unknown): value is NonNullable<object> {
	return value != null && typeof value === 'object'
}

function isObjectOfType<T>(value: unknown, type: string): value is T {
	return Object.prototype.toString.call(value) === `[object ${type}]`
}

function isRecord<T extends Record<string, unknown>>(
	value: unknown,
): value is T {
	return isObjectOfType(value, 'Object')
}

function isRecordOrArray<
	T extends Record<string | number, unknown> | ReadonlyArray<unknown>,
>(value: unknown): value is T {
	return isRecord(value) || Array.isArray(value)
}

function isUniformArray<T>(
	value: unknown,
	guard: (item: T) => item is T & {} = (item): item is T & {} => item != null,
): value is T[] {
	return Array.isArray(value) && value.every(guard)
}

function hasMethod<
	T extends object & Record<string, (...args: unknown[]) => unknown>,
>(
	obj: T,
	methodName: string,
): obj is T & Record<string, (...args: unknown[]) => unknown> {
	return methodName in obj && isFunction(obj[methodName])
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError'
}

function valueString(value: unknown): string {
	return isString(value)
		? `"${value}"`
		: !!value && typeof value === 'object'
			? JSON.stringify(value)
			: String(value)
}

/* === Exports === */

export {
	isString,
	isNumber,
	isSymbol,
	isFunction,
	isAsyncFunction,
	isSyncFunction,
	isNonNullObject,
	isObjectOfType,
	isRecord,
	isRecordOrArray,
	isUniformArray,
	hasMethod,
	isAbortError,
	valueString,
}
