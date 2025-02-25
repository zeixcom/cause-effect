
import { type Signal, UNSET, type Watcher, watch } from "./signal"
import { isError } from "./util"

/* === Types === */

export type EffectCallbacks<T extends {}[]> = {
	ok: (...values: T) => void
	nil?: () => void
	err?: (error: Error) => void
}

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {() => void} fn - callback function to be executed when a state changes
 */
export const effect = <T extends {}[]>(
	signals: [Signal<{}>],
	callbacks: EffectCallbacks<T>,
) => {
	const { ok, nil = () => {}, err = () => {}} = callbacks
	const run: Watcher = () => watch(() => {
		const values = []
		for (const signal of signals) {
			try {
				const value = signal.get()
				if (value === UNSET) {
					nil()
					return
				}
				values.push(value)
			} catch (error) {
				err(isError(error) ? error : new Error(String(error)))
				return
			}
			ok(...values as T)
		}
    }, run)
	run()
}
