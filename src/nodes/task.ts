import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	batch,
	batchDepth,
	DEFAULT_EQUALITY,
	type DeriveCellOptions,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RUNNING,
	flush,
	makeSubscribe,
	propagate,
	refresh,
	registerAsyncSource,
	type SinkNode,
	type StateNode,
	setState,
	swapActiveSink,
	type TaskCallback,
	type TaskNode,
	TYPE_CELL,
	trimSources,
} from '../graph'
import { isAsyncFunction } from '../util'
import type { Cell } from './cell'

const WHERE = 'createTask'

/* === Internal Functions === */

/**
 * Recomputes a task node. Defined here rather than in `graph.ts` and stored on
 * the node as `node.recompute`, so that `refresh()` holds no reference to the
 * task recompute path — a bundle that never imports `createTask` tree-shakes
 * this function and its `AbortController` out entirely (ADR-0018 §5).
 */
function recomputeTask(node: TaskNode<unknown & {}>): void {
	node.controller?.abort()

	const controller = new AbortController()
	node.controller = controller
	node.error = undefined

	const prevWatcher = swapActiveSink(node)
	node.sourcesTail = null
	node.flags = FLAG_RUNNING

	let promise: Promise<unknown & {}>
	try {
		promise = node.fn(node.value, controller.signal)
	} catch (err) {
		node.controller = undefined
		node.error = err instanceof Error ? err : new Error(String(err))
		// Keep the node recoverable: clear FLAG_RUNNING and reset pending,
		// so subsequent reads report the SAME error instead of a spurious
		// CircularDependencyError on the stuck RUNNING flag.
		node.flags = FLAG_CLEAN
		setState(node.pendingNode, false)
		return
	} finally {
		swapActiveSink(prevWatcher)
		trimSources(node)
	}

	setState(node.pendingNode, true)

	promise.then(
		next => {
			if (controller.signal.aborted) return

			node.controller = undefined
			batch(() => {
				if (node.error || !node.equals(next, node.value)) {
					node.value = next
					node.error = undefined
					for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				}
				setState(node.pendingNode, false)
			})
		},
		(err: unknown) => {
			if (controller.signal.aborted) return

			node.controller = undefined
			const error = err instanceof Error ? err : new Error(String(err))
			batch(() => {
				if (
					!node.error ||
					error.name !== node.error.name ||
					error.message !== node.error.message
				) {
					// We don't clear old value on errors
					node.error = error
					for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				}
				setState(node.pendingNode, false)
			})
		},
	)

	node.flags = FLAG_CLEAN
}

/* === Exported Functions === */

/**
 * Creates an asynchronous reactive computation (colorless async).
 * The computation automatically tracks dependencies and re-executes when they change.
 * Provides abort semantics - in-flight computations are aborted when dependencies change.
 * The shape this factory returns is `Cell<T>` — the single-value, readonly member of the
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
 * @returns A Cell object with a get() method
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
	options: DeriveCellOptions<T> & { initial: T },
): Cell<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: DeriveCellOptions<T>,
): Cell<T>
function createTask<T extends {}>(
	fn: TaskCallback<T>,
	options?: DeriveCellOptions<T>,
): Cell<T> {
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
		recompute: recomputeTask,
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

	const task: Cell<T> = {
		[Symbol.toStringTag]: TYPE_CELL,
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
