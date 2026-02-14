import {
	UnsetSignalValueError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batch,
	type Cleanup,
	FLAG_CLEAN,
	FLAG_DIRTY,
	link,
	type MemoNode,
	propagate,
	refresh,
	type Signal,
	type SinkNode,
	SKIP_EQUALITY,
	TYPE_COLLECTION,
	untrack,
} from '../graph'
import { isAsyncFunction, isObjectOfType, isSyncFunction } from '../util'
import {
	getKeyGenerator,
	isList,
	type KeyConfig,
	keysEqual,
	type List,
} from './list'
import { createMemo, type Memo } from './memo'
import { createState, isState } from './state'
import { createTask } from './task'

/* === Types === */

type CollectionSource<T extends {}> = List<T> | Collection<T>

type DeriveCollectionCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abort: AbortSignal) => Promise<T>)

type Collection<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Collection'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<Signal<T>>
	keys(): IterableIterator<string>
	get(): T[]
	at(index: number): Signal<T> | undefined
	byKey(key: string): Signal<T> | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
	): Collection<R>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): Collection<R>
	readonly length: number
}

type CollectionChanges<T> = {
	add?: T[]
	change?: T[]
	remove?: T[]
}

type CollectionOptions<T extends {}> = {
	value?: T[]
	keyConfig?: KeyConfig<T>
	createItem?: (value: T) => Signal<T>
}

type CollectionCallback<T extends {}> = (
	apply: (changes: CollectionChanges<T>) => void,
) => Cleanup

/* === Functions === */

/**
 * Creates a derived Collection from a List or another Collection with item-level memoization.
 * Sync callbacks use createMemo, async callbacks use createTask.
 * Structural changes are tracked reactively via the source's keys.
 *
 * @since 0.18.0
 * @param source - The source List or Collection to derive from
 * @param callback - Transformation function applied to each item
 * @returns A Collection signal
 */
function deriveCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U) => T,
): Collection<T>
function deriveCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
): Collection<T>
function deriveCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: DeriveCollectionCallback<T, U>,
): Collection<T> {
	validateCallback(TYPE_COLLECTION, callback)
	if (!isCollectionSource(source))
		throw new TypeError(
			`[${TYPE_COLLECTION}] Invalid collection source: expected a List or Collection`,
		)

	const isAsync = isAsyncFunction(callback)
	const signals = new Map<string, Memo<T>>()

	const addSignal = (key: string): void => {
		const signal = isAsync
			? createTask(async (prev: T | undefined, abort: AbortSignal) => {
					const sourceValue = source.byKey(key)?.get() as U
					if (sourceValue == null) return prev as T
					return (
						callback as (
							sourceValue: U,
							abort: AbortSignal,
						) => Promise<T>
					)(sourceValue, abort)
				})
			: createMemo(() => {
					const sourceValue = source.byKey(key)?.get() as U
					if (sourceValue == null) return undefined as unknown as T
					return (callback as (sourceValue: U) => T)(sourceValue)
				})

		signals.set(key, signal as Memo<T>)
	}

	// Sync collection signals with source keys, reading source.keys()
	// to establish a graph edge from source → this node.
	// Intentionally side-effectful: mutates the private signals map inside what
	// is conceptually a MemoNode.fn. The side effects are idempotent and scoped
	// to private state — separating detection from application would add complexity.
	function syncKeys(): string[] {
		const nextKeys = Array.from(source.keys())
		const prevKeys = node.value

		if (!keysEqual(prevKeys, nextKeys)) {
			const a = new Set(prevKeys)
			const b = new Set(nextKeys)

			for (const key of prevKeys) if (!b.has(key)) signals.delete(key)
			for (const key of nextKeys) if (!a.has(key)) addSignal(key)
		}

		return nextKeys
	}

	// Structural tracking node — not a general-purpose Memo.
	// fn (syncKeys) reads source.keys() to detect additions/removals.
	// Value is a string[] of keys, not the collection's actual values.
	const node: MemoNode<string[]> = {
		fn: syncKeys,
		value: [],
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: keysEqual,
		error: undefined,
	}

	// Ensure keys are synced, using the same pattern as List/Store
	function ensureSynced(): string[] {
		if (node.sources) {
			if (node.flags) {
				node.value = untrack(syncKeys)
				node.flags = FLAG_CLEAN
			}
		} else {
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
		}
		return node.value
	}

	// Initialize signals for current source keys
	const initialKeys = Array.from(source.keys())
	for (const key of initialKeys) addSignal(key)
	node.value = initialKeys
	// Keep FLAG_DIRTY so the first refresh() establishes the edge to the source

	const collection: Collection<T> = {
		[Symbol.toStringTag]: TYPE_COLLECTION,
		[Symbol.isConcatSpreadable]: true as const,

		*[Symbol.iterator]() {
			for (const key of node.value) {
				const signal = signals.get(key)
				if (signal) yield signal
			}
		},

		get length() {
			if (activeSink) link(node, activeSink)
			return ensureSynced().length
		},

		keys() {
			if (activeSink) link(node, activeSink)
			return ensureSynced().values()
		},

		get() {
			if (activeSink) link(node, activeSink)
			const currentKeys = ensureSynced()
			const result: T[] = []
			for (const key of currentKeys) {
				try {
					const v = signals.get(key)?.get()
					if (v != null) result.push(v)
				} catch (e) {
					// Skip pending async items; rethrow real errors
					if (!(e instanceof UnsetSignalValueError)) throw e
				}
			}
			return result
		},

		at(index: number) {
			return signals.get(node.value[index])
		},

		byKey(key: string) {
			return signals.get(key)
		},

		keyAt(index: number) {
			return node.value[index]
		},

		indexOfKey(key: string) {
			return node.value.indexOf(key)
		},

		deriveCollection<R extends {}>(
			cb: DeriveCollectionCallback<R, T>,
		): Collection<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: DeriveCollectionCallback<T2, U2>,
				) => Collection<T2>
			)(collection, cb)
		},
	}

	return collection
}

