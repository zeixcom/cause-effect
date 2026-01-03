/* === Types === */

type Cleanup = () => void

type Watcher = {
	(): void
	onCleanup(cleanup: Cleanup): void
	stop(): void
}

type Notifications = {
	add: readonly string[]
	change: readonly string[]
	remove: readonly string[]
	sort: readonly string[]
}

type Listener<K extends keyof Notifications> = (
	payload: Notifications[K],
) => void

type Listeners = {
	[K in keyof Notifications]: Set<Listener<K>>
}

/* === Internal === */

// Currently active watcher
let activeWatcher: Watcher | undefined

// Queue of pending watcher reactions for batched change notifications
const pendingReactions = new Set<() => void>()
let batchDepth = 0

/* === Functions === */

/**
 * Create a watcher that can be used to observe changes to a signal
 *
 * A watcher is a reaction function with onCleanup and stop methods
 *
 * @since 0.14.1
 * @param {() => void} react - Function to be called when the state changes
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
const createWatcher = (react: () => void): Watcher => {
	const cleanups = new Set<Cleanup>()
	const watcher = react as Partial<Watcher>
	watcher.onCleanup = (cleanup: Cleanup) => {
		cleanups.add(cleanup)
	}
	watcher.stop = () => {
		for (const cleanup of cleanups) cleanup()
		cleanups.clear()
	}
	return watcher as Watcher
}

/**
 * Subscribe by adding active watcher to the Set of watchers of a signal
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 */
const subscribeActiveWatcher = (watchers: Set<Watcher>) => {
	if (activeWatcher && !watchers.has(activeWatcher)) {
		const watcher = activeWatcher
		watcher.onCleanup(() => watchers.delete(watcher))
		watchers.add(watcher)
	}
}

/**
 * Notify watchers of a signal change
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 */
const notifyWatchers = (watchers: Set<Watcher>) => {
	for (const react of watchers) {
		if (batchDepth) pendingReactions.add(react)
		else react()
	}
}

/**
 * Flush all pending reactions of enqueued watchers
 */
const flushPendingReactions = () => {
	while (pendingReactions.size) {
		const watchers = Array.from(pendingReactions)
		pendingReactions.clear()
		for (const watcher of watchers) watcher()
	}
}

/**
 * Batch multiple signal writes
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
const batchSignalWrites = (callback: () => void) => {
	batchDepth++
	try {
		callback()
	} finally {
		flushPendingReactions()
		batchDepth--
	}
}

/**
 * Run a function with signal reads in a tracking context (or temporarily untrack)
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
const trackSignalReads = (watcher: Watcher | false, run: () => void): void => {
	const prev = activeWatcher
	activeWatcher = watcher || undefined
	try {
		run()
	} finally {
		activeWatcher = prev
	}
}

/**
 * Emit a notification to listeners
 *
 * @param {Set<Listener>} listeners - Listeners to be notified
 * @param {Notifications[K]} payload - Payload to be sent to listeners
 */
const emitNotification = <T extends keyof Notifications>(
	listeners: Set<Listener<T>>,
	payload: Notifications[T],
) => {
	for (const listener of listeners) {
		if (batchDepth) pendingReactions.add(() => listener(payload))
		else listener(payload)
	}
}

/* === Exports === */

export {
	type Cleanup,
	type Watcher,
	type Notifications,
	type Listener,
	type Listeners,
	createWatcher,
	subscribeActiveWatcher,
	notifyWatchers,
	flushPendingReactions,
	batchSignalWrites,
	trackSignalReads,
	emitNotification,
}
