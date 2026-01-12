import {
	CACHE_CLEAN,
	CACHE_DIRTY,
	type CacheStale,
	type MemoCallback,
	Signal,
	type TaskCallback,
} from './signal'

/* === Types === */

/**
 * Task state snapshot.
 *
 * - idle: no in-flight async work
 * - pending: async work in-flight
 * - error: last run failed (value remains last committed value)
 */
type TaskState =
	| typeof TASK_IDLE
	| typeof TASK_PENDING
	| typeof TASK_ABORTED
	| typeof TASK_ERROR

/* === Constants === */

const TASK_IDLE = 0
const TASK_PENDING = 1
const TASK_ABORTED = 2
const TASK_ERROR = 3

/* === Class === */

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
	protected callback: TaskCallback<T>
	protected controller: AbortController | undefined
	protected token = 0 // Monotonic token to ignore stale resolves/rejects

	/**
	 * Create a new async task signal.
	 *
	 * @param callback - Async callback to compute the next committed value.
	 * @param initialValue - Initial committed value returned from `get()` until the first async commit.
	 */
	constructor(callback: TaskCallback<T>, initialValue: T) {
		// We pass a memo callback to satisfy the base class "computed" constructor path.
		// We will overwrite it with our own `run()` implementation.
		super(((old: T) => old) as unknown as MemoCallback<T>)
		this.callback = callback

		// Set initial committed value and ensure first `get()` triggers `run()`.
		this.value = initialValue
		this.flag = CACHE_DIRTY
	}

	/**
	 * Abort the in-flight run, if any.
	 */
	abort(): void {
		this.controller?.abort()
		this.controller = undefined
		if (this.state === TASK_PENDING) this.state = TASK_IDLE
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
		if (this.state === TASK_PENDING) {
			this.abort()
			this.state = TASK_ABORTED
		}
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
		if (this.state === TASK_PENDING) {
			this.flag = CACHE_CLEAN
			return
		}

		// Abort any previous run.
		this.controller?.abort()

		const controller = new AbortController()
		this.controller = controller

		const oldValue = this.value

		this.state = TASK_PENDING
		this.error = undefined
		const token = ++this.token

		this.track(() => {
			let promise: Promise<T>
			try {
				// IMPORTANT: This call is what captures dependencies via `.get()` reads.
				promise = this.callback(oldValue, controller.signal)
			} catch (e) {
				// Synchronous throw from callback: treat as immediate error, keep old committed value.
				this.state = TASK_ERROR
				this.controller = undefined
				this.error = e instanceof Error ? e : new Error(String(e))
				this.flag = CACHE_CLEAN
				return
			}

			// While pending, consumers should see the last committed value without re-running.
			this.flag = CACHE_CLEAN

			promise.then(
				(next: T) => {
					// Ignore if superseded or aborted.
					if (token !== this.token) return
					if (controller.signal.aborted) return

					this.controller = undefined
					this.state = TASK_IDLE
					this.error = undefined

					// Commit value if changed; propagate only on commit.
					if (!this.equals(oldValue, next)) {
						this.value = next
						if (this.watchers?.length) {
							for (let i = 0; i < this.watchers.length; i++) {
								// Mark downstream definitely dirty so they recompute on next read/effect flush.
								// We can't call `markStale` here because it's protected, and `flag` is protected too.
								// Use a narrow type escape to write the cache flag directly.
								this.watchers[i].flag = CACHE_DIRTY
							}
						}
					}
				},
				(err: unknown) => {
					// Ignore if superseded or aborted.
					if (token !== this.token) return
					if (controller.signal.aborted) return

					this.controller = undefined
					this.state = TASK_ERROR
					this.error =
						err instanceof Error ? err : new Error(String(err))

					// On error: do not commit value; keep last committed.
					// Still notify dependents so they can react/throw if they read.
					if (this.watchers?.length) {
						for (let i = 0; i < this.watchers.length; i++) {
							// See comment above: use a narrow type escape to write the cache flag directly.
							this.watchers[i].flag = CACHE_DIRTY
						}
					}
				},
			)
		})
	}

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

	get pending(): boolean {
		return this.state === TASK_PENDING
	}
}

export {
	type TaskState,
	TASK_IDLE as ASYNC_IDLE,
	TASK_PENDING as ASYNC_PENDING,
	TASK_ERROR as ASYNC_ERROR,
	Task,
}
