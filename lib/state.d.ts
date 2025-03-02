import { type Computed } from './computed';
import { type EffectCallbacks } from './effect';
export type State<T extends {}> = {
    [Symbol.toStringTag]: 'State';
    get(): T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    map<U extends {}>(fn: (value: T) => U): Computed<U>;
    match: (callbacks: EffectCallbacks<[State<T>]>) => void;
};
/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
export declare const state: <T extends {}>(v: T) => State<T>;
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
export declare const isState: <T extends {}>(value: unknown) => value is State<T>;
