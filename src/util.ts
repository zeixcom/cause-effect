/* === Utility Functions === */

const isString = /*#__PURE__*/ (value: unknown): value is string =>
	typeof value === 'string'

const isNumber = /*#__PURE__*/ (value: unknown): value is number =>
	typeof value === 'number'

const isSymbol = /*#__PURE__*/ (value: unknown): value is symbol =>
	typeof value === 'symbol'

const isFunction = /*#__PURE__*/ <T>(
	fn: unknown,
): fn is (...args: unknown[]) => T => typeof fn === 'function'

const isAsyncFunction = /*#__PURE__*/ <T>(
	fn: unknown,
): fn is (...args: unknown[]) => Promise<T> =>
	isFunction(fn) && fn.constructor.name === 'AsyncFunction'

const isSyncFunction = /*#__PURE__*/ <T extends unknown & { then?: undefined }>(
	fn: unknown,
): fn is (...args: unknown[]) => T =>
	isFunction(fn) && fn.constructor.name !== 'AsyncFunction'

const isNonNullObject = /*#__PURE__*/ (
	value: unknown,
): value is NonNullable<object> => value != null && typeof value === 'object'

const isObjectOfType = /*#__PURE__*/ <T>(
	value: unknown,
	type: string,
): value is T => Object.prototype.toString.call(value) === `[object ${type}]`

const isRecord = /*#__PURE__*/ <T extends Record<string, unknown>>(
	value: unknown,
): value is T => isObjectOfType(value, 'Object')

const isRecordOrArray = /*#__PURE__*/ <
	T extends Record<string | number, unknown> | ReadonlyArray<unknown>,
>(
	value: unknown,
): value is T => isRecord(value) || Array.isArray(value)

const isUniformArray = <T>(
	value: unknown,
	guard = (item: T): item is T & {} => item != null,
): value is T[] => Array.isArray(value) && value.every(guard)

const hasMethod = /*#__PURE__*/ <
	T extends object & Record<string, (...args: unknown[]) => unknown>,
>(
	obj: T,
	methodName: string,
): obj is T & Record<string, (...args: unknown[]) => unknown> =>
	methodName in obj && isFunction(obj[methodName])

const isAbortError = /*#__PURE__*/ (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError'

const valueString = /*#__PURE__*/ (value: unknown): string =>
	isString(value)
		? `"${value}"`
		: !!value && typeof value === 'object'
			? JSON.stringify(value)
			: String(value)

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
