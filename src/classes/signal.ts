/**
 * Based on @reactively/core
 *
 * @see https://github.com/milomg/reactively/tree/main
 * @license MIT
 *
 * Copyright (c) 2023 modderme123
 */

/* === Types === */

// biome-ignore lint/suspicious/noExplicitAny: explicitly allow any Signal
type UnknownSignal = Signal<any>

/**
 * Public API types.
 *
 * These are compile-time contracts used by the framework layer:
 * - `State<T>` exposes `get()` and `set()`
 * - `Computed<T>` exposes only `get()`
 * - `Effect` exposes `get()` (run) and `dispose()` (stop)
 *
 * Runtime-wise, all of them are instances of the single `Signal` class.
 */
type State<T extends {}> = Signal<T>
type Memo<T extends {}> = Pick<Signal<T>, 'get'>
type Computed<T extends Awaited<unknown & {}>> = Memo<T> | Task<T>
type Effect = Pick<UnknownSignal, 'get' | 'dispose'>

/**
 * Sync memo callback.
 *
 * Receives the previous committed value.
 * Must resolve to the next committed value.
 */
type MemoCallback<T> = (oldValue: T) => T

/**
 * Async task callback.
 *
 * Receives the previous committed value and an AbortSignal.
 * Must resolve to the next committed value.
 */
type TaskCallback<T extends {}> = (
	oldValue: T,
	abort: AbortSignal,
) => Promise<T>

type Disposer = () => void

/**
 * Effect callback.
 *
 * It may optionally return a cleanup function. Cleanup functions are executed:
 * - before the next re-run of the same effect, and
 * - when the effect is disposed.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: optional dispose function
type EffectCallback = () => Disposer | void

export type Scope = {
	/**
	 * Run a function within this scope.
	 *
	 * Effects created while running in this scope will be registered and kept alive
	 * until the scope is disposed.
	 */
	run<T>(fn: () => T): T
	/**
	 * Dispose this scope, disposing all effects created within it.
	 */
	dispose(): void
}

type CacheFlag = typeof CACHE_CLEAN | typeof CACHE_CHECK | typeof CACHE_DIRTY
type CacheStale = typeof CACHE_CHECK | typeof CACHE_DIRTY

type EffectStatus =
	| typeof EFFECT_NONE
	| typeof EFFECT_READY
	| typeof EFFECT_QUEUED
	| typeof EFFECT_DISPOSED

type TaskState =
	| typeof TASK_IDLE
	| typeof TASK_PENDING
	| typeof TASK_ABORTED
	| typeof TASK_ERROR

type Guard<T> = (value: unknown) => value is T

type SignalOptions<T extends unknown & {}> = {
	initialValue?: T
	effect?: boolean
	guard?: Guard<T>
	equals?: (a: T, b: T) => boolean
	watched?: () => void
	unwatched?: () => void
}

/* === Constants === */

const TYPE_STATE = 'State'
const TYPE_COMPUTED = 'Computed'
const TYPE_EFFECT = 'Effect'

const CACHE_CLEAN = 0 // Signal value is valid, no need to recompute
const CACHE_CHECK = 1 // Signal value might be stale, check parent nodes to decide whether to recompute
const CACHE_DIRTY = 2 // Signal value is invalid, parents have changed, value needs to be recomputed

/**
 * Effect status state machine:
 * - NONE: not an effect
 * - READY: effect exists and may be queued
 * - QUEUED: effect is already queued in `pendingEffects`
 * - DISPOSED: effect disposed; must never be queued or run again
 */
const EFFECT_NONE = 0
const EFFECT_DISPOSED = 1
const EFFECT_READY = 2
const EFFECT_QUEUED = 3

const TASK_IDLE = 0
const TASK_PENDING = 1
const TASK_ABORTED = 2
const TASK_ERROR = 3

/* === Internal === */

let activeWatcher: UnknownSignal | undefined
let capturedSources: UnknownSignal[] | null = null
let sourceCursor = 0

// Effect scope stack. If a scope is active, effects created will register their disposer here.
let activeScope: Disposer[] | null = null

// A list of queued effect nodes that will be executed when flush() is called
const pendingEffects: UnknownSignal[] = []

// Function to call if there are queued effect nodes
let onEffectQueued: ((effect: Effect) => void) | undefined

let hasQueuedEffects = false
const microtaskScheduler = (): void => {
	if (!hasQueuedEffects) {
		hasQueuedEffects = true

		queueMicrotask(() => {
			hasQueuedEffects = false
			flush()
		})
	}
}

