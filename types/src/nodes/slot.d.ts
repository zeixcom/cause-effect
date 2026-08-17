import { type CellOptions } from '../graph';
import { type Signal } from './cell';
/**
 * A descriptor for a derived reactive value with an optional setter.
 *
 * @template T - The type of value
 */
type SlotDescriptor<T extends {}> = {
    /** Reads the value, tracking dependencies. */
    get(): T;
    /** Optional setter to update the source value. */
    set?(next: T): void;
};
/**
 * A signal that delegates its value to a swappable backing signal.
 *
 * A slot is a stable source at a fixed position, such as an object property. `replace()`
 * swaps the backing signal without breaking the edges to its sinks.
 * The object shape is compatible with `Object.defineProperty()` descriptors. The property
 * definition uses `get`, `set`, `configurable`, and `enumerable`. The slot object also
 * carries `replace()` and `current()` for control from an integration layer.
 *
 * Slots are not `MutableCell`s: they are forwarding layers, not value owners.
 * `set()` delegates to the backing signal; `update()` is intentionally absent.
 *
 * @template T - The type of value held by the delegated signal.
 */
type Slot<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Slot';
    /** Descriptor field: allows the property to be redefined or deleted. */
    configurable: true;
    /** Descriptor field: the property shows up during enumeration. */
    enumerable: true;
    /** Reads the current value from the delegated signal, tracking dependencies. */
    get(): T;
    /** Writes a value to the delegated signal. Throws `ReadonlySignalError` if the delegated signal is read-only. */
    set(next: T): void;
    /** Swaps the backing signal and invalidates every downstream sink. Narrowing (`U extends T`) is allowed. */
    replace<U extends T>(next: Signal<U> | SlotDescriptor<U>): void;
    /** Returns the currently delegated signal. */
    current(): Signal<T> | SlotDescriptor<T>;
};
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
declare function createSlot<T extends {}>(initialSignal: Signal<T> | SlotDescriptor<T>, options?: CellOptions<T>): Slot<T>;
/**
 * Checks if a value is a Slot signal.
 *
 * @since 0.18.3
 * @param value - The value to check
 * @returns True if the value is a Slot
 */
declare function isSlot<T extends {} = unknown & {}>(value: unknown): value is Slot<T>;
export { createSlot, isSlot, type Slot, type SlotDescriptor };
