import { type SignalOptions } from '../graph';
/**
 * A callback function for states that updates a value based on the previous value.
 *
 * @template T - The type of value
 * @param prev - The previous state value
 * @returns The new state value
 */
type UpdateCallback<T extends {}> = (prev: T) => T;
/**
 * A mutable reactive state container.
 * Changes to the state will automatically propagate to dependent computations and effects.
 *
 * @template T - The type of value stored in the state
 */
type State<T extends {}> = {
    readonly [Symbol.toStringTag]: 'State';
    /**
     * Gets the current value of the state.
     * When called inside a memo, task, or effect, creates a dependency.
     * @returns The current value
     */
    get(): T;
    /**
     * Sets a new value for the state.
     * If the new value is different (according to the equality function), all dependents will be notified.
     * @param next - The new value to set
     */
    set(next: T): void;
    /**
     * Updates the state with a new value computed by a callback function.
     * The callback receives the current value as an argument.
     * @param fn - The callback function to compute the new value
     */
    update(fn: UpdateCallback<T>): void;
};
/**
 * Creates a mutable reactive state container.
 *
 * @since 0.9.0
 * @template T - The type of value stored in the state
 * @param value - The initial value
 * @param options - Optional configuration for the state
 * @returns A State object with get() and set() methods
 *
 * @example
 * ```ts
 * const count = createState(0);
 * count.set(1);
 * console.log(count.get()); // 1
 * ```
 *
 * @example
 * ```ts
 * // With type guard
 * const count = createState(0, {
 *   guard: (v): v is number => typeof v === 'number'
 * });
 * ```
 */
declare function createState<T extends {}>(value: T, options?: SignalOptions<T>): State<T>;
/**
 * Checks if a value is a State signal.
 *
 * @since 0.9.0
 * @param value - The value to check
 * @returns True if the value is a State
 *
 * @example
 * ```ts
 * const state = createState(0);
 * if (isState(state)) {
 *   state.set(1); // TypeScript knows state has set()
 * }
 * ```
 */
declare function isState<T extends {} = unknown & {}>(value: unknown): value is State<T>;
export { createState, isState, type State, type UpdateCallback };
