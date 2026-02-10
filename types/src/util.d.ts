declare function isString(value: unknown): value is string;
declare function isNumber(value: unknown): value is number;
declare function isSymbol(value: unknown): value is symbol;
declare function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isAsyncFunction<T>(fn: unknown): fn is (...args: unknown[]) => Promise<T>;
declare function isSyncFunction<T extends unknown & {
    then?: undefined;
}>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isNonNullObject(value: unknown): value is NonNullable<object>;
declare function isObjectOfType<T>(value: unknown, type: string): value is T;
declare function isRecord<T extends Record<string, unknown>>(value: unknown): value is T;
declare function isRecordOrArray<T extends Record<string | number, unknown> | ReadonlyArray<unknown>>(value: unknown): value is T;
declare function isUniformArray<T>(value: unknown, guard?: (item: T) => item is T & {}): value is T[];
declare function hasMethod<T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string): obj is T & Record<string, (...args: unknown[]) => unknown>;
declare function isAbortError(error: unknown): boolean;
declare function valueString(value: unknown): string;
export { isString, isNumber, isSymbol, isFunction, isAsyncFunction, isSyncFunction, isNonNullObject, isObjectOfType, isRecord, isRecordOrArray, isUniformArray, hasMethod, isAbortError, valueString, };
