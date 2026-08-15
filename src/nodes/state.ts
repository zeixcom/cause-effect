import { validateCallback, validateSignalValue } from '../errors'
import {
	activeSink,
	DEFAULT_EQUALITY,
	link,
	type SignalOptions,
	type StateNode,
	setState,
	TYPE_SIGNAL,
} from '../graph'
import type { MutableSignal } from './signal'

/* === Types === */

/**
 * A callback function for states that updates a value based on the previous value.
 *
 * @template T - The type of value
 * @param prev - The previous state value
 * @returns The new state value
 */
type UpdateCallback<T extends {}> = (prev: T) => T

const WHERE = 'createState'

/* === Exported Functions === */

/**
 * Creates a mutable reactive state container.
 * The shape this factory returns is `MutableSignal<T>` — the single-value, writable
 * member of the shape-indexed value-type set. See ADR-0018.
 *
 * @since 0.9.0
 * @template T - The type of value stored in the state
 * @param value - The initial value
 * @param options - Optional configuration for the state
 * @returns A MutableSignal object with get() and set() methods
 *
 * @example
 * ```ts
 * const count = createState(0);
 * count.set(1);
 * console.log(count.get()); // 1
 * ```
 *
 * @example
 * ```ts
 * // With type guard
 * const count = createState(0, {
 *   guard: (v): v is number => typeof v === 'number'
 * });
 * ```
 */
function createState<T extends {}>(
	value: T,
	options?: SignalOptions<T>,
): MutableSignal<T> {
	validateSignalValue(WHERE, value, options?.guard)

	const node: StateNode<T> = {
		value,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		guard: options?.guard,
	}

	return {
		[Symbol.toStringTag]: TYPE_SIGNAL,
		get(): T {
			if (activeSink) link(node, activeSink)
			return node.value
		},
		set(next: T): void {
			validateSignalValue(WHERE, next, node.guard)
			setState(node, next)
		},
		update(fn: UpdateCallback<T>): void {
			validateCallback(WHERE, fn)
			const next = fn(node.value)
			validateSignalValue(WHERE, next, node.guard)
			setState(node, next)
		},
	}
}

export { createState, type UpdateCallback }
