import { type Signal, type SignalOptions } from '../graph';
/**
 * A signal that delegates its value to a swappable other signal.
 *
 * @template T - The type of value returned by the delegated signal.
 */
type Slot<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Slot';
    configurable: true;
    enumerable: true;
    get(): T;
    set(next: T): void;
    replace<U extends T>(next: Signal<U>): void;
    current(): Signal<T>;
};
/**
 * Creates a slot signal that delegates its value to a swappable other signal.
 *
 * @since 0.18.3
 * @template T - The type of value returned by the delegated signal.
 * @param initialSignal - The initial signal to delegate to.
 * @param options - Optional configuration for the slot.
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`).
 * @param options.guard - Optional type guard to validate values.
 * @returns A slot signal.
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
