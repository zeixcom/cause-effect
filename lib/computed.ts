import { autorun, autotrack, reactive } from "./signal"
import { isAsyncFunction, isError, isPromise } from "./util"

/* === Types === */

type ComputedValue<T> = T | undefined | Error

/* === Class Computed === */

/**
 * Create a derived state from existing states
 * 
 * @since 0.9.0
 * @param {() => T} fn - compute function to derive state
 * @returns {Computed<T>} result of derived state
 */
export class Computed<T> {
    private sinks: Set<() => void> = new Set()
    private value: T | undefined = undefined
	private error: Error | null = null
    private stale = true
    private memo: boolean = false
	private async: boolean = false

    private constructor(
		private fn: () => ComputedValue<T> | Promise<ComputedValue<T>>,
		memo?: boolean
	) {
        this.async = isAsyncFunction(fn)
        this.memo = memo ?? this.async
    }

    static of<T>(
		fn: () => ComputedValue<T> | Promise<ComputedValue<T>>,
		memo?: boolean
	): Computed<T> {
        return new Computed(fn, memo);
    }

	static isComputed = <T>(value: unknown): value is Computed<T> =>
		value instanceof Computed

    get(): T | undefined | void {
        autotrack(this.sinks);
        if (!this.memo || this.stale) {
            reactive(() => {
				const compute = (): ComputedValue<T> | Promise<ComputedValue<T>> => {
					try {
						return this.fn()
					} catch (e) {
						return isError(e) ? e
							: new Error(`Error during reactive computation: ${e}`)
					}
				}
				const handleMaybe = (v: T | undefined) => {
					this.stale = value !== null
                    this.value = v
                    this.error = null
				}
				const handleErr = (e: Error) => {
                    this.stale = true
                    this.error = e
                }
				const update = (value: ComputedValue<T>) =>
					isError(value)
						? handleErr(value)
						: handleMaybe(value)
				const value = compute()
				isPromise(value)
					? value
						.then(v => update(v))
						.catch(handleErr)
					: update(value)
			},
			() => {
				this.stale = true
				if (this.memo) autorun(this.sinks)
			})
        }
		if (this.error) throw this.error
        return this.value
    }
}