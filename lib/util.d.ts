import { isFunction, isError } from "@efflore/flow-sure/lib/util";
declare const isAsyncFunction: (value: unknown) => value is (...args: any[]) => Promise<any> | PromiseLike<any>;
declare const isPromise: (value: unknown) => value is Promise<unknown>;
export { isFunction, isAsyncFunction, isError, isPromise };
