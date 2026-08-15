import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	batchDepth,
	DEFAULT_EQUALITY,
	type DeriveSignalOptions,
	FLAG_DIRTY,
	flush,
	makeSubscribe,
	propagate,
	refresh,
	registerAsyncSource,
	type Signal,
	type SinkNode,
	type StateNode,
	setState,
	type TaskCallback,
	type TaskNode,
	TYPE_SIGNAL,
} from '../graph'
import { isAsyncFunction } from '../util'

const WHERE = 'createTask'

/* === Exported Functions === */

/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 * The shape this factory returns is `Signal<T>` — the single-value, readonly member of the
 * shape-indexed value-type set. See ADR-0018.
 *
 * Pending state and abort control are graph utilities rather than methods on the returned
 * signal — asynchrony is an origin, not a shape, so any of the three shapes can be derived
 * asynchronously. Use `isPending(signal)` and `abort(signal)` from the graph module.
 *
 * @since 0.18.0
 * @template T - The type of value resolved by the task
 * @param fn - The async computation function that receives the previous value and an AbortSignal
 * @param options - Optional configuration for the task
 * @param options.initial - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the task is first watched by an effect.
 *   Receives an `invalidate` function to mark the task dirty and trigger re-execution.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Signal object with a get() method
 *
 * @example
 * ```ts
 * const userId = createState(1);
 * const user = createTask(async (prev, abortSignal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal });
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
 * if (isPending(user)) {
 *   console.log('Loading...');
 * }
 * ```
 */
function createTask<T extends {}>(
	fn: (prev: T, abortSignal: AbortSignal) => Promise<T>,
	options: DeriveSignalOptions<T> & { initial: T },
): Signal<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: DeriveSignalOptions<T>,
): Signal<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: DeriveSignalOptions<T>,
): Signal<T> {
	validateCallback(WHERE, fn, isAsyncFunction)
	if (options?.initial !== undefined)
		validateSignalValue(WHERE, options.initial, options?.guard)

	const pendingNode: StateNode<boolean> = {
		value: false,
		sinks: null,
		sinksTail: null,
		equals: DEFAULT_EQUALITY,
	}

	const node: TaskNode<T> = {
		fn,
		value: options?.initial as T,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		flags: FLAG_DIRTY,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		controller: undefined,
		error: undefined,
		stop: undefined,
		pendingNode,
	}

	const watched = options?.watched
	const subscribe = makeSubscribe(
		node,
		watched
			? () =>
					watched(() => {
						propagate(node as unknown as SinkNode)
						if (batchDepth === 0) flush()
					})
			: undefined,
	)

	const pendingSubscribe = makeSubscribe(pendingNode)

	const task: Signal<T> = {
		[Symbol.toStringTag]: TYPE_SIGNAL,
		get(): T {
			subscribe()
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			validateReadValue(WHERE, node.value)
			return node.value
		},
	}

	registerAsyncSource(task, {
		isPending(): boolean {
			pendingSubscribe()
			return node.pendingNode.value
		},
		abort(): void {
			node.controller?.abort()
			node.controller = undefined
			setState(node.pendingNode, false)
		},
	})

	return task
}

export { createTask }
