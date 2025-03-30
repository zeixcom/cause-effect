declare const isFunction: <T>(value: unknown) => value is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(value: unknown) => value is (...args: unknown[]) => Promise<T> | PromiseLike<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isError: (value: unknown) => value is Error;
declare const isAbortError: (value: unknown) => value is DOMException;
declare const isPromise: (value: unknown) => value is Promise<unknown>;
declare const toError: (value: unknown) => Error;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { isFunction, isAsyncFunction, isObjectOfType, isError, isAbortError, isPromise, toError, CircularDependencyError };
