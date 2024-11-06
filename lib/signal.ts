import { type State, isState } from "./state"
import { type Computed, isComputed } from "./computed"

/* === Types === */

type Signal<T> = State<T> | Computed<T>

type Notifier = () => void
type Watchers = Set<Notifier>

/* === Internals === */

// Currently active watcher
let active: () => void | undefined

// Batching state
let batching = false

// Pending notifications
const pending = new Set<() => void>()

/* === Namespace Signal === */

const isSignal = /*#__PURE__*/ (value: unknown): value is Signal<unknown> =>
	isState(value) || isComputed(value)

/**
 * Add notify function of active watchers to the set of watchers
 * 
 * @param {Set<() => void>} watchers - set of current watchers
 */
const subscribe = (watchers: Set<() => void>) => {
	if (active) watchers.add(active)
}

/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 * 
 * @param {Set<() => void>} watchers 
 */
const notify = (watchers: Set<() => void>) =>
	watchers.forEach(n => batching ? pending.add(n) : n())

/**
 * Run a function in a reactive context
 * 
 * @param {() => void} fn - function to run the computation or effect
 * @param {() => void} notify - function to be called when the state changes
 */
const watch = (fn: () => void, notify: () => void): void => {
	const prev = active
	active = notify
	fn()
	active = prev
}

const batch = (fn: () => void): void => {
    batching = true
    fn()
    batching = false
    pending.forEach(n => n())
    pending.clear()
}

export {
	type Signal, type Notifier, type Watchers,
    isSignal, subscribe, notify, watch, batch
}