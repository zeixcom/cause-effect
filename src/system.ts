/* === Types === */

type Cleanup = () => void

type Watcher = {
	(): void
	off(cleanup: Cleanup): void
	cleanup(): void
}

/* === Internal === */

// Currently active watcher
let active: Watcher | undefined

// Pending queue for batched change notifications
const pending = new Set<Watcher>()
let batchDepth = 0

/* === Functions === */

/**
 * Create a watcher that can be used to observe changes to a signal
 *
 * @since 0.14.1
 * @param {() => void} notice - function to be called when the state changes
 * @returns {Watcher} - watcher object with off and cleanup methods
 */
const createWatcher = (notice: () => void): Watcher => {
	const cleanups = new Set<Cleanup>()
	const w = notice as Partial<Watcher>
	w.off = (on: Cleanup) => {
		cleanups.add(on)
	}
	w.cleanup = () => {
		for (const cleanup of cleanups) {
			cleanup()
		}
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
	if (active && !watchers.has(active)) {
		const watcher = active
		watchers.add(watcher)
		active.off(() => {
			watchers.delete(watcher)
		})
	}
}

/**
 * Add watchers to the pending set of change notifications
 *
 * @param {Set<Watcher>} watchers - watchers of the signal
 */
const notify = (watchers: Set<Watcher>) => {
	for (const watcher of watchers) {
		if (batchDepth) pending.add(watcher)
		else watcher()
	}
}

/**
 * Flush all pending changes to notify watchers
 */
const flush = () => {
	while (pending.size) {
		const watchers = Array.from(pending)
		pending.clear()
		for (const watcher of watchers) {
			watcher()
		}
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
	const prev = active
	active = watcher
	try {
		run()
	} finally {
		active = prev
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
