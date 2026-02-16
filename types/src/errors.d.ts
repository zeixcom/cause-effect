/**
 * A type guard function that validates whether an unknown value is of type T.
 * Used to ensure type safety when updating signals.
 *
 * @template T - The type to guard against
 * @param value - The value to check
 * @returns True if the value is of type T
 */
type Guard<T extends {}> = (value: unknown) => value is T;
/**
 * Error thrown on re-entrance on an already running function.
 */
declare class CircularDependencyError extends Error {
    /**
     * Constructs a new CircularDependencyError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
/**
 * Error thrown when a signal value is null or undefined.
 */
declare class NullishSignalValueError extends TypeError {
    /**
     * Constructs a new NullishSignalValueError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
/**
 * Error thrown when a signal is read before it has a value.
 */
declare class UnsetSignalValueError extends Error {
    /**
     * Constructs a new UnsetSignalValueError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
/**
 * Error thrown when a signal value is invalid.
 */
declare class InvalidSignalValueError extends TypeError {
    /**
     * Constructs a new InvalidSignalValueError.
     *
     * @param where - The location where the error occurred.
     * @param value - The invalid value.
     */
    constructor(where: string, value: unknown);
}
/**
 * Error thrown when a callback is invalid.
 */
declare class InvalidCallbackError extends TypeError {
    /**
     * Constructs a new InvalidCallbackError.
     *
     * @param where - The location where the error occurred.
     * @param value - The invalid value.
     */
    constructor(where: string, value: unknown);
}
declare class ReadonlySignalError extends Error {
    /**
     * Constructs a new ReadonlySignalError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
/**
 * Error thrown when an API requiring an owner is called without one.
 */
declare class RequiredOwnerError extends Error {
    /**
     * Constructs a new RequiredOwnerError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
declare class DuplicateKeyError extends Error {
    constructor(where: string, key: string, value?: unknown);
}
declare function validateSignalValue<T extends {}>(where: string, value: unknown, guard?: Guard<T>): asserts value is T;
declare function validateReadValue<T extends {}>(where: string, value: T | null | undefined): asserts value is T;
declare function validateCallback(where: string, value: unknown): asserts value is (...args: unknown[]) => unknown;
declare function validateCallback<T>(where: string, value: unknown, guard: (value: unknown) => value is T): asserts value is T;
export { type Guard, CircularDependencyError, NullishSignalValueError, InvalidSignalValueError, UnsetSignalValueError, InvalidCallbackError, ReadonlySignalError, RequiredOwnerError, DuplicateKeyError, validateSignalValue, validateReadValue, validateCallback, };
