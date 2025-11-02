declare const isNumber: (value: unknown) => value is number;
declare const isString: (value: unknown) => value is string;
declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isPrimitive: (value: unknown) => boolean;
declare const hasMethod: <T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string) => obj is T & Record<string, (...args: unknown[]) => unknown>;
declare const isAbortError: (error: unknown) => boolean;
declare const toError: (reason: unknown) => Error;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { isNumber, isString, isFunction, isAsyncFunction, isObjectOfType, isPrimitive, hasMethod, isAbortError, toError, CircularDependencyError, };
