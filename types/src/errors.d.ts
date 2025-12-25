declare class CircularDependencyError extends Error {
    constructor(where: string);
}
declare class ForbiddenMethodCallError extends Error {
    constructor(method: string, where: string, reason: string);
}
declare class InvalidCallbackError extends TypeError {
    constructor(where: string, value: unknown);
}
declare class InvalidSignalValueError extends TypeError {
    constructor(where: string, value: unknown);
}
declare class NullishSignalValueError extends TypeError {
    constructor(where: string);
}
declare class StoreIndexRangeError extends RangeError {
    constructor(index: number);
}
declare class StoreKeyExistsError extends Error {
    constructor(key: string, value: unknown);
}
declare class StoreKeyReadonlyError extends Error {
    constructor(key: string, value: unknown);
}
export { CircularDependencyError, ForbiddenMethodCallError, InvalidCallbackError, InvalidSignalValueError, NullishSignalValueError, StoreIndexRangeError, StoreKeyExistsError, StoreKeyReadonlyError, };
