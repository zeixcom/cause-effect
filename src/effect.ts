import { type Cleanup, observe, watch } from './scheduler'
import {
	CircularDependencyError,
	isAbortError,
	isAsyncFunction,
	isFunction,
} from './util'

/* === Types === */

// biome-ignore lint/suspicious/noConfusingVoidType: optional Cleanup return type
type MaybeCleanup = Cleanup | undefined | void

type EffectCallback =
	| (() => MaybeCleanup)
	| ((abort: AbortSignal) => Promise<MaybeCleanup>)

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * The callback can be synchronous or asynchronous. Async callbacks receive
 * an AbortSignal parameter, which is automatically aborted when the effect
 * re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectCallback} callback - Synchronous or asynchronous effect callback
 * @returns {Cleanup} - Cleanup function for the effect
 */
const effect = (callback: EffectCallback): Cleanup => {
	const isAsync = isAsyncFunction<MaybeCleanup>(callback)
	let running = false
	let controller: AbortController | undefined

	const run = watch(() =>
		observe(() => {
			if (running) throw new CircularDependencyError('effect')
			running = true

			// Abort any previous async operations
			controller?.abort()
			controller = undefined

			let cleanup: MaybeCleanup | Promise<MaybeCleanup>

			try {
				if (isAsync) {
					// Create AbortController for async callback
					controller = new AbortController()
					const currentController = controller
					callback(controller.signal)
						.then(cleanup => {
							// Only register cleanup if this is still the current controller
							if (
								isFunction(cleanup) &&
								controller === currentController
							)
								run.off(cleanup)
						})
						.catch(error => {
							if (!isAbortError(error))
								console.error('Async effect error:', error)
						})
				} else {
					cleanup = (callback as () => MaybeCleanup)()
					if (isFunction(cleanup)) run.off(cleanup)
				}
			} catch (error) {
				if (!isAbortError(error))
					console.error('Effect callback error:', error)
			}

			running = false
		}, run),
	)

	run()
	return () => {
		controller?.abort()
		run.cleanup()
	}
}

/* === Exports === */

export { type MaybeCleanup, type EffectCallback, effect }