// WeakMap to store cleanup functions for each signal (better encapsulation than public property)
const signalCleanups = new WeakMap<UnknownSignal, Array<() => void>>()

let batchDepth = 0

/* === Classes === */

/**
 * Base `Signal` class.
 *
 * This library uses a *single* runtime class for:
 * - **State**: holds a mutable value (`get()` + `set(value)`)
 * - **Computed**: derives a value from other signals (`get()` only)
 * - **Effect**: runs side effects and is scheduled via the effect queue (`get()` + `dispose()`)
 *
 * The framework layer enforces the public API via the `State`, `Computed`, and `Effect` TypeScript types.
 *
 * Notes:
 * - Calling `get()` outside of a reactive context is always valid and returns the latest value.
 * - `dispose()` is meaningful for effects. It exists on the class for implementation reasons, and the
 *   framework/type layer should ensure only effects are disposed by user code.
 *
 * @since 0.17.4
 * @param {MemoCallback<T> | T} fnOrValue - Function or value to initialize the signal.
 * @param {SignalOptions<T>} options - Optional configuration.
 */
class Signal<T extends {}> {
	protected value: T
	protected callback?: MemoCallback<T> | TaskCallback<T>
	protected equals = (a: T, b: T) => a === b

	protected flag: CacheFlag
	protected effect: EffectStatus = EFFECT_NONE
	protected watchers: UnknownSignal[] | null = null // Nodes that have us as sources (down links)
	protected sources: UnknownSignal[] | null = null // Sources in reference order, not deduplicated (up links)

	constructor(
		fnOrValue: MemoCallback<T> | TaskCallback<T> | T,
		options?: SignalOptions<T>,
	) {
		if (typeof fnOrValue === 'function') {
			this.callback = fnOrValue as MemoCallback<T> | TaskCallback<T>
			// biome-ignore lint/suspicious/noExplicitAny: maybe temporarily undefined
			this.value = options?.initialValue as any
			this.flag = CACHE_DIRTY
			if (options?.effect) {
				this.effect = EFFECT_QUEUED
				pendingEffects.push(this)
				onEffectQueued?.(this as unknown as Effect)
			}
		} else {
			this.callback = undefined
			this.value = fnOrValue
			this.flag = CACHE_CLEAN
		}
	}

	/**
	 * Get the type of signal as a string tag.
	 */
	get [Symbol.toStringTag](): string {
		return this.effect
			? TYPE_EFFECT
			: this.callback
				? TYPE_COMPUTED
				: TYPE_STATE
	}

	/**
	 * Get current value.
	 *
	 * @returns {T} - Current value.
	 */
	get(): T {
		if (activeWatcher) {
			// If we're re-reading the same dependency sequence, just advance cursor
			if (
				!capturedSources &&
				activeWatcher.sources?.[sourceCursor] === this
			) {
				sourceCursor++
			} else {
				// Otherwise capture into a new list
				if (!capturedSources) capturedSources = [this]
				else capturedSources.push(this)
			}
		}
		if (this.callback) this.updateIfNeeded()
		return this.value
	}

	/**
	 * Set value or function.
	 *
	 * @param {T | MemoCallback<T>} fnOrValue - Value or function to set.
	 */
	set(fnOrValue: T | MemoCallback<T>): void {
		if (typeof fnOrValue === 'function') {
			const fn = fnOrValue as MemoCallback<T>
			if (fn !== this.callback) {
				this.callback = fn
				this.markStale(CACHE_DIRTY)
			}
		} else {
			if (this.callback) {
				this.unlinkSourcesFrom(0)
				this.sources = null
				this.callback = undefined
			}
			const value = fnOrValue as T
			if (!this.equals(this.value, value)) {
				this.value = value
				this.notifyWatchers()
			}
		}
	}

	/**
	 * Dispose an effect.
	 *
	 * This stops the effect from being scheduled again and runs any registered cleanups.
	 *
	 * Although this method exists on the base class (single-class runtime), it is only
	 * intended to be called for **effects**. The framework/type layer should prevent
	 * calling `dispose()` on state/computed signals.
	 */
	dispose(): void {
		// `dispose()` is only meaningful for effects.
		// For state/computed signals this is a no-op by contract (framework/type layer should prevent it).
		if (this.effect < EFFECT_READY) return

		// Mark as disposed (no future queueing/runs)
		this.effect = EFFECT_DISPOSED

		// Run cleanup functions
		runCleanups(this)

		// Detach from all sources so this effect doesn't keep the graph alive
		if (this.sources) {
			this.unlinkSourcesFrom(0)
			this.sources = null
		}

		// Clear watchers (downlinks) to release references; watchers should re-evaluate if needed
		if (this.watchers) this.watchers.length = 0

		// Clear callback to allow GC
		this.callback = undefined
	}

