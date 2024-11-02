
import { isFunction } from "./util"
// import { scheduler, type Enqueue } from "./scheduler"
import { reactive } from "./signal"

/* === Types === */

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EffectCallback = () => void | (() => void)

/* === Internals === */

// Hold schuduler instance
// const { enqueue, cleanup } = scheduler()

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {EffectCallback} fn - callback function to be executed when a state changes
 */
export const effect = (fn: EffectCallback) => {
	const run = () => reactive(
		() => {
			try {
				const cleanupFn = fn() // execute effect
				if (cleanupFn && isFunction(cleanupFn))
					setTimeout(() => cleanupFn(), 0) // run cleanup after current tick
			} catch (error) {
				console.error(error)
			}
		}, 
		run
	)
	run()
}
