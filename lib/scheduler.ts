/* === Polyfills === */

if (!('requestAnimationFrame' in globalThis))
    globalThis.requestAnimationFrame = callback => setTimeout(callback, 16)

/* === Types === */

export type EnqueueDedupe = [Element, string]

export type Watcher = () => void
export type Runner = () => void
export type Updater = <T>() => T

/* === Internal === */

// Currently active watcher
let active: Watcher | undefined

const markQueue = new Set<Watcher>()
const runQueue = new Set<Runner>()
const updateMap = new Map<Element, Map<string, () => void>>()

let flushScheduled = false
let requestId: number | null

const updateDOM = () => {
	requestId = null
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
 * Flush all pending change notifications and runs in the signal graph
 */
export const flush = () => {
	flushScheduled = false
	while (markQueue.size || runQueue.size) {
		for (const mark of markQueue) {
			mark()
		}
		markQueue.clear()
		for (const run of runQueue) {
			run()
		}
		runQueue.clear()
	}
}

/**
 * Add notify function of active watcher to the set of watchers
 * 
 * @param {Watcher[]} watchers - set of current watchers
 */
export const subscribe = (watchers: Watcher[]) => {
	if (active && !watchers.includes(active))
		watchers.push(active)
}

/**
 * Add watchers to the pending set of change notifications
 * 
 * @param {Watcher[]} watchers - set of current watchers
 */
export const notify = (watchers: Watcher[]) => {
	for (const watcher of watchers) {
        markQueue.add(watcher)
    }
	if (!flushScheduled) {
        flushScheduled = true
        queueMicrotask(flush)
    }
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