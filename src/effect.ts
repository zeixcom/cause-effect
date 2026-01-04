import { CircularDependencyError, InvalidCallbackError } from './errors'
import {
	type Cleanup,
	createWatcher,
	HOOK_CLEANUP,
	type MaybeCleanup,
	trackSignalReads,
} from './system'
import { isAbortError, isAsyncFunction, isFunction } from './util'

/* === Types === */

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
const createEffect = (callback: EffectCallback): Cleanup => {
	if (!isFunction(callback) || callback.length > 1)
		throw new InvalidCallbackError('effect', callback)

	const isAsync = isAsyncFunction(callback)
	let running = false
	let controller: AbortController | undefined

	const watcher = createWatcher(() =>
		trackSignalReads(watcher, () => {
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
								watcher.on(HOOK_CLEANUP, cleanup)
						})
						.catch(error => {
							if (!isAbortError(error))
								console.error(
									'Error in async effect callback:',
									error,
								)
						})
				} else {
					cleanup = callback()
					if (isFunction(cleanup)) watcher.on(HOOK_CLEANUP, cleanup)
				}
			} catch (error) {
				if (!isAbortError(error))
					console.error('Error in effect callback:', error)
			}

			running = false
		}),
	)

	watcher()
	return () => {
		controller?.abort()
		try {
			watcher.stop()
		} catch (error) {
			console.error('Error in effect cleanup:', error)
		}
	}
}

/* === Exports === */

export { type MaybeCleanup, type EffectCallback, createEffect }
