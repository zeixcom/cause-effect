declare class CircularDependencyError extends Error {
    constructor(where: string);
}
declare class InvalidSignalValueError extends TypeError {
    constructor(where: string, value: string);
}
declare class NullishSignalValueError extends TypeError {
    constructor(where: string);
}
declare class StoreKeyExistsError extends Error {
    constructor(key: string, value: string);
}
declare class StoreKeyRangeError extends RangeError {
    constructor(index: number);
}
declare class StoreKeyReadonlyError extends Error {
    constructor(key: string, value: string);
}
export { CircularDependencyError, InvalidSignalValueError, NullishSignalValueError, StoreKeyExistsError, StoreKeyRangeError, StoreKeyReadonlyError, };
