import { DuplicateKeyError, validateSignalValue } from '../errors'
import {
	batch,
	batchDepth,
	type Cleanup,
	DEEP_EQUALITY,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RELINK,
	flush,
	makeSubscribe,
	type MemoNode,
	propagate,
	refresh,
	type SinkNode,
	TYPE_LIST,
	untrack,
} from '../graph'
import { isFunction, isSignalOfType, isRecord } from '../util'
import {
	type Collection,
	type CollectionSource,
	type DeriveCollectionCallback,
	deriveCollection,
} from './collection'
import { createState, type State } from './state'

/* === Types === */

type UnknownRecord = Record<string, unknown>

type DiffResult = {
	changed: boolean
	add: UnknownRecord
	change: UnknownRecord
	remove: UnknownRecord
}

/**
 * Key generation strategy for `createList` items.
 * A string value is used as a prefix for auto-incremented keys (`prefix0`, `prefix1`, …).
 * A function receives each item and returns a stable string key, or `undefined` to fall back to auto-increment.
 *
 * @template T - The type of items in the list
 */
type KeyConfig<T> = string | ((item: T) => string | undefined)

/**
 * Configuration options for `createList`.
 *
 * @template T - The type of items in the list
 */
type ListOptions<T extends {}> = {
	/** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
	keyConfig?: KeyConfig<T>
	/** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. */
	watched?: () => Cleanup
}

/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `State<T>` signal; structural changes (add/remove/sort) propagate reactively.
 *
 * @template T - The type of items in the list
 */
type List<T extends {}> = {
	readonly [Symbol.toStringTag]: 'List'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<State<T>>
	readonly length: number
	get(): T[]
	set(next: T[]): void
	update(fn: (prev: T[]) => T[]): void
	at(index: number): State<T> | undefined
	keys(): IterableIterator<string>
	byKey(key: string): State<T> | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	add(value: T): string
	remove(keyOrIndex: string | number): void
	/**
	 * Updates an existing item by key, propagating to all subscribers.
	 * No-op if the key does not exist or the value is reference-equal to the current value.
	 * @param key - Stable key of the item to update
	 * @param value - New value for the item
	 */
	replace(key: string, value: T): void
	sort(compareFn?: (a: T, b: T) => number): void
	splice(start: number, deleteCount?: number, ...items: T[]): T[]
	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
	): Collection<R>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): Collection<R>
}

/* === Functions === */

/** Shallow equality check for string arrays */
function keysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

function getKeyGenerator<T extends {}>(
	keyConfig?: KeyConfig<T>,
): [(item: T) => string, boolean] {
	let keyCounter = 0
	const contentBased = typeof keyConfig === 'function'
	return [
		typeof keyConfig === 'string'
			? () => `${keyConfig}${keyCounter++}`
			: contentBased
				? (item: T) => keyConfig(item) || String(keyCounter++)
				: () => String(keyCounter++),
		contentBased,
	]
}

/**
 * Compares two arrays using existing keys and returns differences as a DiffResult.
 * Avoids object conversion by working directly with arrays and keys.
 *
 * @since 0.18.0
 * @param prev - The old array
 * @param next - The new array
 * @param prevKeys - Current keys array (may be sparse or shorter than oldArray)
 * @param generateKey - Function to generate keys for new items
 * @param contentBased - When true, always use generateKey (content-based keys);
 *   when false, reuse positional keys from currentKeys (synthetic keys)
 * @returns The differences in DiffResult format plus updated keys array
 */
function diffArrays<T extends {}>(
	prev: T[],
	next: T[],
	prevKeys: string[],
	generateKey: (item: T) => string,
	contentBased: boolean,
): DiffResult & { newKeys: string[] } {
	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	const nextKeys: string[] = []
	let changed = false

	// Build a map of old values by key for quick lookup
	const prevByKey = new Map<string, T>()
	for (let i = 0; i < prev.length; i++) {
		const key = prevKeys[i]
		const item = prev[i]
		if (key && item !== undefined) prevByKey.set(key, item)
	}

	// Track which old keys we've seen
	const seenKeys = new Set<string>()

	// Process new array and build new keys array
	for (let i = 0; i < next.length; i++) {
		const val = next[i]
		if (val === undefined) continue

		// Content-based keys: always derive from item; synthetic keys: reuse by position
		const key = contentBased
			? generateKey(val)
			: (prevKeys[i] ?? generateKey(val))

		if (seenKeys.has(key)) throw new DuplicateKeyError(TYPE_LIST, key, val)

		nextKeys.push(key)
		seenKeys.add(key)

		// Check if this key existed before
		if (!prevByKey.has(key)) {
			add[key] = val
			changed = true
		} else if (!DEEP_EQUALITY(prevByKey.get(key)!, val)) {
			change[key] = val
			changed = true
		}
	}

	// Find removed keys (existed in old but not in new)
	for (const [key] of prevByKey) {
		if (!seenKeys.has(key)) {
			remove[key] = null
			changed = true
		}
	}

	// Detect reorder even when no values changed
	if (!changed && !keysEqual(prevKeys, nextKeys)) changed = true

	return { add, change, remove, newKeys: nextKeys, changed }
}

