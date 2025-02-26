import { type State, isState, state } from "./state"
import { computed, type Computed, isComputed } from "./computed"
import { isComputeFunction } from "./util"

/* === Types === */

type Signal<T extends {}> = State<T> | Computed<T>

type MaybeSignal<T extends {}> = State<T> | Computed<T> | T | ((old?: T) => T)

type Watcher = () => void

/* === Internals === */

// Currently active watcher
let active: () => void | undefined

// Batching state
let batchDepth = 0

// Pending notifications
const markQueue: Set<Watcher> = new Set()

// Pending runs
const runQueue: Set<() => void> = new Set()

/**
 * Flush pending notifications and runs
 */
const flush = () => {
	while (markQueue.size || runQueue.size) {
		markQueue.forEach(mark => mark())
		markQueue.clear()
		runQueue.forEach(run => run())
		runQueue.clear()
	}
}

/* === Constants === */

export const UNSET: any = Symbol()

/* === Exported Functions === */

/**
 * Check whether a value is a Signal or not
 * 
 * @since 0.9.0
 * @param {any} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
const isSignal = /*#__PURE__*/ <T extends {}>(value: any): value is Signal<T> =>
	isState(value) || isComputed(value)

/**
 * Convert a value to a Signal if it's not already a Signal
 * 
 * @since 0.9.6
 * @param {MaybeSignal<T>} value - value to convert to a Signal
 * @param memo 
 * @returns {Signal<T>} - converted Signal
 */
const toSignal = /*#__PURE__*/ <T extends {}>(
	value: MaybeSignal<T>
): Signal<T> =>
	isSignal<T>(value) ? value
		: isComputeFunction<T>(value) ? computed(value)
		: state(value)

/**
 * Add notify function of active watchers to the set of watchers
 * 
 * @param {Watcher[]} watchers - set of current watchers
 */
const subscribe = (watchers: Watcher[]) => {
	if (active && !watchers.includes(active)) watchers.push(active)
}

/**
 * Notify all subscribers of the state change or add to the pending set if batching is enabled
 * 
 * @param {Watcher[]} watchers 
 */
const notify = (watchers: Watcher[]) => {
	watchers.forEach(mark => batchDepth ? markQueue.add(mark) : mark())
}

/**
 * Run a function in a reactive context
 * 
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} mark - function to be called when the state changes
 */
const watch = (run: () => void, mark: Watcher): void => {
	const prev = active
	active = mark
	run()
	active = prev
}

/**
 * Batch multiple state changes into a single update
 * 
 * @param {() => void} run - function to run the batch of state changes
 */
const batch = (run: () => void): void => {
    batchDepth++
    run()
    batchDepth--
	if (!batchDepth) flush()
}

export {
	type Signal, type MaybeSignal, type Watcher,
    isSignal, toSignal, subscribe, notify, watch, batch
}