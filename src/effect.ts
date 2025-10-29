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

type SyncOkCallback<S extends Record<string, Signal<unknown & {}>>> = (
	values: SignalValues<S>,
) => MaybeCleanup
type AsyncOkCallback<S extends Record<string, Signal<unknown & {}>>> = (
	values: SignalValues<S>,
	abort: AbortSignal,
) => Promise<MaybeCleanup>

type SyncErrCallback = (errors: readonly Error[]) => MaybeCleanup
type AsyncErrCallback = (
	errors: readonly Error[],
	abort: AbortSignal,
) => Promise<MaybeCleanup>

type SyncNilCallback = () => MaybeCleanup
type AsyncNilCallback = (abort: AbortSignal) => Promise<MaybeCleanup>

type EffectMatcher<S extends Record<string, Signal<unknown & {}>>> = {
	signals: S
	ok?: SyncOkCallback<S> | AsyncOkCallback<S>
	err?: SyncErrCallback | AsyncErrCallback
	nil?: SyncNilCallback | AsyncNilCallback
}

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * Callbacks can be synchronous or asynchronous. Async callbacks that return
 * cleanup functions will have their cleanup registered once the promise resolves.
 *
 * Async callbacks receive an AbortSignal as their second parameter,
 * which is automatically aborted when the effect re-runs or is cleaned up,
 * preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - Effect matcher with sync callbacks
 * @returns {Cleanup} - Cleanup function for the effect
 */
function effect<S extends Record<string, Signal<unknown & {}>>>(
	matcher: EffectMatcher<S>,
): Cleanup
function effect(callback: () => MaybeCleanup): Cleanup
function effect(
	callback: (abort: AbortSignal) => Promise<MaybeCleanup>,
): Cleanup
function effect<S extends Record<string, Signal<unknown & {}>>>(
	matcherOrCallback:
		| EffectMatcher<S>
		| (() => MaybeCleanup)
		| ((abort: AbortSignal) => Promise<MaybeCleanup>),
): Cleanup {
	const isAsyncCallback = isAsyncFunction<MaybeCleanup>(matcherOrCallback),
		isSyncCallback = isFunction(matcherOrCallback)

	// Extract configuration with proper typing
	const signals: S =
		isSyncCallback || isAsyncCallback
			? ({} as S)
			: (matcherOrCallback as EffectMatcher<S>).signals
	const ok = isSyncCallback
		? (matcherOrCallback as SyncOkCallback<S>)
		: isAsyncCallback
			? (matcherOrCallback as AsyncOkCallback<S>)
			: (matcherOrCallback as EffectMatcher<S>).ok
	const err = (matcherOrCallback as EffectMatcher<S>).err
		? (matcherOrCallback as EffectMatcher<S>).err
		: console.error
	const nil = (matcherOrCallback as EffectMatcher<S>).nil
		? (matcherOrCallback as EffectMatcher<S>).nil
		: () => {}

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
			const values: Record<string, unknown> = {}

			for (const [key, signal] of Object.entries(signals)) {
				try {
					const value = signal.get()
					if (value === UNSET) pending = true
					values[key] = value
				} catch (e) {
					errors.push(toError(e))
				}
			}

			// Effectful part
			let cleanup: MaybeCleanup | Promise<MaybeCleanup>
			// Create AbortController for async callbacks
			if ([ok, nil, err].some(isAsyncFunction)) {
				controller = new AbortController()
			}
			const abort = controller?.signal as AbortSignal
			try {
				if (pending) {
					cleanup = isAsyncFunction<MaybeCleanup>(nil)
						? nil(abort)
						: isFunction<MaybeCleanup>(nil)
							? nil()
							: undefined
				} else if (errors.length) {
					cleanup = isAsyncFunction<MaybeCleanup>(err)
						? err(errors as Error[], abort)
						: isFunction<MaybeCleanup>(err)
							? err(errors as Error[])
							: undefined
				} else {
					cleanup = isAsyncFunction<MaybeCleanup>(ok)
						? ok(values as SignalValues<S>, abort)
						: isFunction<MaybeCleanup>(ok)
							? ok(values as SignalValues<S>)
							: undefined
				}
			} catch (error) {
				cleanup =
					isAbortError(error) || !err
						? undefined
						: isAsyncFunction<MaybeCleanup>(err)
							? err([...errors, toError(error)] as Error[], abort)
							: err([...errors, toError(error)] as Error[])
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
							if (!isAbortError(error)) {
								const errorCleanup = !err
									? undefined
									: isAsyncFunction(err)
										? err(
												[
													...errors,
													toError(error),
												] as Error[],
												abort,
											)
										: err([
												...errors,
												toError(error),
											] as Error[])
								if (errorCleanup instanceof Promise)
									errorCleanup.catch(console.error)
								else if (isFunction(errorCleanup))
									run.off(errorCleanup)
							}
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

/* === Exports === */

export { type EffectMatcher, type MaybeCleanup, effect }
