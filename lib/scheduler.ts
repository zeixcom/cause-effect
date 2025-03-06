/* === Types === */

export type EnqueueDedupe = [Element, string]

export type Watcher = () => void
export type Updater = <T>() => T | boolean | void

/* === Internal === */

// Currently active watcher
let active: Watcher | undefined

// Pending queue for batched change notifications
const pending = new Set<Watcher>()
let batchDepth = 0

// Map of DOM elements to update functions
const updateMap = new Map<EnqueueDedupe, () => void>()
let requestId: number | undefined

const updateDOM = () => {
	requestId = undefined
	const updates = Array.from(updateMap.values())
	updateMap.clear()
	for (const fn of updates) {
		fn()
	}
}

const requestTick = () => {
    if (requestId) cancelAnimationFrame(requestId)
    requestId = requestAnimationFrame(updateDOM)
}

// Initial render when the call stack is empty
queueMicrotask(updateDOM)

/* === Exported Functions === */

/**
 * Add active watcher to the array of watchers
 * 
 * @param {Watcher[]} watchers - watchers of the signal
 */
export const subscribe = (watchers: Watcher[]) => {
	// if (!active) console.warn('Calling .get() outside of a reactive context')
	if (active && !watchers.includes(active)) {
		watchers.push(active)
	}
}

/**
 * Add watchers to the pending set of change notifications
 * 
 * @param {Watcher[]} watchers - watchers of the signal
 */
export const notify = (watchers: Watcher[]) => {
	for (const mark of watchers) {
        batchDepth ? pending.add(mark) : mark()
    }
}

/**
 * Flush all pending changes to notify watchers
 */
export const flush = () => {
    while (pending.size) {
        const watchers = Array.from(pending)
        pending.clear()
        for (const mark of watchers) {
            mark()
        }
    }
}

/**
 * Batch multiple changes in a single signal graph and DOM update cycle
 * 
 * @param {() => void} fn - function with multiple signal writes to be batched
 */
export const batch = (fn: () => void) => {
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
 * @param {Watcher} mark - function to be called when the state changes or undefined for temporary unwatching while inserting auto-hydrating DOM nodes that might read signals (e.g., web components)
 */
export const watch = (run: () => void, mark?: Watcher): void => {
	const prev = active
	active = mark
	try {
		run()
	} finally {
		active = prev
	}
}

/**
 * Enqueue a function to be executed on the next animation frame
 * 
 * @param {Updater} fn - function to be executed on the next animation frame; can return updated value <T>, success <boolean> or void
 * @param {EnqueueDedupe} dedupe - [element, operation] pair for deduplication
 */
export const enqueue = <T>(
    fn: Updater,
    dedupe?: EnqueueDedupe
) => new Promise<T | boolean | void>((resolve, reject) => {
    const wrappedCallback = () => {
        try {
            resolve(fn())
        } catch (error) {
            reject(error)
        }
    }
    if (dedupe) {
        updateMap.set(dedupe, wrappedCallback)
    }
    requestTick()
})
