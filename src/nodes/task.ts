import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batchDepth,
	type ComputedOptions,
	DEFAULT_EQUALITY,
	FLAG_DIRTY,
	flush,
	link,
	propagate,
	refresh,
	type SinkNode,
	type TaskCallback,
	type TaskNode,
	TYPE_TASK,
} from '../graph'
import { isAsyncFunction, isObjectOfType } from '../util'

/* === Types === */

/**
 * An asynchronous reactive computation (colorless async).
 * Automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics and pending state tracking.
 *
 * @template T - The type of value resolved by the task
 */
type Task<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Task'

	/**
	 * Gets the current value of the task.
	 * Returns the last resolved value, even while a new computation is pending.
	 * When called inside another reactive context, creates a dependency.
	 * @returns The current value
	 * @throws UnsetSignalValueError If the task value is still unset when read.
	 */
	get(): T

	/**
	 * Checks if the task is currently executing.
	 * @returns True if a computation is in progress
	 */
	isPending(): boolean

	/**
	 * Aborts the current computation if one is running.
	 * The task's AbortSignal will be triggered.
	 */
	abort(): void
}

/* === Exported Functions === */

/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 *
 * @since 0.18.0
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @param options.value - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the task is first watched by an effect.
 *   Receives an `invalidate` function to mark the task dirty and trigger re-execution.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Task object with get(), isPending(), and abort() methods
 *
 * @example
 * ```ts
 * const userId = createState(1);
 * const user = createTask(async (prev, signal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal });
 *   return response.json();
 * });
 *
 * // When userId changes, the previous fetch is aborted
 * userId.set(2);
 * ```
 *
 * @example
 * ```ts
 * // Check pending state
 * if (user.isPending()) {
 *   console.log('Loading...');
 * }
 * ```
 */
function createTask<T extends {}>(
	fn: (prev: T, signal: AbortSignal) => Promise<T>,
	options: ComputedOptions<T> & { value: T },
): Task<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: ComputedOptions<T>,
): Task<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: ComputedOptions<T>,
): Task<T> {
	validateCallback(TYPE_TASK, fn, isAsyncFunction)
	if (options?.value !== undefined)
		validateSignalValue(TYPE_TASK, options.value, options?.guard)

	const node: TaskNode<T> = {
		fn,
		value: options?.value as T,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		flags: FLAG_DIRTY,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		controller: undefined,
		error: undefined,
		stop: undefined,
	}

	const watched = options?.watched
	const subscribe = watched
		? () => {
				if (activeSink) {
					if (!node.sinks)
						node.stop = watched(() => {
							node.flags |= FLAG_DIRTY
							for (let e = node.sinks; e; e = e.nextSink)
								propagate(e.sink)
							if (batchDepth === 0) flush()
						})
					link(node, activeSink)
				}
			}
		: () => {
				if (activeSink) link(node, activeSink)
			}

	return {
		[Symbol.toStringTag]: TYPE_TASK,
		get(): T {
			subscribe()
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			validateReadValue(TYPE_TASK, node.value)
			return node.value
		},
		isPending(): boolean {
			return !!node.controller
		},
		abort(): void {
			node.controller?.abort()
			node.controller = undefined
		},
	}
}

/**
 * Checks if a value is a Task signal.
 *
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Task
 */
function isTask<T extends {} = unknown & {}>(value: unknown): value is Task<T> {
	return isObjectOfType(value, TYPE_TASK)
}

export { createTask, isTask, type Task }
