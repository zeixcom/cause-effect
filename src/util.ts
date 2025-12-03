/* === Constants === */

// biome-ignore lint/suspicious/noExplicitAny: Deliberately using any to be used as a placeholder value in any signal
const UNSET: any = Symbol()

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

const validArrayIndexes = /*#__PURE__*/ (
	keys: Array<PropertyKey>,
): number[] | null => {
	if (!keys.length) return null
	const indexes = keys.map(k =>
		isString(k) ? parseInt(k, 10) : isNumber(k) ? k : NaN,
	)
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

const arrayToRecord = /*#__PURE__*/ <T>(array: T[]): Record<string, T> => {
	const record: Record<string, T> = {}
	for (let i = 0; i < array.length; i++) record[String(i)] = array[i]
	return record
}

const recordToArray = /*#__PURE__*/ <T>(
	record: Record<string | number, T>,
): Record<string, T> | T[] => {
	const indexes = validArrayIndexes(Object.keys(record))
	if (indexes === null) return record

	const array: T[] = []
	for (const index of indexes) array.push(record[String(index)])
	return array
}

const valueString = /*#__PURE__*/ (value: unknown): string =>
	isString(value)
		? `"${value}"`
		: !!value && typeof value === 'object'
			? JSON.stringify(value)
			: String(value)

/* === Exports === */

export {
	UNSET,
	isString,
	isNumber,
	isSymbol,
	isFunction,
	isAsyncFunction,
	isObjectOfType,
	isRecord,
	isRecordOrArray,
	hasMethod,
	isAbortError,
	toError,
	arrayToRecord,
	recordToArray,
	valueString,
}
