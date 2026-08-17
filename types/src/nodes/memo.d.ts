import { type DeriveSignalOptions, type MemoCallback } from '../graph';
import type { Cell } from './cell';
/**
 * Creates a derived reactive computation that caches its result.
 * The computation automatically tracks dependencies and recomputes when they change.
 * Uses lazy evaluation - only computes when the value is accessed.
 * The shape this factory returns is `Cell<T>` — the single-value, readonly member of the
 * shape-indexed value-type set. See ADR-0018.
 *
 * @since 0.18.0
 * @template T - The type of value computed by the memo
 * @param fn - The computation function that receives the previous value
 * @param options - Optional configuration for the memo
 * @param options.initial - Optional initial value for reducer patterns
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`)
 * @param options.guard - Optional type guard to validate values
 * @param options.watched - Optional callback invoked when the memo is first watched by an effect.
 *   Receives an `invalidate` function to mark the memo dirty and trigger recomputation.
 *   Must return a cleanup function called when no effects are watching.
 * @returns A Cell object with a get() method
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const doubled = deriveComputed(() => count.get() * 2);
 * console.log(doubled.get()); // 0
 * count.set(5);
 * console.log(doubled.get()); // 10
 * ```
 *
 * @example
 * ```ts
 * // Using previous value
 * const sum = deriveComputed((prev) => prev + count.get(), { initial: 0, equals: Object.is });
 * ```
 */
declare function deriveComputed<T extends {}>(fn: (prev: T) => T, options: DeriveSignalOptions<T> & {
    initial: T;
}): Cell<T>;
declare function deriveComputed<T extends {}>(fn: MemoCallback<T>, options?: DeriveSignalOptions<T>): Cell<T>;
export { deriveComputed };
