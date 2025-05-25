declare const isFunction: <T>(value: unknown) => value is (...args: unknown[]) => T;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const toError: (reason: unknown) => Error;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
export { isFunction, isObjectOfType, toError, CircularDependencyError };