	/**
	 * Transition a queued effect back to READY before running.
	 * This allows the effect to re-queue itself during execution if needed.
	 *
	 * Internal: used by `flush()` to avoid writing to the protected `effect` field directly.
	 */
	dequeue(): boolean {
		const queued = this.effect === EFFECT_QUEUED
		if (queued) this.effect = EFFECT_READY
		return queued
	}

	/**
	 * Push stale flag to watchers (direction downstream in signal graph).
	 *
	 * @param {CacheStale} flag - The cache flag to mark watching nodes.
	 */
	protected markStale(flag: CacheStale): void {
		if (this.flag < flag) {
			// If we were previously clean, queue this effect once.
			if (this.flag === CACHE_CLEAN && this.effect === EFFECT_READY) {
				this.effect = EFFECT_QUEUED
				pendingEffects.push(this)
				onEffectQueued?.(this as unknown as Effect)
			}

			this.flag = flag
			if (!this.watchers?.length) return
			for (let i = 0; i < this.watchers.length; i++)
				this.watchers[i].markStale(CACHE_CHECK)
		}
	}

	/**
	 * Notify watchers of a change in value.
	 */
	protected notifyWatchers(flag: CacheStale = CACHE_DIRTY): void {
		if (!this.watchers?.length) return
		for (let i = 0; i < this.watchers.length; i++)
			this.watchers[i].markStale(flag)
	}

	/**
	 * Remove all old sources' `.watchers` links to us (direction upstream in signal graph).
	 *
	 * While unlinking, if any source becomes unobserved (its watcher list becomes empty),
	 * it will auto-detach from its own sources to avoid keeping upstream nodes alive.
	 *
	 * @param {number} index - The index of the source to invalidate.
	 * @returns {void}
	 */
	protected unlinkSourcesFrom(index: number): void {
		if (!this.sources) return
		for (let i = index; i < this.sources.length; i++) {
			// Remove from watchers array, swap with last element and pop
			const watchers: UnknownSignal[] | null = this.sources[i].watchers
			if (!watchers) continue
			const swap = watchers.findIndex(v => v === this)
			if (swap === -1) continue
			watchers[swap] = watchers[watchers.length - 1]
			watchers.pop()
		}
	}

	/**
	 * Add ourselves to the end of the parent .watchers array (lazy init).
	 *
	 * @param {number} sourceCursor - The index of the source to link.
	 */
	protected reconcileLinks(
		sourceCursor: number,
		capturedSources: UnknownSignal[] | null,
	): void {
		if (capturedSources) {
			// Remove all old sources' .watchers links to us
			this.unlinkSourcesFrom(sourceCursor)

			// Update source up links
			if (sourceCursor && this.sources) {
				this.sources.length = sourceCursor + capturedSources.length
				for (let i = 0; i < capturedSources.length; i++)
					this.sources[sourceCursor + i] = capturedSources[i]
			} else {
				this.sources = capturedSources
			}

			// Add ourselves to the end of the parent .watchers array (lazy init).
			for (let i = sourceCursor; i < this.sources.length; i++) {
				const source = this.sources[i]
				if (source.watchers) source.watchers.push(this)
				else source.watchers = [this]
			}
		} else if (this.sources && sourceCursor < this.sources.length) {
			// Remove all old sources' .watchers links to us
			this.unlinkSourcesFrom(sourceCursor)
			this.sources.length = sourceCursor
		}
	}

