/* === Types === */

type Cleanup = () => void

type Watcher = {
	(): void
	unwatch(cleanup: Cleanup): void
	cleanup(): void
}

/* === Internal === */

// Currently active watcher
let activeWatcher: Watcher | undefined

// Pending queue for batched change notifications
const pendingWatchers = new Set<Watcher>()
let batchDepth = 0

/* === Functions === */

/**
 * Create a watcher that can be used to observe changes to a signal
 *
 * @since 0.14.1
 * @param {() => void} watch - Function to be called when the state changes
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
const createWatcher = (watch: () => void): Watcher => {
	const cleanups = new Set<Cleanup>()
	const w = watch as Partial<Watcher>
	w.unwatch = (cleanup: Cleanup) => {
		cleanups.add(cleanup)
	}
	w.cleanup = () => {
		for (const cleanup of cleanups) cleanup()
		cleanups.clear()
	}
	return w as Watcher
}

/**
 * Add active watcher to the Set of watchers
 *
 * @param {Set<Watcher>} watchers - watchers of the signal
 */
const subscribe = (watchers: Set<Watcher>) => {
	if (activeWatcher && !watchers.has(activeWatcher)) {
		const watcher = activeWatcher
		watcher.unwatch(() => {
			watchers.delete(watcher)
		})
		watchers.add(watcher)
	}
}

/**
 * Add watchers to the pending set of change notifications
 *
 * @param {Set<Watcher>} watchers - watchers of the signal
 */
const notify = (watchers: Set<Watcher>) => {
	for (const watcher of watchers) {
		if (batchDepth) pendingWatchers.add(watcher)
		else watcher()
	}
}

/**
 * Flush all pending changes to notify watchers
 */
const flush = () => {
	while (pendingWatchers.size) {
		const watchers = Array.from(pendingWatchers)
		pendingWatchers.clear()
		for (const watcher of watchers) watcher()
	}
}

/**
 * Batch multiple changes in a single signal graph and DOM update cycle
 *
 * @param {() => void} fn - function with multiple signal writes to be batched
 */
const batch = (fn: () => void) => {
	batchDepth++
	try {
		fn()
	} finally {
		flush()
		batchDepth--
	}
}

/**
 * Run a function in a reactive context
 *
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} watcher - function to be called when the state changes or undefined for temporary unwatching while inserting auto-hydrating DOM nodes that might read signals (e.g., web components)
 */
const observe = (run: () => void, watcher?: Watcher): void => {
	const prev = activeWatcher
	activeWatcher = watcher
	try {
		run()
	} finally {
		activeWatcher = prev
	}
}

/* === Exports === */

export {
	type Cleanup,
	type Watcher,
	subscribe,
	notify,
	flush,
	batch,
	createWatcher,
	observe,
}
