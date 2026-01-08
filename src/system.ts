import { assert, type Guard } from './errors'
import type { UnknownSignal } from './signal'

/* === Types === */

type Cleanup = () => void

// biome-ignore lint/suspicious/noConfusingVoidType: optional Cleanup return type
type MaybeCleanup = Cleanup | undefined | void

type Watcher = {
	(): void
	run(): void
	onCleanup(cleanup: Cleanup): void
	stop(): void
}

type SignalOptions<T extends unknown & {}> = {
	guard?: Guard<T>
	watched?: () => void
	unwatched?: () => void
}

/* === Internal === */

// Currently active watcher
let activeWatcher: Watcher | undefined

const watchersMap = new WeakMap<UnknownSignal, Set<Watcher>>()
const watchedCallbackMap = new WeakMap<object, () => void>()
const unwatchedCallbackMap = new WeakMap<object, () => void>()

// Queue of pending watcher reactions for batched change notifications
const pendingReactions = new Set<() => void>()
let batchDepth = 0

/* === Constants === */

// biome-ignore lint/suspicious/noExplicitAny: Deliberately using any to be used as a placeholder value in any signal
const UNSET: any = Symbol()

/* === Functions === */

/**
 * Create a watcher to observe changes in signals.
 *
 * A watcher combines push and pull reaction functions with onCleanup and stop methods
 *
 * @since 0.17.3
 * @param {() => void} push - Function to be called when the state changes (push)
 * @param {() => void} pull - Function to be called on demand from consumers (pull)
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
const createWatcher = (push: () => void, pull: () => void): Watcher => {
	const cleanups = new Set<Cleanup>()
	const watcher = push as Partial<Watcher>
	watcher.run = () => {
		const prev = activeWatcher
		activeWatcher = watcher as Watcher
		try {
			pull()
		} finally {
			activeWatcher = prev
		}
	}
	watcher.onCleanup = (cleanup: Cleanup) => {
		cleanups.add(cleanup)
	}
	watcher.stop = () => {
		try {
			for (const cleanup of cleanups) cleanup()
		} finally {
			cleanups.clear()
		}
	}
	return watcher as Watcher
}

/**
 * Run a function with signal reads in a non-tracking context.
 *
 * @param {() => void} callback - Callback
 */
const untrack = (callback: () => void): void => {
	const prev = activeWatcher
	activeWatcher = undefined
	try {
		callback()
	} finally {
		activeWatcher = prev
	}
}

const registerWatchCallbacks = (
	signal: UnknownSignal,
	watched: () => void,
	unwatched?: () => void,
) => {
	watchedCallbackMap.set(signal, watched)
	if (unwatched) unwatchedCallbackMap.set(signal, unwatched)
}

/**
 * Subscribe active watcher to a signal.
 *
 * @param {UnknownSignal} signal - Signal to subscribe to
 * @returns {boolean} - true if the active watcher was subscribed,
 *                      false if the watcher was already subscribed or there was no active watcher
 */
const subscribeTo = (signal: UnknownSignal): boolean => {
	if (!activeWatcher || watchersMap.get(signal)?.has(activeWatcher))
		return false

	const watcher = activeWatcher
	if (!watchersMap.has(signal)) watchersMap.set(signal, new Set<Watcher>())

	const watchers = watchersMap.get(signal)
	assert(watchers)
	if (!watchers.size) {
		const watchedCallback = watchedCallbackMap.get(signal)
		if (watchedCallback) untrack(watchedCallback)
	}
	watchers.add(watcher)
	watcher.onCleanup(() => {
		watchers.delete(watcher)
		if (!watchers.size) {
			const unwatchedCallback = unwatchedCallbackMap.get(signal)
			if (unwatchedCallback) untrack(unwatchedCallback)
		}
	})
	return true
}

const subscribeActiveWatcher = (watchers: Set<Watcher>) => {
	if (!activeWatcher || watchers.has(activeWatcher)) return false

	const watcher = activeWatcher
	watchers.add(watcher)
	if (!watchers.size) {
		const watchedCallback = watchedCallbackMap.get(watchers)
		if (watchedCallback) untrack(watchedCallback)
	}
	watcher.onCleanup(() => {
		watchers.delete(watcher)
		if (!watchers.size) {
			const unwatchedCallback = unwatchedCallbackMap.get(watchers)
			if (unwatchedCallback) untrack(unwatchedCallback)
		}
	})
	return true
}

/**
 * Unsubscribe all watchers from a signal so it can be garbage collected.
 *
 * @param {UnknownSignal} signal - Signal to unsubscribe from
 * @returns {void}
 */
const unsubscribeAllFrom = (signal: UnknownSignal): void => {
	const watchers = watchersMap.get(signal)
	if (!watchers) return

	for (const watcher of watchers) watcher.stop()
	watchers.clear()
}

/**
 * Notify watchers of a signal change.
 *
 * @param {UnknownSignal} signal - Signal to notify watchers of
 * @returns {boolean} - Whether any watchers were notified
 */
const notifyOf = (signal: UnknownSignal): boolean => {
	const watchers = watchersMap.get(signal)
	if (!watchers?.size) return false

	for (const react of watchers) {
		if (batchDepth) pendingReactions.add(react)
		else react()
	}
	return true
}

const notifyWatchers = (watchers: Set<Watcher>): boolean => {
	if (!watchers.size) return false

	for (const react of watchers) {
		if (batchDepth) pendingReactions.add(react)
		else react()
	}
	return true
}

/**
 * Flush all pending reactions of enqueued watchers.
 */
const flush = () => {
	while (pendingReactions.size) {
		const watchers = Array.from(pendingReactions)
		pendingReactions.clear()
		for (const react of watchers) react()
	}
}

/**
 * Batch multiple signal writes.
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
const batch = (callback: () => void) => {
	batchDepth++
	try {
		callback()
	} finally {
		flush()
		batchDepth--
	}
}

/**
 * Run a function with signal reads in a tracking context (or temporarily untrack).
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
const track = (watcher: Watcher | false, run: () => void): void => {
	const prev = activeWatcher
	activeWatcher = watcher || undefined
	try {
		run()
	} finally {
		activeWatcher = prev
	}
}

/* === Exports === */

export {
	type Cleanup,
	type MaybeCleanup,
	type Watcher,
	type SignalOptions,
	UNSET,
	createWatcher,
	registerWatchCallbacks,
	subscribeTo,
	subscribeActiveWatcher,
	unsubscribeAllFrom,
	notifyOf,
	notifyWatchers,
	flush,
	batch,
	track,
	untrack,
}
