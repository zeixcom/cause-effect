import { ReadonlySignalError, validateSignalValue } from '../errors'
import {
	activeSink,
	batchDepth,
	DEFAULT_EQUALITY,
	FLAG_DIRTY,
	flush,
	link,
	type MemoNode,
	propagate,
	refresh,
	type Signal,
	type SignalOptions,
	type SinkNode,
	TYPE_SLOT,
} from '../graph'
import { isSignal } from '../signal'
import { isSignalOfType } from '../util'

/* === Types === */

/**
 * A descriptor for a derived reactive value with an optional setter.
 *
 * @template T - The type of value
 */
type SlotDescriptor<T extends {}> = {
	/** Reads the value, tracking dependencies. */
	get(): T
	/** Optional setter to update the source value. */
	set?(next: T): void
}

/**
 * A signal that delegates its value to a swappable backing signal.
 *
 * A slot is a stable source at a fixed position, such as an object property. `replace()`
 * swaps the backing signal without breaking the edges to its sinks.
 * The object shape is compatible with `Object.defineProperty()` descriptors. The property
 * definition uses `get`, `set`, `configurable`, and `enumerable`. The slot object also
 * carries `replace()` and `current()` for control from an integration layer.
 *
 * Slots are not `MutableSignal`s: they are forwarding layers, not value owners.
 * `set()` delegates to the backing signal; `update()` is intentionally absent.
 *
 * @template T - The type of value held by the delegated signal.
 */
type Slot<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Slot'
	/** Descriptor field: allows the property to be redefined or deleted. */
	configurable: true
	/** Descriptor field: the property shows up during enumeration. */
	enumerable: true
	/** Reads the current value from the delegated signal, tracking dependencies. */
	get(): T
	/** Writes a value to the delegated signal. Throws `ReadonlySignalError` if the delegated signal is read-only. */
	set(next: T): void
	/** Swaps the backing signal and invalidates every downstream sink. Narrowing (`U extends T`) is allowed. */
	replace<U extends T>(next: Signal<U> | SlotDescriptor<U>): void
	/** Returns the currently delegated signal. */
	current(): Signal<T> | SlotDescriptor<T>
}

/* === Internal Functions === */

// Tracks slot nodes visited by the current top-level set() call to break
// cycles when slots delegate to each other (A -> B -> A). Cleared when the
// outermost set() unwinds.
const settingSlots = new WeakSet<object>()

function isSignalOrDescriptor<T extends {}>(
	value: unknown,
): value is Signal<T> | SlotDescriptor<T> {
	if (isSignal(value)) return true
	return (
		value !== null &&
		typeof value === 'object' &&
		'get' in value &&
		typeof value.get === 'function'
	)
}

/* === Exported Functions === */

/**
 * Creates a slot signal that delegates its value to a swappable backing signal.
 *
 * A slot acts as a stable reactive source usable as a property descriptor via
 * `Object.defineProperty(target, key, slot)`. Sinks link to the slot itself, so
 * `replace()` invalidates them without breaking existing edges. `set()` forwards to the
 * current backing signal if it is writable. `update()` is absent, because a slot is a
 * forwarding layer, not a value owner.
 *
 * @since 0.18.3
 * @template T - The type of value held by the delegated signal.
 * @param initialSignal - The initial signal to delegate to.
 * @param options - Optional configuration for the slot.
 * @param options.equals - Custom equality function. Defaults to strict equality (`===`).
 * @param options.guard - Type guard to validate values passed to `set()`.
 * @returns A `Slot<T>` object usable both as a property descriptor and as a reactive signal.
 */
function createSlot<T extends {}>(
	initialSignal: Signal<T> | SlotDescriptor<T>,
	options?: SignalOptions<T>,
): Slot<T> {
	validateSignalValue(TYPE_SLOT, initialSignal, isSignalOrDescriptor)

	let delegated = initialSignal
	const guard = options?.guard

	const node: MemoNode<T> = {
		fn: () => delegated.get(),
		value: undefined as unknown as T,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		error: undefined,
	}

	const get = (): T => {
		if (activeSink) link(node, activeSink)
		refresh(node as unknown as SinkNode)
		if (node.error) throw node.error
		return node.value
	}

	const set = (next: T): void => {
		// Cycle guard: if this slot's node is already in the middle of a set()
		// call (mutual delegation A -> B -> A), the chain has no terminal
		// writable signal. Throw a descriptive error instead of stack-overflowing.
		if (settingSlots.has(node))
			throw new Error('[Slot] Circular delegation detected in set()')
		settingSlots.add(node)
		try {
			if (isSlot(delegated)) return void delegated.set(next)
			if ('set' in delegated && typeof delegated.set === 'function') {
				validateSignalValue(TYPE_SLOT, next, guard)
				delegated.set(next)
			} else {
				throw new ReadonlySignalError(TYPE_SLOT)
			}
		} finally {
			settingSlots.delete(node)
		}
	}

	const replace = <U extends T>(next: Signal<U> | SlotDescriptor<U>): void => {
		validateSignalValue(TYPE_SLOT, next, isSignalOrDescriptor)

		delegated = next
		node.flags |= FLAG_DIRTY
		for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
		if (batchDepth === 0) flush()
	}

	return {
		[Symbol.toStringTag]: TYPE_SLOT,
		configurable: true,
		enumerable: true,
		get,
		set,
		replace,
		current: () => delegated,
	}
}

/**
 * Checks if a value is a Slot signal.
 *
 * @since 0.18.3
 * @param value - The value to check
 * @returns True if the value is a Slot
 */
function isSlot<T extends {} = unknown & {}>(value: unknown): value is Slot<T> {
	return isSignalOfType(value, TYPE_SLOT)
}

export { createSlot, isSlot, type Slot, type SlotDescriptor }
