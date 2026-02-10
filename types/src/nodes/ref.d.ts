import { type Cleanup } from '../graph';
/**
 * A read-only signal that holds an external reference.
 *
 * @template T - The type of value produced by the sensor
 */
type Ref<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Ref';
    /**
     * Gets the reference.
     * Notifies subscribers when the reference has updates.
     * When called inside another reactive context, creates a dependency.
     * @returns The reference value
     */
    get(): T;
};
/**
 * A callback function for refs when the reference starts being watched.
 *
 * @param notify - A function to notify subscribers when the reference has updates
 * @returns A cleanup function when the reference stops being watched
 */
type RefCallback = (notify: () => void) => Cleanup;
/**
 * A reactive reference to an external, immutable object.
 * The reference value itself never changes, but subscribers can be notified when
 * properties of the referenced object change. Only active when it has subscribers.
 *
 * Use this for:
 * - DOM elements (notify on attribute changes, mutations, intersection, etc.)
 * - Network connections (notify on status changes)
 * - External resources that need observation setup/teardown
 *
 * @since 0.18.0
 * @template T - The type of the referenced object
 */
declare function createRef<T extends {}>(value: T, start: RefCallback): Ref<T>;
/**
 * Checks if a value is a Ref signal.
 *
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Ref
 */
declare function isRef<T extends {} = unknown & {}>(value: unknown): value is Ref<T>;
export { createRef, isRef, type Ref, type RefCallback };
