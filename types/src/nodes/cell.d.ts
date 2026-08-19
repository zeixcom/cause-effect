import { type Cleanup, type ComputedOptions, type MemoCallback, type SignalOptions, type TaskCallback } from '../graph';
import { type Memo } from './memo';
import { type Sensor } from './sensor';
import { type State } from './state';
import { type Task } from './task';
/**
 * The single-value signal shape — the type union of `State`, `Memo`, `Task`, and `Sensor`.
 * A 1.x bridge for [ADR-0018](../../adr/0018-shape-indexed-signal-types.md)'s `Cell<T>`:
 * a genuine structural narrowing of `Signal<T>`, since each origin already carries a distinct
 * `Symbol.toStringTag` literal, so this union excludes `List`/`Store`/`Collection` at the type
 * level with no runtime tag change.
 *
 * @since 1.5.2
 * @template T - The type of value held by the cell
 */
type Cell<T extends {}> = State<T> | Memo<T> | Task<T> | Sensor<T>;
/**
 * The mutable single-value signal shape — an alias of `State`, matching `createCell`'s
 * `MutableCell<T>` return type ([ADR-0018](../../adr/0018-shape-indexed-signal-types.md)
 * decision 5: `createCell` aliases `createState`).
 *
 * @since 1.5.2
 * @template T - The type of value held by the cell
 */
type MutableCell<T extends {}> = State<T>;
/**
 * Configuration options for `deriveCell`'s function-input forms (sync and async).
 * Mirrors `ComputedOptions`, renamed to the `initial` vocabulary `deriveList`/`deriveStore`
 * already use, so the whole `derive*` family reads consistently.
 *
 * Unlike `deriveList`/`deriveStore`, `initial` stays optional here: those two default to an
 * empty array/record so a collection is never unset, but `Signal<T>` has no such universal
 * empty value for an unconstrained `T`. An early read before the first resolution throws
 * `UnsetSignalValueError`, exactly as `createTask` already behaves — see
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) §3, which scopes the
 * required-`initial` rule to `List`/`Store` only.
 *
 * @since 1.5.1
 * @template T - The type of value the signal holds
 */
type DeriveCellOptions<T extends {}> = SignalOptions<T> & {
    /** Initial value. Seeds a reducer pattern, or the value read before an async computation first resolves. */
    initial?: T;
    /**
     * Optional callback invoked when the signal is first watched by an effect.
     * Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
     * Must return a cleanup function that is called when the signal is no longer watched.
     */
    watched?: (invalidate: () => void) => Cleanup;
};
/**
 * The 1.5.0 name of `DeriveCellOptions`.
 *
 * @deprecated Use `DeriveCellOptions` instead — the ADR-0018 Revision (2026-08-17) names the
 * single-value shape `Cell` and keeps `Signal` as the umbrella, so the `derive*` options type
 * carries the `Cell` name. Same members, renamed. Removed in v2.0. See
 * [MIGRATION-2.0.md](../../MIGRATION-2.0.md).
 *
 * @since 1.5.0
 * @template T - The type of value the signal holds
 */
type DeriveSignalOptions<T extends {}> = DeriveCellOptions<T>;
/**
 * Create a derived signal from existing signals
 *
 * @deprecated Use `deriveCell(callback, options?)` instead — same dispatch (sync function →
 * `Memo`, async function → `Task`), returned as `Cell<T>` rather than the deprecated
 * `Memo`/`Task` union. `createComputed` is removed in v2.0. See
 * [MIGRATION-2.0.md](../../MIGRATION-2.0.md).
 *
 * @since 0.9.0
 * @param callback - Computation callback function
 * @param options - Optional configuration
 */
