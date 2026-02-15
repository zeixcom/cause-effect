import {
	RequiredOwnerError,
	UnsetSignalValueError,
	validateCallback,
} from '../errors'
import {
	activeOwner,
	type Cleanup,
	type EffectCallback,
	type EffectNode,
	FLAG_CLEAN,
	FLAG_DIRTY,
	type MaybeCleanup,
	registerCleanup,
	runCleanup,
	runEffect,
	type Signal,
	trimSources,
} from '../graph'

/* === Types === */

type MaybePromise<T> = T | Promise<T>

type MatchHandlers<T extends readonly Signal<unknown & {}>[]> = {
	ok: (values: {
		[K in keyof T]: T[K] extends Signal<infer V> ? V : never
	}) => MaybePromise<MaybeCleanup>
	err?: (errors: readonly Error[]) => MaybePromise<MaybeCleanup>
	nil?: () => MaybePromise<MaybeCleanup>
}

/* === Exported Functions === */

/**
 * Creates a reactive effect that automatically runs when its dependencies change.
 * Effects run immediately upon creation and re-run when any tracked signal changes.
 * Effects are executed during the flush phase, after all updates have been batched.
 *
 * @since 0.1.0
 * @param fn - The effect function that can track dependencies and register cleanup callbacks
 * @returns A cleanup function that can be called to dispose of the effect
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const dispose = createEffect(() => {
 *   console.log('Count is:', count.get());
 * });
 *
 * count.set(1); // Logs: "Count is: 1"
 * dispose(); // Stop the effect
 * ```
 *
 * @example
 * ```ts
 * // With cleanup
 * createEffect(() => {
 *   const timer = setInterval(() => console.log(count.get()), 1000);
 *   return () => clearInterval(timer);
 * });
 * ```
 */
function createEffect(fn: EffectCallback): Cleanup {
	validateCallback('Effect', fn)

	const node: EffectNode = {
		fn,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		cleanup: null,
	}

	const dispose = () => {
		runCleanup(node)
		node.fn = undefined as unknown as EffectCallback
		node.flags = FLAG_CLEAN
		node.sourcesTail = null
		trimSources(node)
	}

	if (activeOwner) registerCleanup(activeOwner, dispose)

	runEffect(node)

	return dispose
}

/**
 * Runs handlers based on the current values of signals.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 0.15.0
 * @throws RequiredOwnerError If called without an active owner.
 */
function match<T extends readonly Signal<unknown & {}>[]>(
	signals: readonly [...T],
	handlers: MatchHandlers<T>,
): MaybeCleanup {
	if (!activeOwner) throw new RequiredOwnerError('match')
	const { ok, err = console.error, nil } = handlers
	let errors: Error[] | undefined
	let pending = false
	const values = new Array(signals.length)

	for (let i = 0; i < signals.length; i++) {
		try {
			values[i] = signals[i].get()
		} catch (e) {
			if (e instanceof UnsetSignalValueError) {
				pending = true
				continue
			}
			if (!errors) errors = []
			errors.push(e instanceof Error ? e : new Error(String(e)))
		}
	}

	let out: MaybePromise<MaybeCleanup>
	try {
		if (pending) out = nil?.()
		else if (errors) out = err(errors)
		else
			out = ok(
				values as {
					[K in keyof T]: T[K] extends Signal<infer V> ? V : never
				},
			)
	} catch (e) {
		err([e instanceof Error ? e : new Error(String(e))])
	}

	if (typeof out === 'function') return out

	if (out instanceof Promise) {
		const owner = activeOwner
		const controller = new AbortController()
		registerCleanup(owner, () => controller.abort())
		out.then(cleanup => {
			if (!controller.signal.aborted && typeof cleanup === 'function')
				registerCleanup(owner, cleanup)
		}).catch(e => {
			err([e instanceof Error ? e : new Error(String(e))])
		})
	}
}

export { type MaybePromise, type MatchHandlers, createEffect, match }
