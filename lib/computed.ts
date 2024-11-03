import { subscribe, notify, watch, map } from "./signal"
import { isAsyncFunction, isError, isPromise } from "./util"

/* === Types === */

export interface Computed<T> {
	map: <U>(fn: (value: T) => U) => Computed<U>
}

/* === Class Computed === */

/**
 * Create a derived state from existing states
 * 
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export class Computed<T> {
    private watchers: Set<() => void> = new Set()
    private value!: T
	private error: Error | null = null
    private stale = true
    private memo: boolean = false

    private constructor(private fn: () => T | Promise<T>, memo?: boolean) {
        this.memo = memo ?? isAsyncFunction(fn)
    }

    static of = <T>(fn: () => T | Promise<T>, memo?: boolean): Computed<T> =>
        new Computed(fn, memo)

	static isComputed = <T>(value: unknown): value is Computed<T> =>
		value instanceof Computed

    get(): T {
		const compute = (): T | Error | Promise<T> => {
			try {
				return this.fn()
			} catch (e) {
				return isError(e) ? e
					: new Error(`Error during reactive computation: ${e}`)
			}
		}
		const handleOk = (v: T) => {
			this.stale = false
			this.value = v
			this.error = null
		}
		const handleErr = (e: Error) => {
			this.stale = true
			this.error = e
		}
		const update = (v: T | Error) =>
			isError(v) ? handleErr(v) : handleOk(v)

        subscribe(this.watchers);
        if (!this.memo || this.stale) watch(
			() => {
				const value = compute()
				isPromise(value)
					? value.then(update).catch(handleErr)
					: update(value)
			},
			() => {
				this.stale = true
				if (this.memo) notify(this.watchers)
			}
		)
		if (this.error) throw this.error
        return this.value
    }
}

Computed.prototype.map = map