	/**
	 * Main function to update the value of the signal.
	 */
	protected run(): void {
		if (!this.callback) return

		const oldValue = this.value

		// Evalute the reactive function body, dynamically capturing any other signals used
		const prevWatcher = activeWatcher
		const prevSources = capturedSources
		const prevCursor = sourceCursor

		activeWatcher = this
		// biome-ignore lint/suspicious/noExplicitAny: temporarily null
		capturedSources = null as any // prevent TS from thinking capturedSources is null below
		sourceCursor = 0

		try {
			// 1) Run and clear cleanup functions from WeakMap
			runCleanups(this)

			// 2) Run the reactive function body
			this.value = (this.callback as MemoCallback<T>)(this.value)

			// 3) Reconcile sources/watchers
			this.reconcileLinks(sourceCursor, capturedSources)
		} finally {
			capturedSources = prevSources
			activeWatcher = prevWatcher
			sourceCursor = prevCursor
		}

		// 4) Diamond: if value changed, force children DIRTY
		if (!this.equals(oldValue, this.value)) this.notifyWatchers()

		this.flag = CACHE_CLEAN
	}

	/**
	 * Pull updated source values (upstream in signal graph).
	 */
	protected updateIfNeeded(): void {
		// If we are potentially dirty, see if we have a parent who has actually changed value
		if (this.flag === CACHE_CHECK && this.sources?.length) {
			for (let i = 0; i < this.sources.length; i++) {
				this.sources[i].updateIfNeeded() // updateIfNeeded() can change this.state
				if ((this.flag as CacheFlag) === CACHE_DIRTY) break
			}
		}

		// If we were already dirty or marked dirty by the step above, update.
		if (this.flag === CACHE_DIRTY) this.run()

		// By now, we're clean
		this.flag = CACHE_CLEAN
	}
}

/**
 * Async computed signal built on top of the unified synchronous `Signal`.
 *
 * Key semantics (colorless async):
 * - `get()` is synchronous and returns the latest *committed* value.
 * - Dependency tracking happens synchronously when `get()` triggers `run()`.
 *   (We call the user callback once to create the Promise, which performs `.get()` reads.)
 * - When dependencies change while pending, we abort the in-flight run and start a new one on demand.
 * - We only commit and propagate once the Promise resolves successfully.
 * - Errors are captured, stored, and rethrown on subsequent `get()`.
 *
 * Notes / limitations:
 * - This intentionally avoids changing the base `Signal` hot-path.
 * - This class relies on base class internals (protected fields) but keeps that access localized.
 */
class Task<T extends {}> extends Signal<T> {
	error: Error | undefined

	protected state: TaskState = TASK_IDLE
	protected controller: AbortController | undefined

	/**
	 * Return the latest committed value.
	 *
	 * If the last run produced an error, rethrow it (colorless error propagation).
	 */
	get(): T {
		const v = super.get()
		if (this.error) throw this.error
		return v
	}

	/**
	 * Return whether the task is currently running.
	 */
	get pending(): boolean {
		return this.state === TASK_PENDING
	}

	/**
	 * Abort the in-flight run, if any.
	 */
	abort(): void {
		this.controller?.abort()
		this.controller = undefined
		if (this.state === TASK_PENDING) this.state = TASK_ABORTED
	}

	/**
	 * Dispose this task.
	 *
	 * This is *not* the same as effect disposal in the base class. Task provides a useful teardown:
	 * - abort in-flight work
	 * - unlink from sources (detach from graph)
	 */
	dispose(): void {
		this.abort()
		if (this.sources) {
			this.unlinkSourcesFrom(0)
			this.sources = null
		}
		this.watchers = null
		// Keep last committed value; clear error so it doesn't throw after disposal.
		this.error = undefined
		this.state = TASK_IDLE
	}

	/**
	 * Override stale propagation for tasks.
	 *
	 * We need special behavior when pending:
	 * - Abort the in-flight run immediately (so external work can be cancelled).
	 * - Do NOT re-run immediately; re-run lazily on next `get()`.
	 */
	protected markStale(flag: CacheStale): void {
		// If we are pending and dependencies change, abort and mark "needs restart".
		if (this.state === TASK_PENDING) this.abort()
		super.markStale(flag)
	}

