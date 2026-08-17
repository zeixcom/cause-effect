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
	isPending,
	type MaybeCleanup,
	registerCleanup,
	runCleanup,
	runEffect,
	scheduleEffect,
	trimSources,
} from '../graph'
import type { Signal } from './cell'

/* === Types === */

/** A value that is either synchronous or a `Promise` — used for handler return types in `match()`. */
type MaybePromise<T> = T | Promise<T>

/**
 * Handlers for all states of one or more signals passed to `match()`.
 *
 * @template T - Tuple of `Signal` types being matched
 */
type MatchHandlers<T extends readonly Signal<unknown & {}>[]> = {
	/** Called when all signals have a value. Receives a tuple of resolved values. */
	ok: (
		values: {
			[K in keyof T]: T[K] extends Signal<infer V> ? V : never
		},
	) => MaybePromise<MaybeCleanup>
	/** Called when one or more signals hold an error. Defaults to `console.error`. */
	err?: (errors: readonly Error[]) => MaybePromise<MaybeCleanup>
	/** Called when one or more signals are unset (pending). */
	nil?: () => MaybePromise<MaybeCleanup>
	/** Called when all signals have a (stale) value but one or more are asynchronously re-computing. Falls back to `ok` if absent. */
	stale?: () => MaybePromise<MaybeCleanup>
}

/**
 * Handlers for a single signal passed to `match()`.
 *
 * @template T - The value type of the signal being matched
 */
type SingleMatchHandlers<T extends {}> = {
	/** Called when the signal has a value. Receives the resolved value directly. */
	ok: (value: T) => MaybePromise<MaybeCleanup>
	/** Called when the signal holds an error. Receives the error directly. Defaults to `console.error`. */
	err?: (error: Error) => MaybePromise<MaybeCleanup>
	/** Called when the signal is unset (pending). */
	nil?: () => MaybePromise<MaybeCleanup>
	/** Called when the signal has a (stale) value but is asynchronously re-computing. Falls back to `ok` if absent. */
	stale?: () => MaybePromise<MaybeCleanup>
}

/* === Exported Functions === */

/**
 * Creates a reactive effect that runs when a dependency changes.
 *
 * The effect runs once on creation, then on every change to a tracked signal. Effects
 * run during the flush, after the batch merges the writes.
 *
 * An effect that writes to a signal it also depends on re-runs until the graph settles.
 * Its last run therefore reads the final values. A graph that never settles throws
 * `EffectConvergenceError` after a bounded number of flush passes. Two examples are an
 * unconditional self-increment, and two effects that write each other's dependencies.
 *
 * @since 0.1.0
 * @param fn - The effect function that can track dependencies and register cleanup callbacks
 * @returns A cleanup function that can be called to dispose of the effect
 * @throws EffectConvergenceError If effects keep re-triggering each other without settling
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
	scheduleEffect(node)

	return dispose
}

/**
 * Reads one or more signals and dispatches to the appropriate handler based on their state.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 1.1
 * @param signal - A single signal to read.
 * @param handlers - Object with an `ok` branch (receives the value directly) and optional `err`, `nil`, and `stale` branches.
 * @returns An optional cleanup function if the active handler returns one.
 * @throws RequiredOwnerError If called without an active owner.
 *
 * @remarks
 * **Sync handler bodies run in the caller's tracking scope.** `match()` calls `ok`,
 * `err`, `nil`, and `stale` synchronously in the calling scope, typically an effect body.
 * A signal read inside a handler becomes a dependency of that effect, exactly as a read
 * outside `match()` does. Wrap the read in `untrack()` to opt out.
 *
 * **Async handlers are for external side effects only.** Use them for DOM mutations,
 * analytics, logging, and any fire-and-forget API call whose result does not drive
 * reactive state. Do not call `.set()` on a signal inside an async handler. Use a `Task`
 * instead: it receives an `AbortSignal`, cancels on re-run, and composes with the `nil`
 * and `err` branches.
 *
 * A rejection from an async handler always routes to `err`. This includes a rejection
 * from a stale run that a newer signal value already superseded. The library cannot
 * cancel an external operation it did not start.
 */
function match<T extends {}>(
	signal: Signal<T>,
	handlers: SingleMatchHandlers<T>,
): MaybeCleanup
/**
 * Reads one or more signals and dispatches to the appropriate handler based on their state.
 * Must be called within an active owner (effect or scope) so async cleanup can be registered.
 *
 * @since 0.15.0
 * @param signals - Tuple of signals to read; all must have a value for `ok` to run.
 * @param handlers - Object with an `ok` branch and optional `err`, `nil`, and `stale` branches. Routing precedence: `nil` > `err` > `stale` > `ok`.
 * @returns An optional cleanup function if the active handler returns one.
 * @throws RequiredOwnerError If called without an active owner.
 *
 * @remarks
 * **Sync handler bodies run in the caller's tracking scope.** `match()` calls `ok`,
 * `err`, `nil`, and `stale` synchronously in the calling scope, typically an effect body.
 * A signal read inside a handler becomes a dependency of that effect, exactly as a read
 * outside `match()` does. This includes the implicit reads of a collection accessor such
 * as `List.keys()` or `List.at()`. Wrap the read in `untrack()` to opt out.
 *
 * **Async handlers are for external side effects only.** Use them for DOM mutations,
 * analytics, logging, and any fire-and-forget API call whose result does not drive
 * reactive state. Do not call `.set()` on a signal inside an async handler. Use `createTask`
 * instead: it receives an `AbortSignal`, cancels on re-run, and composes with the `nil`
 * and `err` branches.
 *
 * A rejection from an async handler always routes to `err`. This includes a rejection
 * from a stale run that a newer signal value already superseded. The library cannot
 * cancel an external operation it did not start.
 */
function match<T extends readonly Signal<unknown & {}>[]>(
	signals: readonly [...T],
	handlers: MatchHandlers<T>,
): MaybeCleanup
function match(
	signalOrSignals: Signal<unknown & {}> | readonly Signal<unknown & {}>[],
	// biome-ignore lint/suspicious/noExplicitAny: implementation overload, not part of the public API
	handlers: any,
): MaybeCleanup {
	if (!activeOwner) throw new RequiredOwnerError('match')

	const isSingle = !Array.isArray(signalOrSignals)
	const signals = isSingle ? [signalOrSignals] : signalOrSignals

	const { nil, stale } = handlers
	const ok = isSingle
		? (values: unknown[]) => handlers.ok(values[0])
		: (values: unknown[]) => handlers.ok(values)
	const err: (errors: readonly Error[]) => MaybePromise<MaybeCleanup> =
		isSingle && handlers.err
			? (errors: readonly Error[]) => handlers.err(errors[0])
			: (handlers.err ?? console.error)

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
		else if (
			stale &&
			(isSingle ? isPending(signals[0]) : signals.some(s => isPending(s)))
		)
			out = stale()
		else out = ok(values)
	} catch (e) {
		out = err([e instanceof Error ? e : new Error(String(e))])
	}

	if (typeof out === 'function') return out

	if (out instanceof Promise) {
		const owner = activeOwner
		const controller = new AbortController()
		registerCleanup(owner, () => controller.abort())
		out
			.then(cleanup => {
				if (!controller.signal.aborted && typeof cleanup === 'function')
					registerCleanup(owner, cleanup)
			})
			.catch(e => {
				err([e instanceof Error ? e : new Error(String(e))])
			})
	}
}

export {
	createEffect,
	type MatchHandlers,
	type MaybePromise,
	match,
	type SingleMatchHandlers,
}
