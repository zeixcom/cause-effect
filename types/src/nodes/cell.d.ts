import { type CellCallback, type CellOptions, type DeriveCellOptions, type MemoCallback, type TaskCallback } from '../graph';
/**
 * A readable single-value shape, matching both the mutable and readonly single-value
 * signals. The tag is narrowed to the `'Cell'` literal, so no other shape is structurally
 * assignable to `Cell` merely by carrying a `get()` method. See ADR-0018.
 *
 * @template T - The type of value held by the cell
 */
type Cell<T extends {}> = {
    readonly [Symbol.toStringTag]?: 'Cell';
    get(): T;
};
/**
 * A readable and writable single-value signal.
 * The complete value-type set is `Cell`/`MutableCell`, `List`/`MutableList`, and
 * `Store`/`MutableStore` — indexed by shape and mutability, not by origin. See ADR-0018.
 *
 * @template T - The type of value held by the signal
 */
type MutableCell<T extends {}> = Cell<T> & {
    set(value: T): void;
    update(callback: (value: T) => T): void;
};
/**
 * The umbrella signal shape — any of `Cell`, `List`, or `Store`, matched structurally by
 * `get()` alone, not by tag. This is the pre-ADR-0018 meaning of `Signal`, kept for code
 * that genuinely wants to accept any shape. Use `Cell` when only the narrow single-value
 * shape is meant. See ADR-0018.
 *
 * @template T - The type of value returned by get()
 */
type Signal<T extends {}> = {
    readonly [Symbol.toStringTag]?: string;
    get(): T;
};
/**
 * Create a mutable single-value cell from a plain value.
 *
 * `create*` yields the writable shape and takes the value verbatim — no shape
 * sniffing. An array is held as an array value, not converted to a `MutableList`;
 * a record is held as a record value, not converted to a `MutableStore`. Use
 * `createList` and `createStore` for those shapes, and `deriveCell` for any
 * derivation. See ADR-0018.
 *
 * @since 2.0.0
 * @template T - The type of value stored in the cell
 * @param value - The initial value
 * @param options - Optional configuration for the cell
 * @returns A MutableCell object with get(), set(), and update() methods
 *
 * @example
 * ```ts
 * const count = createCell(0)
 * count.set(1)
 * console.log(count.get()) // 1
 * ```
 */
declare function createCell<T extends {}>(value: T, options?: CellOptions<T>): MutableCell<T>;
/**
 * Create a read-only single-value cell from any origin.
 *
 * The origin follows from `input`, so one factory covers every way a value can
 * come to exist. A derived cell has no setter — writing to it is a compile
 * error rather than a convention to remember.
 *
 * | `input` | `options` | Origin | Replaces |
 * |---|---|---|---|
 * | sync function | — | Synchronous derivation | `createMemo` |
 * | async function | `initial` optional | Asynchronous derivation | — |
 * | seed value | `watched` required | External push | — |
 *
 * @since 2.0.0
 * @template T - The type of value the cell holds
 * @param input - A computation function or a seed value
 * @param options - Optional configuration
 * @returns A Cell object with a get() method
 *
 * @example
 * ```ts
 * const userId = createCell(1)
 * const user = deriveCell(async (_prev, abortSignal) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal })
 *   return response.json()
 * }, { initial: fallbackUser })
 * ```
 */
declare function deriveCell<T extends {}>(input: TaskCallback<T> | MemoCallback<T>, options?: DeriveCellOptions<T>): Cell<T>;
declare function deriveCell<T extends {}>(input: T, options: CellOptions<T> & {
    initial?: T;
} & {
    watched: CellCallback<T>;
}): Cell<T>;
/**
 * Check whether a value is a Cell — the single-value shape, matching both the mutable
 * and readonly single-value signals. Use `isMutableCell` to also require write access.
 * `List` and `Store` are distinct shapes with their own guards. See ADR-0018.
 *
 * @since 2.0.0
 * @param value - Value to check
 * @returns True if value is a Cell, false otherwise
 */
declare function isCell<T extends {}>(value: unknown): value is Cell<T>;
/**
 * Check whether a value is a mutable Cell.
 *
 * @since 2.0.0
 * @param value - Value to check
 * @returns True if value is a mutable Cell, false otherwise
 */
declare function isMutableCell(value: unknown): value is MutableCell<unknown & {}>;
/**
 * Check whether a value is a Signal — the umbrella shape matched structurally by `get()`
 * alone, covering `Cell`, `List`, and `Store` alike. Use `isCell`/`isList`/`isStore` to
 * check a specific shape. See ADR-0018.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
declare function isSignal<T extends {}>(value: unknown): value is Signal<T>;
/**
 * Check whether a value is a mutable Signal — the umbrella shape, matching a writable
 * `Cell`, `List`, or `Store` alike.
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a mutable Signal, false otherwise
 */
declare function isMutableSignal(value: unknown): value is Signal<unknown & {}> & {
    set(value: unknown & {}): void;
};
export { type Cell, createCell, deriveCell, isCell, isMutableCell, isMutableSignal, isSignal, type MutableCell, type Signal, };
