import { type DeriveSignalOptions, type MemoCallback, type MutableSignal, type Signal, type SignalCallback, type SignalOptions, type TaskCallback } from './graph';
/**
 * Create a mutable single-value signal from a plain value.
 *
 * `create*` yields the writable shape and takes the value verbatim — no shape
 * sniffing. An array is held as an array value, not converted to a `MutableList`;
 * a record is held as a record value, not converted to a `MutableStore`. Use
 * `createList` and `createStore` for those shapes, and `deriveSignal` for any
 * derivation. See ADR-0018.
 *
 * @since 0.9.6
 * @template T - The type of value stored in the signal
 * @param value - The initial value
 * @param options - Optional configuration for the signal
 * @returns A MutableSignal object with get(), set(), and update() methods
 *
 * @example
 * ```ts
 * const count = createSignal(0)
 * count.set(1)
 * console.log(count.get()) // 1
 * ```
 */
declare function createSignal<T extends {}>(value: T, options?: SignalOptions<T>): MutableSignal<T>;
/**
 * Create a read-only single-value signal from any origin.
 *
 * The origin follows from `input`, so one factory covers every way a value can
 * come to exist. A derived signal has no setter — writing to it is a compile
 * error rather than a convention to remember.
 *
 * | `input` | `options` | Origin | Replaces |
 * |---|---|---|---|
 * | sync function | — | Synchronous derivation | `createMemo` |
 * | async function | `initial` optional | Asynchronous derivation | `createTask` |
 * | seed value | `watched` required | External push | `createSensor` |
 *
 * @since 2.0.0
 * @template T - The type of value the signal holds
 * @param input - A computation function or a seed value
 * @param options - Optional configuration
 * @returns A Signal object with a get() method
 *
 * @example
 * ```ts
 * const userId = createSignal(1)
 * const user = deriveSignal(async (_prev, abortSignal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal })
 *   return response.json()
 * }, { initial: fallbackUser })
 * ```
 */
declare function deriveSignal<T extends {}>(input: TaskCallback<T> | MemoCallback<T>, options?: DeriveSignalOptions<T>): Signal<T>;
declare function deriveSignal<T extends {}>(input: T, options: SignalOptions<T> & {
    initial?: T;
} & {
    watched: SignalCallback<T>;
}): Signal<T>;
/**
 * Check whether a value is a Signal — the single-value shape, matching both the mutable
 * and readonly single-value signals. Use `isMutableSignal` to also require write access.
 * `List` and `Store` are distinct shapes with their own guards. See ADR-0018.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
declare function isSignal<T extends {}>(value: unknown): value is Signal<T>;
/**
 * Check whether a value is a mutable Signal.
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a mutable Signal, false otherwise
 */
declare function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}>;
export { createSignal, deriveSignal, isMutableSignal, isSignal };
