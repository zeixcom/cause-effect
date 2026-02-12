import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	type ComputedOptions,
	DEFAULT_EQUALITY,
	FLAG_DIRTY,
	link,
	type MemoCallback,
	type MemoNode,
	refresh,
	type SinkNode,
	TYPE_MEMO,
} from '../graph'
import { isObjectOfType, isSyncFunction } from '../util'

/* === Types === */

/**
 * A derived reactive computation that caches its result.
 * Automatically tracks dependencies and recomputes when they change.
 *
 * @template T - The type of value computed by the memo
 */
type Memo<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Memo'

	/**
	 * Gets the current value of the memo.
	 * Recomputes if dependencies have changed since last access.
	 * When called inside another reactive context, creates a dependency.
	 * @returns The computed value
	 * @throws UnsetSignalValueError If the memo value is still unset when read.
	 */
	get(): T
}

/* === Exported Functions === */

/**
 * Creates a derived reactive computation that caches its result.
 * The computation automatically tracks dependencies and recomputes when they change.
 * Uses lazy evaluation - only computes when the value is accessed.
 *
 * @since 0.18.0
 * @template T - The type of value computed by the memo
 * @param fn - The computation function that receives the previous value
 * @param options - Optional configuration for the memo
 * @returns A Memo object with a get() method
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
): Memo<T>
function createMemo<T extends {}>(
	fn: MemoCallback<T>,
	options?: ComputedOptions<T>,
): Memo<T>
function createMemo<T extends {}>(
	fn: MemoCallback<T>,
	options?: ComputedOptions<T>,
): Memo<T> {
	validateCallback(TYPE_MEMO, fn, isSyncFunction)
	if (options?.value !== undefined)
		validateSignalValue(TYPE_MEMO, options.value, options?.guard)

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
	}

	return {
		[Symbol.toStringTag]: TYPE_MEMO,
		get() {
			if (activeSink) link(node, activeSink)
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			validateReadValue(TYPE_MEMO, node.value)
			return node.value
		},
	}
}

/**
 * Checks if a value is a Memo signal.
 *
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Memo
 */
function isMemo<T extends {} = unknown & {}>(value: unknown): value is Memo<T> {
	return isObjectOfType(value, TYPE_MEMO)
}

export { createMemo, isMemo, type Memo }
