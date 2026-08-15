import { type SignalOptions } from '../graph';
import type { MutableSignal } from './signal';
/**
 * A callback function for states that updates a value based on the previous value.
 *
 * @template T - The type of value
 * @param prev - The previous state value
 * @returns The new state value
 */
type UpdateCallback<T extends {}> = (prev: T) => T;
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
declare function createState<T extends {}>(value: T, options?: SignalOptions<T>): MutableSignal<T>;
export { createState, type UpdateCallback };
