declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isAbortError: (error: unknown) => boolean;
declare const toError: (reason: unknown) => Error;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { isFunction, isAsyncFunction, isObjectOfType, isAbortError, toError, CircularDependencyError, };
