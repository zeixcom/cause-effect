declare const UNSET: any;
declare const isString: (value: unknown) => value is string;
declare const isNumber: (value: unknown) => value is number;
declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isRecord: <T extends Record<string, unknown>>(value: unknown) => value is T;
declare const isRecordOrArray: <T extends Record<string | number, unknown>>(value: unknown) => value is T;
declare const validArrayIndexes: (keys: Array<PropertyKey>) => number[] | null;
declare const hasMethod: <T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string) => obj is T & Record<string, (...args: unknown[]) => unknown>;
declare const isAbortError: (error: unknown) => boolean;
declare const toError: (reason: unknown) => Error;
declare const recordToArray: <T>(record: Record<string | number, T>) => Record<string, T> | T[];
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { UNSET, isString, isNumber, isFunction, isAsyncFunction, isObjectOfType, isRecord, isRecordOrArray, validArrayIndexes, hasMethod, isAbortError, toError, recordToArray, CircularDependencyError, };
