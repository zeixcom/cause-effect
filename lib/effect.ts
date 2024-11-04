
import { isFunction } from "./util"
import { type Notifier, watch } from "./signal"

/* === Types === */

export type EffectCallback = () => void | (() => void)

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {EffectCallback} fn - callback function to be executed when a state changes
 */
export const effect = (fn: EffectCallback) => {
	const run: Notifier = () => watch(() => {
        try {
            const cleanupFn = fn()
            if (isFunction(cleanupFn)) setTimeout(cleanupFn)
        } catch (error) {
            console.error(error)
        }
    }, run)
	run()
}
