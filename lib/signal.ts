import { State } from "./state"
import { Computed } from "./computed"

/* === Types === */

export type Signal<T> = State<T> | Computed<T>

/* === Internals === */

// Currently active watcher
let active: () => void | undefined

// Batching state
let batching = false

// Pending notifications
const pending = new Set<() => void>()

/* === Namespace Signal === */

export function map<T, U>(
	this: Signal<T>,
	fn: (value: T) => U
): Computed<U> {
	return Computed.of<U>(() => fn(this.get()))
}

export const isSignal = (value: unknown): value is Signal<unknown> =>
	State.isState(value) || Computed.isComputed(value)

/**
 * Add notify function of active watchers to the set of watchers
 * 
 * @param {Set<() => void>} watchers - set of current watchers
 */
export const subscribe = (watchers: Set<() => void>) => {
	if (active) watchers.add(active)
	// return () => watchers.delete(active);
}

/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 * 
 * @param {Set<() => void>} watchers 
 */
export const notify = (watchers: Set<() => void>) =>
	watchers.forEach(n => batching ? pending.add(n) : n())

/**
 * Run a function in a reactive context
 * 
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
export const watch = (fn: () => void, notify: () => void): void => {
	const prev = active
	active = notify
	fn()
	active = prev
}

export const batch = (fn: () => void): void => {
    batching = true
    fn()
    batching = false
    pending.forEach(n => n())
    pending.clear()
}