declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isRecord: <T extends Record<string, unknown>>(value: unknown) => value is T;
declare const arrayToRecord: <T extends {}>(array: T[]) => Record<string, T>;
declare const validArrayIndexes: (keys: string[]) => number[] | null;
declare const hasMethod: <T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string) => obj is T & Record<string, (...args: unknown[]) => unknown>;
declare const isAbortError: (error: unknown) => boolean;
declare const toError: (reason: unknown) => Error;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { isFunction, isAsyncFunction, isObjectOfType, isRecord, arrayToRecord, validArrayIndexes, hasMethod, isAbortError, toError, CircularDependencyError, };