/**
 * Creates an externally-driven Collection with a watched lifecycle.
 * Items are managed via the `applyChanges(changes)` helper passed to the watched callback.
 * The collection activates when first accessed by an effect and deactivates when no longer watched.
 *
 * @since 0.18.0
 * @param watched - Callback invoked when the collection starts being watched, receives applyChanges helper
 * @param options - Optional configuration including initial value, key generation, and item signal creation
 * @returns A read-only Collection signal
 */
function createCollection<T extends {}>(
	watched: CollectionCallback<T>,
	options?: CollectionOptions<T>,
): Collection<T> {
	const value = options?.value ?? []
	if (value.length) validateSignalValue(TYPE_COLLECTION, value, Array.isArray)
	validateCallback(TYPE_COLLECTION, watched, isSyncFunction)

	const signals = new Map<string, Signal<T>>()
	const keys: string[] = []
	const itemToKey = new Map<T, string>()

	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)

	const resolveKey = (item: T): string | undefined =>
		itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined)

	const itemFactory = options?.createItem ?? createState

	// Build current value from child signals
	function buildValue(): T[] {
		const result: T[] = []
		for (const key of keys) {
			try {
				const v = signals.get(key)?.get()
				if (v != null) result.push(v)
			} catch (e) {
				// Skip pending async items; rethrow real errors
				if (!(e instanceof UnsetSignalValueError)) throw e
			}
		}
		return result
	}

	const node: MemoNode<T[]> = {
		fn: buildValue,
		value,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: SKIP_EQUALITY, // Always rebuild — structural changes are managed externally
		error: undefined,
	}

	// Initialize signals for initial value
	for (const item of value) {
		const key = generateKey(item)
		signals.set(key, itemFactory(item))
		itemToKey.set(item, key)
		keys.push(key)
	}
	node.value = value
	node.flags = FLAG_DIRTY // First refresh() will establish child edges

	function subscribe(): void {
		if (activeSink) {
			if (!node.sinks)
				node.stop = watched((changes: CollectionChanges<T>): void => {
					const { add, change, remove } = changes
					if (!add?.length && !change?.length && !remove?.length)
						return
					let structural = false

					batch(() => {
						// Additions
						if (add) {
							for (const item of add) {
								const key = generateKey(item)
								signals.set(key, itemFactory(item))
								itemToKey.set(item, key)
								if (!keys.includes(key)) keys.push(key)
								structural = true
							}
						}

						// Changes — only for State signals
						if (change) {
							for (const item of change) {
								const key = resolveKey(item)
								if (!key) continue
								const signal = signals.get(key)
								if (signal && isState(signal)) {
									// Update reverse map: remove old reference, add new
									itemToKey.delete(signal.get())
									signal.set(item)
									itemToKey.set(item, key)
								}
							}
						}

						// Removals
						if (remove) {
							for (const item of remove) {
								const key = resolveKey(item)
								if (!key) continue
								itemToKey.delete(item)
								signals.delete(key)
								const index = keys.indexOf(key)
								if (index !== -1) keys.splice(index, 1)
								structural = true
							}
						}

						if (structural) {
							node.sources = null
							node.sourcesTail = null
						}
						// Mark DIRTY so next get() rebuilds; propagate to sinks
						node.flags = FLAG_DIRTY
						for (let e = node.sinks; e; e = e.nextSink)
							propagate(e.sink)
					})
				})
			link(node, activeSink)
		}
	}

	const collection: Collection<T> = {
		[Symbol.toStringTag]: TYPE_COLLECTION,
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

		keys() {
			subscribe()
			return keys.values()
		},

		get() {
			subscribe()
			if (node.sources) {
				if (node.flags) {
					node.value = untrack(buildValue)
					node.flags = FLAG_CLEAN
				}
			} else {
				refresh(node as unknown as SinkNode)
				if (node.error) throw node.error
			}
			return node.value
		},

		at(index: number) {
			return signals.get(keys[index])
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

		deriveCollection<R extends {}>(
			cb: DeriveCollectionCallback<R, T>,
		): Collection<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: DeriveCollectionCallback<T2, U2>,
				) => Collection<T2>
			)(collection, cb)
		},
	}

	return collection
}

/**
 * Checks if a value is a Collection signal.
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a Collection
 */
function isCollection<T extends {}>(value: unknown): value is Collection<T> {
	return isObjectOfType(value, TYPE_COLLECTION)
}

/**
 * Checks if a value is a valid Collection source (List or Collection).
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a List or Collection
 */
function isCollectionSource<T extends {}>(
	value: unknown,
): value is CollectionSource<T> {
	return isList(value) || isCollection(value)
}

/* === Exports === */

export {
	createCollection,
	deriveCollection,
	isCollection,
	isCollectionSource,
	type Collection,
	type CollectionCallback,
	type CollectionChanges,
	type CollectionOptions,
	type CollectionSource,
	type DeriveCollectionCallback,
}