/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param value - Initial array of items
 * @param options.keyConfig - Key generation strategy: string prefix or `(item) => string | undefined`. Defaults to auto-increment.
 * @param options.watched - Lifecycle callback invoked on first subscriber; must return a cleanup function called on last unsubscribe.
 * @returns A `List` signal with reactive per-item `State` signals
 */
function createList<T extends {}>(
	value: T[],
	options?: ListOptions<T>,
): List<T> {
	validateSignalValue(TYPE_LIST, value, Array.isArray)

	const signals = new Map<string, State<T>>()
	let keys: string[] = []

	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)

	// --- Internal helpers ---

	// Build current value from child signals
	const buildValue = (): T[] =>
		keys
			.map(key => signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]

	// Structural tracking node — not a general-purpose Memo.
	// On first get(): refresh() establishes edges from child signals.
	// On subsequent get(): untrack(buildValue) rebuilds without re-linking.
	// Mutation methods set FLAG_RELINK to force re-establishment on next read.
	const node: MemoNode<T[]> = {
		fn: buildValue,
		value,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: DEEP_EQUALITY,
		error: undefined,
	}

	const applyChanges = (changes: DiffResult): boolean => {
		let structural = false

		// Additions
		for (const key in changes.add) {
			const val = changes.add[key] as T
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val)
			signals.set(key, createState(val))
			structural = true
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const val = changes.change[key]
					validateSignalValue(
						`${TYPE_LIST} item for key "${key}"`,
						val,
					)
					const signal = signals.get(key)
					if (signal) signal.set(val as T)
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
			const index = keys.indexOf(key)
			if (index !== -1) keys.splice(index, 1)
			structural = true
		}

		if (structural) node.flags |= FLAG_RELINK

		return changes.changed
	}

	const subscribe = makeSubscribe(node, options?.watched)

	// --- Initialize ---
	for (let i = 0; i < value.length; i++) {
		const val = value[i]
		if (val === undefined) continue
		let key = keys[i]
		if (!key) {
			key = generateKey(val)
			keys[i] = key
		}
		validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val)
		signals.set(key, createState(val))
	}

	// Starts clean: mutation methods (add/remove/set/splice) explicitly call
	// propagate() + invalidate edges, so refresh() on first get() is not needed.
	node.value = value
	node.flags = 0

	// --- List object ---
	const list: List<T> = {
		[Symbol.toStringTag]: TYPE_LIST,
		[Symbol.isConcatSpreadable]: true as const,

		*[Symbol.iterator]() {
			for (const key of keys) {
				const signal = signals.get(key)
				if (signal) yield signal
			}
		},

		get length() {
			subscribe()
			return keys.length
		},

		get() {
			subscribe()
			if (node.sources) {
				// Fast path: edges already established, rebuild value directly
				if (node.flags) {
					const relink = node.flags & FLAG_RELINK
					node.value = untrack(buildValue)
					if (relink) {
						// Structural mutation added/removed child signals —
						// tracked recompute so link() adds new edges and
						// trimSources() removes stale ones without orphaning.
						node.flags = FLAG_DIRTY
						refresh(node as unknown as SinkNode)
						if (node.error) throw node.error
					} else {
						node.flags = FLAG_CLEAN
					}
				}
			} else {
				// First access: use refresh() to establish child → list edges
				refresh(node as unknown as SinkNode)
				if (node.error) throw node.error
			}
			return node.value
		},

		set(next: T[]) {
			const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value
			const changes = diffArrays(
				prev,
				next,
				keys,
				generateKey,
				contentBased,
			)
			if (changes.changed) {
				keys = changes.newKeys
				applyChanges(changes)
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		update(fn: (prev: T[]) => T[]) {
			list.set(fn(list.get()))
		},

		at(index: number) {
			const key = keys[index]
			return key !== undefined ? signals.get(key) : undefined
		},

		keys() {
			subscribe()
			return keys.values()
		},

		byKey(key: string) {
			return signals.get(key)
		},

		keyAt(index: number) {
			return keys[index]
		},

		indexOfKey(key: string) {
			return keys.indexOf(key)
		},

		add(value: T) {
			const key = generateKey(value)
			if (signals.has(key))
				throw new DuplicateKeyError(TYPE_LIST, key, value)
			if (!keys.includes(key)) keys.push(key)
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value)
			signals.set(key, createState(value))
			node.flags |= FLAG_DIRTY | FLAG_RELINK
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			if (batchDepth === 0) flush()
			return key
		},

		remove(keyOrIndex: string | number) {
			const key =
				typeof keyOrIndex === 'number' ? keys[keyOrIndex] : keyOrIndex
			if (key === undefined) return
			const ok = signals.delete(key)
			if (ok) {
				const index =
					typeof keyOrIndex === 'number'
						? keyOrIndex
						: keys.indexOf(key)
				if (index >= 0) keys.splice(index, 1)
				node.flags |= FLAG_DIRTY | FLAG_RELINK
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		replace(key: string, value: T) {
			const signal = signals.get(key)
			if (!signal) return
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value)
			if (untrack(() => signal.get()) === value) return
			signal.set(value)
			node.flags |= FLAG_DIRTY
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			if (batchDepth === 0) flush()
		},

		sort(compareFn?: (a: T, b: T) => number) {
			const entries = keys
				.map(key => [key, signals.get(key)?.get()] as [string, T])
				.sort(
					isFunction(compareFn)
						? (a, b) => compareFn(a[1], b[1])
						: (a, b) => String(a[1]).localeCompare(String(b[1])),
				)
			const newOrder = entries.map(([key]) => key)

			if (!keysEqual(keys, newOrder)) {
				keys = newOrder
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		splice(start: number, deleteCount?: number, ...items: T[]) {
			const length = keys.length
			const actualStart =
				start < 0
					? Math.max(0, length + start)
					: Math.min(start, length)
			const actualDeleteCount = Math.max(
				0,
				Math.min(
					deleteCount ??
						Math.max(0, length - Math.max(0, actualStart)),
					length - actualStart,
				),
			)

			const add = {} as Record<string, T>
			const remove = {} as Record<string, T>

			// Collect items to delete
			for (let i = 0; i < actualDeleteCount; i++) {
				const index = actualStart + i
				const key = keys[index]
				if (key) {
					const signal = signals.get(key)
					if (signal) remove[key] = signal.get() as T
				}
			}

			// Build new key order
			const newOrder = keys.slice(0, actualStart)
			const change = {} as Record<string, T>

			for (const item of items) {
				const key = generateKey(item)
				if (key in remove) {
					// Same key removed and re-inserted: route to change, not add+remove
					delete remove[key]
					change[key] = item
				} else if (signals.has(key)) {
					throw new DuplicateKeyError(TYPE_LIST, key, item)
				} else {
					add[key] = item
				}
				newOrder.push(key)
			}

			newOrder.push(...keys.slice(actualStart + actualDeleteCount))

			const changed = !!(
				Object.keys(add).length ||
				Object.keys(remove).length ||
				Object.keys(change).length
			)

			if (changed) {
				applyChanges({
					add,
					change,
					remove,
					changed,
				})
				keys = newOrder
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}

			return Object.values(remove)
		},

		deriveCollection<R extends {}>(
			cb: DeriveCollectionCallback<R, T>,
		): Collection<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: DeriveCollectionCallback<T2, U2>,
				) => Collection<T2>
			)(list, cb)
		},
	}

	return list
}

/**
 * Checks if a value is a List signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
function isList<T extends {}>(value: unknown): value is List<T> {
	return isSignalOfType(value, TYPE_LIST)
}

/* === Exports === */

export {
	type DiffResult,
	type KeyConfig,
	type List,
	type ListOptions,
	type UnknownRecord,
	createList,
	isList,
	getKeyGenerator,
	keysEqual,
	TYPE_LIST,
}
