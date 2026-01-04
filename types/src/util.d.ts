declare const isString: (value: unknown) => value is string;
declare const isNumber: (value: unknown) => value is number;
declare const isSymbol: (value: unknown) => value is symbol;
declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isSyncFunction: <T extends unknown & {
    then?: undefined;
}>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isNonNullObject: (value: unknown) => value is NonNullable<object>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isRecord: <T extends Record<string, unknown>>(value: unknown) => value is T;
declare const isRecordOrArray: <T extends Record<string | number, unknown> | ReadonlyArray<unknown>>(value: unknown) => value is T;
declare const isUniformArray: <T>(value: unknown, guard?: (item: T) => item is T & {}) => value is T[];
declare const hasMethod: <T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string) => obj is T & Record<string, (...args: unknown[]) => unknown>;
declare const isAbortError: (error: unknown) => boolean;
declare const valueString: (value: unknown) => string;
export { isString, isNumber, isSymbol, isFunction, isAsyncFunction, isSyncFunction, isNonNullObject, isObjectOfType, isRecord, isRecordOrArray, isUniformArray, hasMethod, isAbortError, valueString, };
