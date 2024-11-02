import { State } from "./state"
import { Computed } from "./computed"

/* === Types === */

type Signal<T> = State<T> | Computed<T>

/* === Internals === */

// Hold the currently active reactive context
let active: () => void | undefined

/* === Namespace Signal === */

/**
 * Add notify function of active listener to the set of listeners
 * 
 * @param {Set<() => void>} targets - set of current listeners
 */
export const autotrack = (targets: Set<() => void>) => {
	if (active) targets.add(active)
}

/**
 * Run all notify function of dependent listeners
 * 
 * @param {Set<() => void>} targets 
 */
export const autorun = (targets: Set<() => void>) =>
	targets.forEach(notify => notify())


/**
 * Run a function in a reactive context
 * 
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
export const reactive = (fn: () => void, notify: () => void): void => {
	const prev = active
	active = notify
	fn()
	active = prev
}

export const isSignal = (value: unknown): value is Signal<unknown> =>
	State.isState(value) || Computed.isComputed(value)