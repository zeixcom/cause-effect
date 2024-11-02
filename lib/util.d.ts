declare const isFunction: (value: unknown) => value is (...args: any[]) => any;
declare const isAsyncFunction: (value: unknown) => value is (...args: any[]) => Promise<any> | PromiseLike<any>;
declare const isError: (value: unknown) => value is Error;
declare const isPromise: (value: unknown) => value is Promise<unknown>;
export { isFunction, isAsyncFunction, isError, isPromise };
