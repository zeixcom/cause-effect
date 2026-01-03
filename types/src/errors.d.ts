import { type MutableSignal } from './signal';
type Guard<T> = (value: unknown) => value is T;
declare class CircularDependencyError extends Error {
    constructor(where: string);
}
declare class DuplicateKeyError extends Error {
    constructor(where: string, key: string, value?: unknown);
}
declare class InvalidCallbackError extends TypeError {
    constructor(where: string, value: unknown);
}
declare class InvalidCollectionSourceError extends TypeError {
    constructor(where: string, value: unknown);
}
declare class InvalidSignalValueError extends TypeError {
    constructor(where: string, value: unknown);
}
declare class NullishSignalValueError extends TypeError {
    constructor(where: string);
}
declare class ReadonlySignalError extends Error {
    constructor(what: string, value: unknown);
}
declare const createError: (reason: unknown) => Error;
declare const validateCallback: (where: string, value: unknown, guard?: (value: unknown) => boolean) => void;
declare const validateSignalValue: (where: string, value: unknown, guard?: (value: unknown) => boolean) => void;
declare const guardMutableSignal: <T extends {}>(what: string, value: unknown, signal: unknown) => signal is MutableSignal<T>;
export { type Guard, CircularDependencyError, DuplicateKeyError, InvalidCallbackError, InvalidCollectionSourceError, InvalidSignalValueError, NullishSignalValueError, ReadonlySignalError, createError, validateCallback, validateSignalValue, guardMutableSignal, };
