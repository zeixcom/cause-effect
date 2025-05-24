import { type Computed, type MapCallback } from './computed';
import { type Cleanup } from './scheduler';
import { type TapMatcher } from './effect';
type State<T extends {}> = {
    [Symbol.toStringTag]: 'State';
    get(): T;
    set(v: T): void;
    update(fn: (v: T) => T): void;
    map<U extends {}>(fn: MapCallback<T, U>): Computed<U>;
    tap(matcher: TapMatcher<T> | ((v: T) => void | Cleanup)): Cleanup;
};
/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
declare const state: <T extends {}>(initialValue: T) => State<T>;
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
declare const isState: <T extends {}>(value: unknown) => value is State<T>;
export { type State, state, isState };