	/**
	 * Start/replace async computation.
	 *
	 * This method is called by base `updateIfNeeded()` when this signal is DIRTY.
	 * It must:
	 * - synchronously run the callback once to capture dependencies and obtain the Promise
	 * - keep returning the last committed value while pending
	 * - commit and propagate ONLY when the Promise resolves
	 */
	protected run(): void {
		if (!this.callback) return
		if (this.state === TASK_PENDING) return

		// Abort any previous run.
		this.controller?.abort()

		const controller = new AbortController()
		this.controller = controller

		const oldValue = this.value

		this.state = TASK_PENDING
		this.error = undefined
		// const token = ++this.token

		// Evalute the reactive function body, dynamically capturing any other signals used
		const prevWatcher = activeWatcher
		const prevSources = capturedSources
		const prevCursor = sourceCursor

		activeWatcher = this
		// biome-ignore lint/suspicious/noExplicitAny: temporarily null
		capturedSources = null as any // prevent TS from thinking capturedSources is null below
		sourceCursor = 0

		let promise: Promise<T>
		try {
			// 1) Run and clear cleanup functions from WeakMap
			runCleanups(this)

			// 2) Execute under dependency tracking
			promise = (this.callback as TaskCallback<T>)(
				oldValue,
				controller.signal,
			)

			// 3) Reconcile sources/watchers
			this.reconcileLinks(0, capturedSources)
		} catch (e) {
			// Synchronous throw from callback: treat as immediate error, keep old committed value.
			this.state = TASK_ERROR
			this.controller = undefined
			this.error = e instanceof Error ? e : new Error(String(e))
			this.flag = CACHE_CLEAN
			return
		} finally {
			capturedSources = prevSources
			activeWatcher = prevWatcher
			sourceCursor = prevCursor
		}

		promise.then(
			(next: T) => {
				if (controller.signal.aborted) return

				this.value = next
				this.controller = undefined
				this.state = TASK_IDLE
				this.error = undefined

				// 4) Pull semantics: dependents update on next read.
				if (!this.equals(oldValue, this.value)) this.notifyWatchers()
			},
			(err: unknown) => {
				if (controller.signal.aborted) return

				// On error: do not commit value; keep last committed.
				this.controller = undefined
				this.state = TASK_ERROR
				this.error = err instanceof Error ? err : new Error(String(err))

				// Still notify dependents so they can react/throw if they read.
				this.markStale(CACHE_CHECK)

				this.flag = CACHE_CLEAN
			},
		)
	}
}

/* === Functions === */

/**
 * Run a function while temporarily suspending tracking its dependencies.
 *
 * @param {() => void} fn - The function to run.
 */
const untrack = (fn: () => void): void => {
	if (!fn) return

	// Evalute the reactive function body, dynamically capturing any other signals used
	const prevWatcher = activeWatcher
	const prevSources = capturedSources
	const prevCursor = sourceCursor

	activeWatcher = undefined
	// biome-ignore lint/suspicious/noExplicitAny: temporarily null
	capturedSources = null as any // prevent TS from thinking capturedSources is null below
	sourceCursor = 0

	try {
		fn()
	} finally {
		capturedSources = prevSources
		activeWatcher = prevWatcher
		sourceCursor = prevCursor
	}
}

/**
 * Flush pending effects.
 *
 * Runs each queued effect at most once per flush. Disposed effects are skipped.
 */
const flush = (): void => {
	for (let i = 0; i < pendingEffects.length; i++) {
		const effect = pendingEffects[i]
		if (effect.dequeue()) effect.get()
	}
	pendingEffects.length = 0
}

/**
 * Batch multiple updates.
 *
 * @param {() => void} fn - Function to execute within the batch.
 */
const batch = (fn: () => void): void => {
	batchDepth++
	try {
		fn()
	} finally {
		batchDepth--
		if (batchDepth === 0) flush()
	}
}

/**
 * Set the effect scheduler hook.
 *
 * The scheduler is invoked when an effect is queued (i.e. transitions into `EFFECT_QUEUED`).
 * The default scheduler (`microtaskScheduler`) batches effect execution into a microtask and calls `flush()`.
 *
 * @param {() => void} fn - Scheduler function to call when at least one effect is queued.
 */
const setEffectScheduler = (fn: () => void = microtaskScheduler): void => {
	onEffectQueued = fn
}

/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a State instance, false otherwise
 */
const isState = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is State<T> =>
	value instanceof Signal && value[Symbol.toStringTag] === TYPE_STATE

/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a computed signal, false otherwise
 */
const isComputed = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Computed<T> =>
	value instanceof Signal && value[Symbol.toStringTag] === TYPE_COMPUTED

/**
 * Check if the provided fn is a sync callback
 *
 * @since 0.12.0
 * @param {unknown} fn - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
const isMemoCallback = /*#__PURE__*/ <T extends {} & { then?: undefined }>(
	fn: unknown,
): fn is MemoCallback<T> =>
	typeof fn === 'function' &&
	fn.constructor.name !== 'AsyncFunction' &&
	fn.length < 2

