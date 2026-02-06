import {
	activeSink,
	type ComputedOptions,
	defaultEquals,
	FLAG_DIRTY,
	link,
	refresh,
	type SinkNode,
	type TaskNode,
	TYPE_TASK,
	validateCallback,
	validateSignalValue,
	type TaskCallback,
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
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @returns A Task object with get(), isPending(), abort(), and stop() methods
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
const createTask = <T extends {}>(
	fn: TaskCallback<T>,
	options?: ComputedOptions<T>,
): Task<T> => {
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
		equals: options?.equals ?? defaultEquals,
		controller: undefined,
		error: undefined,
	}

	return {
		[Symbol.toStringTag]: TYPE_TASK,
		get(): T {
			if (activeSink) link(node, activeSink)
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			return node.value
		},
		isPending(): boolean {
			return !node.controller
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
 * @param value - The value to check
 * @returns True if the value is a Task
 *
 * @example
 * ```ts
 * const task = createTask(async () => 42, null);
 * if (isTask(task)) {
 *   task.abort(); // TypeScript knows task has abort()
 * }
 * ```
 */
const isTask = <T extends {} = unknown & {}>(
	value: unknown,
): value is Task<T> => isObjectOfType(value, TYPE_TASK)

export { createTask, isTask, type Task }
