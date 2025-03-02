import { UNSET } from './signal'
import { type Computed, computed } from './computed'
import { isObjectOfType } from './util';
import { type Watcher, notify, subscribe } from './scheduler'
import { type EffectCallbacks, effect } from './effect';

/* === Types === */

export type State<T extends {}> = {
    [Symbol.toStringTag]: 'State';
    get(): T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
    map<U extends {}>(fn: (value: T) => U): Computed<U>;
	match: (callbacks: EffectCallbacks<[State<T>]>) => void
}

/* === Constants === */

const TYPE_STATE = 'State'

/* === State Factory === */

/**
 * Create a new state signal
 * 
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
export const state = /*#__PURE__*/ <T extends {}>(v: T): State<T> => {
	const watchers: Watcher[] = []
	let value: T = v

	const s: State<T> = {
		[Symbol.toStringTag]: TYPE_STATE,

		/**
		 * Get the current value of the state
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @returns {T} - current value of the state
		 */
        get: (): T => {
			subscribe(watchers)
        	return value
		},

		/**
		 * Set a new value of the state
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @param {T} v
		 * @returns {void}
		 */
        set: (v: T): void => {
            if (Object.is(value, v)) return
            value = v
            notify(watchers)

            // Setting to UNSET clears the watchers so the signal can be garbage collected
            if (UNSET === value) watchers.length = 0 // head = tail = undefined
        },

		/**
		 * Update the state with a new value using a function
		 * 
		 * @since 0.10.0
		 * @method of State<T>
		 * @param {(v: T) => T} fn
		 * @returns {void} - updates the state with the result of the function
		 */
        update: (fn: (v: T) => T): void => {
            s.set(fn(value))
        },

		/**
		 * Create a computed signal from the current state signal
		 * 
		 * @since 0.9.0
		 * @method of State<T>
		 * @param {(v: T) => R} fn
		 * @returns {Computed<R>} - computed signal
		 */
        map: <R extends {}>(fn: (v: T) => R): Computed<R> => {
            return computed(() => fn(s.get()))
        },

		/**
		 * Case matching for the state signal with effect callbacks
		 * 
		 * @since 0.12.0
		 * @method of State<T>
		 * @param {EffectCallbacks[<T>]} callbacks 
		 * @returns {void} - executes the effect callbacks when the computed signal changes
		 */
		match: (callbacks: EffectCallbacks<[State<T>]>): void =>
			effect(callbacks, s),
	}

	return s
}

/**
 * Check if the provided value is a State instance
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
export const isState = /*#__PURE__*/ <T extends {}>(value: unknown): value is State<T> =>
	isObjectOfType(value, TYPE_STATE)
