declare const isFunction: <T>(value: unknown) => value is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(value: unknown) => value is (...args: unknown[]) => Promise<T> | PromiseLike<T>;
declare const isComputeFunction: <T>(value: unknown) => value is ((old?: T) => T);
declare const isInstanceOf: <T>(type: new (...args: any[]) => T) => (value: unknown) => value is T;
declare const isError: (value: unknown) => value is Error;
declare const isPromise: (value: unknown) => value is Promise<unknown>;
export { isFunction, isAsyncFunction, isComputeFunction, isInstanceOf, isError, isPromise };
