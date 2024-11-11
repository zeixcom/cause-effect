
import { type Watcher, watch } from "./signal"

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {() => void} fn - callback function to be executed when a state changes
 */
export const effect = (fn: () => void) => {
	const run: Watcher = () => watch(() => {
        try {
            fn()
        } catch (error) {
            console.error(error)
        }
    }, run)
	run()
}
