import { isFunction, isError, isInstanceOf } from "@efflore/flow-sure/lib/util"

/* === Utility Functions === */

const isAsyncFunction = (value: unknown): value is (...args: any[]) => Promise<any> | PromiseLike<any> =>
	isFunction(value) && /^async\s+/.test(value.toString())

const isPromise = isInstanceOf(Promise)

export { isFunction, isAsyncFunction, isError, isPromise }