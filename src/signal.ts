import { validateCallback } from './errors'
import {
	type Cleanup,
	type ComputedOptions,
	type MemoCallback,
	type MutableSignal,
	type Signal,
	type SignalOptions,
	type TaskCallback,
	TYPE_SIGNAL,
} from './graph'
import { createMemo } from './nodes/memo'
import {
	createSensor,
	type SensorCallback,
	type SensorOptions,
} from './nodes/sensor'
import { createState } from './nodes/state'
import { createTask } from './nodes/task'
import {
	isAsyncFunction,
	isFunction,
	isSignalOfType,
	isSyncFunction,
} from './util'

/* === Types === */

/**
 * Options for `deriveSignal`. Which members apply depends on the input kind:
 * `initial` seeds the async form (optional — without it the signal is unset
 * until the first resolution), and `watched` is required when the input is a
 * seed value (external push). See ADR-0018.
 *
 * @template T - The type of value the signal holds
 */
type DeriveSignalOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Initial value for the async derivation form. Optional escape from
	 * `UnsetSignalValueError` before the first resolution.
	 */
	initial?: T

	/**
	 * For a function input: an invalidation callback, as on `createMemo` and
	 * `createTask`. For a seed value: the external-push lifecycle, required.
	 */
	watched?: ((invalidate: () => void) => Cleanup) | SensorCallback<T>
}

/* === Factory Functions === */

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
function createSignal<T extends {}>(
	value: T,
	options?: SignalOptions<T>,
): MutableSignal<T> {
	return createState(value, options)
}

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
 * const user = deriveSignal(async (_prev, abort) => {
 *   const response = await fetch(`/api/users/${userId.get()}`, { signal: abort })
 *   return response.json()
 * }, { initial: fallbackUser })
 * ```
 */
function deriveSignal<T extends {}>(
	input: TaskCallback<T> | MemoCallback<T>,
	options?: DeriveSignalOptions<T>,
): Signal<T>
function deriveSignal<T extends {}>(
	input: T,
	options: DeriveSignalOptions<T> & { watched: SensorCallback<T> },
): Signal<T>
function deriveSignal<T extends {}>(
	input: MemoCallback<T> | TaskCallback<T> | T,
	options?: DeriveSignalOptions<T>,
): Signal<T> {
	if (isFunction(input)) {
		// The narrow factories name the seed `value`; the façade family says `initial`.
		// Built conditionally so `undefined` is never assigned to an optional
		// property (`exactOptionalPropertyTypes`).
		const seed = options?.initial as T | undefined
		const computed = (
			seed === undefined ? options : { ...options, value: seed }
		) as ComputedOptions<T>
		return isAsyncFunction(input)
			? createTask(input as TaskCallback<T>, computed)
			: createMemo(input as MemoCallback<T>, computed)
	}

	// External push: a seed value plus a watched lifecycle.
	const watched = options?.watched as SensorCallback<T> | undefined
	validateCallback('deriveSignal', watched, isSyncFunction)
	const sensorOptions: SensorOptions<T> = { value: input as T }
	if (options?.equals !== undefined) sensorOptions.equals = options.equals
	if (options?.guard !== undefined) sensorOptions.guard = options.guard
	return createSensor(watched, sensorOptions)
}

/* === Guards === */

/**
 * Check whether a value is a Signal — the single-value shape, matching both the mutable
 * and readonly single-value signals. Use `isMutableSignal` to also require write access.
 * `List` and `Store` are distinct shapes with their own guards. See ADR-0018.
 *
 * @since 0.9.0
 * @param value - Value to check
 * @returns True if value is a Signal, false otherwise
 */
function isSignal<T extends {}>(value: unknown): value is Signal<T> {
	return isSignalOfType(value, TYPE_SIGNAL)
}

/**
 * Check whether a value is a mutable Signal.
 *
 * @since 0.15.2
 * @param value - Value to check
 * @returns True if value is a mutable Signal, false otherwise
 */
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}> {
	return (
		isSignal(value) &&
		typeof (value as Record<string, unknown>).set === 'function'
	)
}

export {
	createSignal,
	type DeriveSignalOptions,
	deriveSignal,
	isMutableSignal,
	isSignal,
}
