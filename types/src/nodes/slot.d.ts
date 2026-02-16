import { type Signal, type SignalOptions } from '../graph';
/**
 * A signal that delegates its value to a swappable backing signal.
 *
 * Slots provide a stable reactive source at a fixed position (e.g. an object property)
 * while allowing the backing signal to be replaced without breaking subscribers.
 * The object shape is compatible with `Object.defineProperty()` descriptors:
 * `get`, `set`, `configurable`, and `enumerable` are used by the property definition;
 * `replace()` and `current()` are kept on the slot object for integration-layer control.
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
    /** Swaps the backing signal, invalidating all downstream subscribers. Narrowing (`U extends T`) is allowed. */
    replace<U extends T>(next: Signal<U>): void;
    /** Returns the currently delegated signal. */
    current(): Signal<T>;
};
/**
 * Creates a slot signal that delegates its value to a swappable backing signal.
 *
 * A slot acts as a stable reactive source that can be used as a property descriptor
 * via `Object.defineProperty(target, key, slot)`. Subscribers link to the slot itself,
 * so replacing the backing signal with `replace()` invalidates them without breaking
 * existing edges. Setter calls forward to the current backing signal when it is writable.
 *
 * @since 0.18.3
 * @template T - The type of value held by the delegated signal.
 * @param initialSignal - The initial signal to delegate to.
 * @param options - Optional configuration for the slot.
 * @param options.equals - Custom equality function. Defaults to strict equality (`===`).
 * @param options.guard - Type guard to validate values passed to `set()`.
 * @returns A `Slot<T>` object usable both as a property descriptor and as a reactive signal.
 */
declare function createSlot<T extends {}>(initialSignal: Signal<T>, options?: SignalOptions<T>): Slot<T>;
/**
 * Checks if a value is a Slot signal.
 *
 * @since 0.18.3
 * @param value - The value to check
 * @returns True if the value is a Slot
 */
declare function isSlot<T extends {} = unknown & {}>(value: unknown): value is Slot<T>;
export { createSlot, isSlot, type Slot };