/**
 * Check if the provided value is an async callback
 *
 * @since 0.17.0
 * @param {unknown} fn - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
const isTaskCallback = /*#__PURE__*/ <T extends Awaited<unknown & {}>>(
	fn: unknown,
): fn is TaskCallback<T> =>
	typeof fn === 'function' &&
	fn.constructor.name === 'AsyncFunction' &&
	fn.length < 3

/**
 * Create an effect.
 *
 * The callback runs immediately (via the effect queue) and re-runs whenever any of its
 * tracked dependencies change.
 *
 * The callback may return a cleanup function. Cleanup functions are executed:
 * - before the next re-run of the same effect, and
 * - when the effect is disposed.
 *
 * @since 0.1.0
 * @param {EffectCallback} fn - Effect callback.
 * @returns {Disposer} - Dispose function for the effect.
 */
const createEffect = /*#__PURE__*/ (fn: EffectCallback): (() => void) => {
	const effect = new Signal(fn, { effect: true })
	const dispose = () => effect.dispose()
	activeScope?.push(dispose)
	return dispose
}

/**
 * Check if a value is an effect
 *
 * @since 0.17.4
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an effect, false otherwise
 */
const isEffect = /*#__PURE__*/ (value: unknown): value is Effect =>
	value instanceof Signal && value[Symbol.toStringTag] === TYPE_EFFECT

/**
 * Register a cleanup function for the currently executing computed/effect.
 *
 * Cleanup functions are executed:
 * - before the next re-run of the same computed/effect, and
 * - when an effect is disposed.
 *
 * This must be called from within a reactive execution context (while a computed/effect is running).
 *
 * @param {() => void} fn - Cleanup function to register.
 */
const onCleanup = (fn: () => void): void => {
	if (!activeWatcher) {
		throw new Error('onCleanup must be called within a reactive context')
	}
	let cleanups = signalCleanups.get(activeWatcher)
	if (!cleanups) {
		cleanups = []
		signalCleanups.set(activeWatcher, cleanups)
	}
	cleanups.push(fn)
}

/**
 * Run cleanup functions for the currently executing computed/effect.
 *
 * @param {UnknownSignal} signal - Signal to run cleanups for.
 */
const runCleanups = (signal: UnknownSignal): void => {
	const cleanups = signalCleanups.get(signal)
	if (!cleanups?.length) return
	for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]()
	cleanups.length = 0
}

/**
 * Create a scope that collects effect disposers.
 *
 * Any effects created while `run()` is executing are kept alive by this scope
 * until `dispose()` is called.
 */
const createScope = /*#__PURE__*/ (): Scope => {
	let disposed = false
	const scope = [] as Disposer[]

	const dispose = (): void => {
		if (disposed) return
		disposed = true
		for (let i = scope.length - 1; i >= 0; i--) scope[i]()
		scope.length = 0
	}

	const run = <T>(fn: () => T): T => {
		if (disposed) return fn()
		const prev = activeScope
		activeScope = scope
		try {
			const result = fn()
			// Ensure initial runs of effects created during build happen before returning.
			flush()
			return result
		} finally {
			activeScope = prev
		}
	}

	return { run, dispose }
}

/**
 * Run a callback within a new effect scope and return the scope disposer.
 *
 * This is a convenience helper for the common "component scope" use case:
 * create effects inside the callback and dispose them all when the component disconnects.
 *
 * @param {() => void} fn - Function to execute within the scope.
 * @returns {() => void} - Dispose function for the scope.
 */
const effectScope = /*#__PURE__*/ (fn: () => void): (() => void) => {
	const { run, dispose } = createScope()
	run(fn)
	return dispose
}

export {
	type UnknownSignal,
	type MemoCallback,
	type TaskCallback,
	type CacheFlag,
	type CacheStale,
	type State,
	TYPE_STATE,
	TYPE_COMPUTED,
	TYPE_EFFECT,
	CACHE_CLEAN,
	CACHE_CHECK,
	CACHE_DIRTY,
	EFFECT_NONE,
	EFFECT_DISPOSED,
	EFFECT_READY,
	EFFECT_QUEUED,
	TASK_IDLE,
	TASK_PENDING,
	TASK_ABORTED,
	TASK_ERROR,
	Signal,
	Task,
	untrack,
	flush,
	batch,
	setEffectScheduler,
	onCleanup,
	isState,
	isComputed,
	isMemoCallback,
	isTaskCallback,
	createEffect,
	isEffect,
	createScope,
	effectScope,
}
