import { ABORT_REASON_CLEANUP, ABORT_REASON_DIRTY } from './computed'
import { type Cleanup, observe, watch } from './scheduler'
import { type Signal, type SignalValues, UNSET } from './signal'
import {
	CircularDependencyError,
	isAbortError,
	isAsyncFunction,
	isFunction,
	toError,
} from './util'

/* === Types === */

// biome-ignore lint/suspicious/noConfusingVoidType: optional Cleanup return type
type MaybeCleanup = Cleanup | undefined | void

type SyncCallback<T extends unknown[]> = (...args: T) => MaybeCleanup
type AsyncCallback<T extends unknown[]> = (
	abort: AbortSignal,
	...args: T
) => Promise<MaybeCleanup>

type EffectMatcher<S extends Signal<unknown & {}>[]> = {
	signals: S
	ok: SyncCallback<S> | AsyncCallback<S>
	err?: SyncCallback<Error[]> | AsyncCallback<Error[]>
	nil?: SyncCallback<[]> | AsyncCallback<[]>
}

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * Callbacks can be synchronous or asynchronous. Async callbacks that return
 * cleanup functions will have their cleanup registered once the promise resolves.
 *
 * Async callbacks receive an AbortSignal as their first parameter, which is automatically
 * aborted when the effect re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - Effect matcher or callback (sync or async)
 * @returns {Cleanup} - Cleanup function for the effect
 */
function effect<S extends Signal<unknown & {}>[]>(
	matcher: EffectMatcher<S> | SyncCallback<[]> | AsyncCallback<[]>,
): Cleanup {
	const {
		signals,
		ok,
		err = console.error,
		nil = () => {},
	} = isAsyncCallback<[]>(matcher)
		? { signals: [], ok: matcher }
		: isSyncCallback<[]>(matcher)
			? { signals: [], ok: matcher }
			: (matcher as EffectMatcher<S>)

	let running = false
	let controller: AbortController | undefined

	const run = watch(() =>
		observe(() => {
			if (running) throw new CircularDependencyError('effect')
			running = true

			// Abort any previous async operations
			controller?.abort(ABORT_REASON_DIRTY)
			controller = undefined

			// Pure part
			const errors: Error[] = []
			let pending = false
			const values = signals.map(signal => {
				try {
					const value = signal.get()
					if (value === UNSET) pending = true
					return value
				} catch (e) {
					errors.push(toError(e))
					return UNSET
				}
			}) as SignalValues<S>

			// Effectful part
			let cleanup: MaybeCleanup | Promise<MaybeCleanup>
			let abort: AbortSignal | undefined
			try {
				// Create AbortController for async callbacks
				if ([ok, nil, err].some(isAsyncFunction))
					controller = new AbortController()
				abort = controller?.signal

				if (pending) {
					cleanup = isAsyncCallback<[]>(nil)
						? nil(abort as AbortSignal)
						: isSyncCallback<[]>(nil)
							? nil()
							: undefined
				} else if (errors.length) {
					cleanup = isAsyncCallback<Error[]>(err)
						? err(abort as AbortSignal, ...errors)
						: isSyncCallback<Error[]>(err)
							? err(...errors)
							: undefined
				} else {
					cleanup = isAsyncCallback<SignalValues<S>>(ok)
						? ok(abort as AbortSignal, ...values)
						: (ok as SyncCallback<SignalValues<S>>)(...values)
				}
			} catch (error) {
				cleanup = isAbortError(error)
					? undefined
					: isAsyncCallback<Error[]>(err)
						? err(abort as AbortSignal, toError(error), ...errors)
						: isSyncCallback<Error[]>(err)
							? err(toError(error), ...errors)
							: undefined
			} finally {
				// Handle both sync and async cleanup
				if (cleanup instanceof Promise) {
					cleanup
						.then(resolvedCleanup => {
							if (isFunction(resolvedCleanup))
								run.off(resolvedCleanup)
						})
						.catch(error => {
							// Use the same error handler as sync errors
							cleanup = isAsyncCallback<Error[]>(err)
								? err(
										abort as AbortSignal,
										toError(error),
										...errors,
									)
								: isSyncCallback<Error[]>(err)
									? err(toError(error), ...errors)
									: undefined
							if (cleanup instanceof Promise)
								cleanup.catch(console.error)
							else if (isFunction(cleanup)) run.off(cleanup)
						})
				} else if (isFunction(cleanup)) {
					run.off(cleanup)
				}
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

const isAsyncCallback = <T extends unknown[]>(
	fn: unknown,
): fn is (abort: AbortSignal, ...args: T) => Promise<MaybeCleanup> =>
	isAsyncFunction(fn)

const isSyncCallback = <T extends unknown[]>(
	fn: unknown,
): fn is (...args: T) => MaybeCleanup => isFunction(fn)

/* === Exports === */

export { type EffectMatcher, type MaybeCleanup, effect }