declare function createComputed<T extends {}>(callback: TaskCallback<T>, options?: ComputedOptions<T>): Task<T>;
declare function createComputed<T extends {}>(callback: MemoCallback<T>, options?: ComputedOptions<T>): Memo<T>;
/**
 * Create a read-only signal from any origin — the bridge replacement for `createComputed`,
 * under its terminal v2.0 name ([ADR-0018](../../adr/0018-shape-indexed-signal-types.md)
 * Revision 2026-08-17: the single-value shape is `Cell`; `Signal` stays the umbrella).
 * Dispatches on `input`: a sync function derives a `Memo`, an async function derives a
 * `Task`, and a seed value with `options.watched` derives a `Sensor`. All three are
 * returned as `Cell<T>` — origin is not part of the return type.
 *
 * @since 1.5.1
 * @template T - The type of value the signal holds
 * @param input - A computation function or a seed value
 * @param options - Optional configuration; `watched` is required when `input` is a seed value
 * @returns A read-only Cell
 *
 * @example
 * ```ts
 * const userId = createCell(1)
 * const user = deriveCell(async (_prev, abort) => {
 *   const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
 *   return res.json()
 * }, { initial: fallbackUser })
 * ```
 */
declare function deriveCell<T extends {}>(input: TaskCallback<T>, options?: DeriveCellOptions<T>): Cell<T>;
declare function deriveCell<T extends {}>(input: MemoCallback<T>, options?: DeriveCellOptions<T>): Cell<T>;
declare function deriveCell<T extends {}>(input: T, options: SignalOptions<T> & {
    watched: (set: (next: T) => void) => Cleanup;
}): Cell<T>;
/**
 * The 1.5.0 name of `deriveCell`.
 *
 * @deprecated Use `deriveCell(input, options?)` instead — `deriveSignal` shipped in 1.5.0
 * under the pre-Revision ADR-0018 vocabulary that named the single-value shape `Signal`.
 * Same dispatch and behavior, renamed. `deriveSignal` is removed in v2.0. See
 * [MIGRATION-2.0.md](../../MIGRATION-2.0.md).
 *
 * @since 1.5.0
 */
declare const deriveSignal: typeof deriveCell;
/**
 * Create a mutable single-value signal — the terminal v2.0 name for single-value mutable
 * construction ([ADR-0018](../../adr/0018-shape-indexed-signal-types.md) Revision 2026-08-17:
 * the single-value shape is `Cell`; `Signal` stays the umbrella). An alias of `createState`,
 * so `guard` and `equals` apply exactly as there. The value is taken verbatim — no shape
 * conversion: an array is held as an array value, not a `List`; a record as a record value,
 * not a `Store`. Use `createList`/`createStore` for those shapes.
 *
 * @since 1.5.1
 * @template T - The type of value the signal holds
 * @param value - The initial value
 * @param options - Optional configuration for the signal
 * @returns A MutableCell signal with get(), set(), and update() methods
 */
declare function createCell<T extends {}>(value: T, options?: SignalOptions<T>): MutableCell<T>;
/**
 * Check if a value is a computed signal
 *
 * @deprecated Removed in v2.0 with no mechanical replacement — origin is no longer part of the
 * consumption contract. Use `isSignal`/`isMutableSignal` or a plain property check instead. See
 * [MIGRATION-2.0.md](../../MIGRATION-2.0.md) § Origin guards.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a computed signal, false otherwise
 */
declare function isComputed<T extends {}>(value: unknown): value is Memo<T> | Task<T>;
/**
 * Check whether a value is a Cell — a State, Memo, Task, or Sensor.
 *
 * @since 1.5.2
 * @param value - Value to check
 * @returns True if value is a Cell, false otherwise
 */
declare function isCell<T extends {}>(value: unknown): value is Cell<T>;
/**
 * Check whether a value is a MutableCell — equivalent to `isState`, exported under the
 * forward-compatible name.
 *
 * @since 1.5.2
 * @param value - Value to check
 * @returns True if value is a MutableCell, false otherwise
 */
declare function isMutableCell<T extends {}>(value: unknown): value is MutableCell<T>;
export { type Cell, createCell, createComputed, type DeriveCellOptions, type DeriveSignalOptions, deriveCell, deriveSignal, isCell, isComputed, isMutableCell, type MutableCell, };
