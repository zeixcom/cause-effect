/* === Types === */

import { InvalidHookError } from './errors'

type Cleanup = () => void

// biome-ignore lint/suspicious/noConfusingVoidType: optional Cleanup return type
type MaybeCleanup = Cleanup | undefined | void

type Watcher = {
	(): void
	on(type: Hook, cleanup: Cleanup): void
	stop(): void
}

type Hook = 'add' | 'change' | 'cleanup' | 'remove' | 'sort' | 'watch'
type CleanupHook = 'cleanup'
type WatchHook = 'watch'

type HookCallback = (payload?: readonly string[]) => MaybeCleanup

type HookCallbacks = {
	[K in Hook]?: Set<HookCallback>
}

/* === Internal === */

// Currently active watcher
let activeWatcher: Watcher | undefined

// Queue of pending watcher reactions for batched change notifications
const pendingReactions = new Set<() => void>()
let batchDepth = 0

/* === Constants === */

// biome-ignore lint/suspicious/noExplicitAny: Deliberately using any to be used as a placeholder value in any signal
const UNSET: any = Symbol()

const HOOK_ADD = 'add'
const HOOK_CHANGE = 'change'
const HOOK_CLEANUP = 'cleanup'
const HOOK_REMOVE = 'remove'
const HOOK_SORT = 'sort'
const HOOK_WATCH = 'watch'

/* === Functions === */

/**
 * Create a watcher to observe changes to a signal.
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
	watcher.on = (type: CleanupHook, cleanup: Cleanup) => {
		if (type === HOOK_CLEANUP) cleanups.add(cleanup)
		else throw new InvalidHookError('watcher', type)
	}
	watcher.stop = () => {
		for (const cleanup of cleanups) cleanup()
		cleanups.clear()
	}
	return watcher as Watcher
}

/**
 * Subscribe by adding active watcher to the Set of watchers of a signal.
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 * @returns {boolean} - Whether the watcher was the first to subscribe
 */
const subscribeActiveWatcher = (watchers: Set<Watcher>): boolean => {
	const isFirst = !watchers.size
	if (activeWatcher && !watchers.has(activeWatcher)) {
		const watcher = activeWatcher
		watcher.on(HOOK_CLEANUP, () => watchers.delete(watcher))
		watchers.add(watcher)
	}
	return isFirst
}

/**
 * Notify watchers of a signal change.
 *
 * @param {Set<Watcher>} watchers - Watchers of the signal
 * @returns {boolean} - Whether any watchers were notified
 */
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
const flushPendingReactions = () => {
	while (pendingReactions.size) {
		const watchers = Array.from(pendingReactions)
		pendingReactions.clear()
		for (const watcher of watchers) watcher()
	}
}

/**
 * Batch multiple signal writes.
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
 * Run a function with signal reads in a tracking context (or temporarily untrack).
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
 * Trigger a hook.
 *
 * @param {Set<HookCallback>} callbacks - Callbacks to be called when the hook is triggered
 * @param {readonly string[] | undefined} payload - Payload to be sent to listeners
 * @return {Cleanup | undefined} Cleanup function to be called when the hook is unmounted
 */
const triggerHook = (
	callbacks: Set<HookCallback> | undefined,
	payload?: readonly string[],
): Cleanup | undefined => {
	if (!callbacks) return

	const cleanups: Cleanup[] = []
	for (const callback of callbacks) {
		const cleanup = callback(payload)
		if (cleanup) cleanups.push(cleanup)
	}
	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}

/**
 * Check whether a hook type is handled in a signal.
 *
 * @param {Hook} type - Type of hook to check
 * @param {readonly (keyof Notification)[]} handled - List of handled hook types
 * @returns {type is keyof Notification}
 */
const isHandledHook = <T extends readonly Hook[]>(
	type: Hook,
	handled: T,
): type is T[number] => handled.includes(type)

/* === Exports === */

export {
	type Cleanup,
	type MaybeCleanup,
	type Watcher,
	type Hook,
	type CleanupHook,
	type WatchHook,
	type HookCallback,
	type HookCallbacks,
	HOOK_ADD,
	HOOK_CHANGE,
	HOOK_CLEANUP,
	HOOK_REMOVE,
	HOOK_SORT,
	HOOK_WATCH,
	UNSET,
	createWatcher,
	subscribeActiveWatcher,
	notifyWatchers,
	flushPendingReactions,
	batchSignalWrites,
	trackSignalReads,
	triggerHook,
	isHandledHook,
}
