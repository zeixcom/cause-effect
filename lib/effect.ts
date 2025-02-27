
import { type Signal, UNSET, type Watcher, watch } from "./signal"
import { isFunction, toError } from "./util"

/* === Types === */

export type EffectOkCallback<T extends {}[]> = (...values: T) => void

export type EffectCallbacks<T extends {}[]> = {
	ok: EffectOkCallback<T>
	nil?: () => void
	err?: (...errors: Error[]) => void
}

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {() => void} ok - callback function to be executed when a state changes
 */

export function effect<T extends {}>(
    ok: EffectOkCallback<T[]>,
    ...signals: Signal<T>[]
): void
export function effect<T extends {}>(
    callbacks: EffectCallbacks<T[]>,
    ...signals: Signal<T>[]
): void
export function effect<T extends {}>(
	callbacksOrFn: EffectCallbacks<T[]> | EffectOkCallback<T[]>,
	...signals: Signal<T>[]
): void {
	const callbacks = isFunction(callbacksOrFn)
        ? { ok: callbacksOrFn }
        : callbacksOrFn as EffectCallbacks<T[]>

    const { ok, nil, err } = callbacks

	const run: Watcher = () => watch(() => {
		const values: T[] = []
		const errors: Error[] = []
		let hasUnset = false

		for (const signal of signals) {
			try {
				const value = signal.get()
				if (value === UNSET) hasUnset = true
				values.push(value)
			} catch (error) {
				errors.push(toError(error))
			}
		}
		try {
			if (!hasUnset && !errors.length) ok(...values)
			else if (errors.length && err) err(...errors)
		    else if (hasUnset && nil) nil()
		} catch (error) {
            err?.(toError(error))
		}
    }, run)
	run()
}
