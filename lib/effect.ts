
import { Maybe } from "@efflore/flow-sure"
import { isFunction } from "./util"
import { scheduler, type Enqueue } from "./scheduler"
import { reactive } from "./signal"

/* === Types === */

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EffectCallback = (enqueue: Enqueue) => void | (() => void)

/* === Internals === */

// Hold schuduler instance
const { enqueue, cleanup } = scheduler()

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {EffectCallback} fn - callback function to be executed when a state changes
 */
export const effect = (fn: EffectCallback) => {
   const run = () => reactive(
	   () => Maybe.of(fn(enqueue))
		   .guard(isFunction)
		   .map((cleanupFn: () => void) => cleanup(fn, cleanupFn)),
	   run
   )
   run()
}
