import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	batchDepth,
	type ComputedOptions,
	DEFAULT_EQUALITY,
	FLAG_DIRTY,
	flush,
	type MemoCallback,
	type MemoNode,
	makeSubscribe,
	propagate,
	refresh,
	type Signal,
	type SinkNode,
	TYPE_SIGNAL,
} from '../graph'
import { isSyncFunction } from '../util'

const WHERE = 'createMemo'

/* === Exported Functions === */

/**
 * Creates a derived reactive computation that caches its result.
 * The computation automatically tracks dependencies and recomputes when they change.
 * Uses lazy evaluation - only computes when the value is accessed.
 * The shape this factory returns is `Signal<T>` — the single-value, readonly member of the
 * shape-indexed value-type set. See ADR-0018.
 *
 * @since 0.18.0
 * @template T - The type of value computed by the memo
 * @param fn - The computation function that receives the previous value
 * @param options - Optional configuration for the memo
 * @param options.value - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the memo is first watched by an effect.
 *   Receives an `invalidate` function to mark the memo dirty and trigger recomputation.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Signal object with a get() method
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const doubled = createMemo(() => count.get() * 2);
 * console.log(doubled.get()); // 0
 * count.set(5);
 * console.log(doubled.get()); // 10
 * ```
 *
 * @example
 * ```ts
 * // Using previous value
 * const sum = createMemo((prev) => prev + count.get(), { value: 0, equals: Object.is });
 * ```
 */
function createMemo<T extends {}>(
	fn: (prev: T) => T,
	options: ComputedOptions<T> & { value: T },
): Signal<T>
function createMemo<T extends {}>(
	fn: MemoCallback<T>,
	options?: ComputedOptions<T>,
): Signal<T>
function createMemo<T extends {}>(
	fn: MemoCallback<T>,
	options?: ComputedOptions<T>,
): Signal<T> {
	validateCallback(WHERE, fn, isSyncFunction)
	if (options?.value !== undefined)
		validateSignalValue(WHERE, options.value, options?.guard)

	const node: MemoNode<T> = {
		fn,
		value: options?.value as T,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		error: undefined,
		stop: undefined,
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

	return {
		[Symbol.toStringTag]: TYPE_SIGNAL,
		get() {
			subscribe()
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			validateReadValue(WHERE, node.value)
			return node.value
		},
	}
}

export { createMemo }
