import { ABORT_REASON_CLEANUP, ABORT_REASON_DIRTY } from './computed'
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

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * The callback can be synchronous or asynchronous. Async callbacks receive
 * an AbortSignal parameter, which is automatically aborted when the effect
 * re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {() => MaybeCleanup} callback - Synchronous effect callback
 * @returns {Cleanup} - Cleanup function for the effect
 */
function effect(callback: () => MaybeCleanup): Cleanup
function effect(
	callback: (abort: AbortSignal) => Promise<MaybeCleanup>,
): Cleanup
function effect(
	callback:
		| (() => MaybeCleanup)
		| ((abort: AbortSignal) => Promise<MaybeCleanup>),
): Cleanup {
	const isAsync = isAsyncFunction<MaybeCleanup>(callback)
	let running = false
	let controller: AbortController | undefined

	const run = watch(() =>
		observe(() => {
			if (running) throw new CircularDependencyError('effect')
			running = true

			// Abort any previous async operations
			controller?.abort(ABORT_REASON_DIRTY)
			controller = undefined

			let cleanup: MaybeCleanup | Promise<MaybeCleanup>

			try {
				if (isAsync) {
					// Create AbortController for async callback
					controller = new AbortController()
					callback(controller.signal)
						.then(cleanup => {
							if (isFunction(cleanup)) run.off(cleanup)
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
		controller?.abort(ABORT_REASON_CLEANUP)
		run.cleanup()
	}
}

/* === Exports === */

export { type MaybeCleanup, effect }
