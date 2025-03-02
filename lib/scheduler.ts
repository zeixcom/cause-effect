/* === Polyfills === */

if (!('requestAnimationFrame' in globalThis))
    globalThis.requestAnimationFrame = callback => setTimeout(callback, 16)

/* === Types === */

export type EnqueueDedupe = [Element, string]

export type Watcher = () => void
export type Updater = <T>() => T

/* === Internal === */

// Currently active watcher
let active: Watcher | undefined

// Pending queue for batched change notifications
const pending = new Set<Watcher>()
let batchDepth = 0

// Map of DOM elements to update functions
const updateMap = new Map<Element, Map<string, () => void>>()
let requestId: number | undefined

const updateDOM = () => {
	requestId = undefined
	for (const elementMap of updateMap.values()) {
		for (const fn of elementMap.values()) {
			fn()
		}
		elementMap.clear()
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
    fn()
	flush()
	batchDepth--
}

/**
 * Run a function in a reactive context
 * 
 * @param {() => void} run - function to run the computation or effect
 * @param {Watcher} mark - function to be called when the state changes
 */
export const watch = (run: () => void, mark: Watcher): void => {
	const prev = active
	active = mark
	run()
	active = prev
}

/**
 * Enqueue a function to be executed on the next animation frame
 * 
 * @param callback 
 * @param dedupe 
 * @returns 
 */
export const enqueue = <T>(
    update: Updater,
    dedupe?: EnqueueDedupe
) => new Promise<T>((resolve, reject) => {
    const wrappedCallback = () => {
        try {
            resolve(update())
        } catch (error) {
            reject(error)
        }
    }
    if (dedupe) {
        const [el, op] = dedupe
        if (!updateMap.has(el)) updateMap.set(el, new Map())
        const elementMap = updateMap.get(el)!
        elementMap.set(op, wrappedCallback)
    }
    requestTick()
})

export const animationFrame = /*#__PURE__*/ async () =>
    new Promise(requestAnimationFrame)
