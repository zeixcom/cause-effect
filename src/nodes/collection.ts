import { validateCallback, validateSignalValue } from '../errors'
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
	TYPE_COLLECTION,
	untrack,
} from '../graph'
import { isAsyncFunction, isFunction, isObjectOfType, isString } from '../util'
import { type DiffResult, isList, type KeyConfig, type List } from './list'
import { createMemo, type Memo } from './memo'
import { createState, isState } from './state'
import { createTask } from './task'

/* === Types === */

type CollectionSource<T extends {}> = List<T> | Collection<T>

type CollectionCallback<T extends {}, U extends {}> =
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

type SourceCollectionOptions<T extends {}> = {
	keyConfig?: KeyConfig<T>
	createItem?: (key: string, value: T) => Signal<T>
}

type SourceCollectionCallback = (
	applyChanges: (changes: DiffResult) => void,
) => Cleanup

/* === Functions === */

/** Shallow equality check for string arrays */
function keysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

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
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U) => T,
): Collection<T>
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
): Collection<T>
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: CollectionCallback<T, U>,
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
	// to establish a graph edge from source → this node
	function syncKeys(): string[] {
		const newKeys = Array.from(source.keys())
		const oldKeys = node.value

		if (!keysEqual(oldKeys, newKeys)) {
			const oldKeySet = new Set(oldKeys)
			const newKeySet = new Set(newKeys)

			for (const key of oldKeys)
				if (!newKeySet.has(key)) signals.delete(key)
			for (const key of newKeys) if (!oldKeySet.has(key)) addSignal(key)
		}

		return newKeys
	}

	// MemoNode for structural reactivity — fn reads source.keys()
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
			const keys = ensureSynced()
			return keys
				.map(key => {
					try {
						return signals.get(key)?.get()
					} catch {
						return undefined
					}
				})
				.filter(v => v != null) as T[]
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
			cb: CollectionCallback<R, T>,
		): Collection<R> {
			return (
				createCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: CollectionCallback<T2, U2>,
				) => Collection<T2>
			)(collection, cb)
		},
	}

	return collection
}

/**
 * Creates an externally-driven Collection with a watched lifecycle.
 * Items are managed by the start callback via `applyChanges(diffResult)`.
 * The collection activates when first accessed by an effect and deactivates when no longer watched.
 *
 * @since 0.18.0
 * @param initialValue - Initial array of items
 * @param start - Callback invoked when the collection starts being watched, receives applyChanges helper
 * @param options - Optional configuration for key generation and item signal creation
 * @returns A read-only Collection signal
 */
function createSourceCollection<T extends {}>(
	initialValue: T[],
	start: SourceCollectionCallback,
	options?: SourceCollectionOptions<T>,
): Collection<T> {
	validateSignalValue(TYPE_COLLECTION, initialValue, Array.isArray)
	validateCallback(TYPE_COLLECTION, start)

	const signals = new Map<string, Signal<T>>()
	const keys: string[] = []

	let keyCounter = 0
	const keyConfig = options?.keyConfig
	const generateKey: (item: T) => string = isString(keyConfig)
		? () => `${keyConfig}${keyCounter++}`
		: isFunction<string>(keyConfig)
			? (item: T) => keyConfig(item)
			: () => String(keyCounter++)

	const itemFactory =
		options?.createItem ?? ((_key: string, value: T) => createState(value))

	// Build current value from child signals
	function buildValue(): T[] {
		return keys
			.map(key => {
				try {
					return signals.get(key)?.get()
				} catch {
					return undefined
				}
			})
			.filter(v => v != null) as T[]
	}

	const node: MemoNode<T[]> = {
		fn: buildValue,
		value: initialValue,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: () => false, // Always rebuild — structural changes are managed externally
		error: undefined,
	}

	/** Apply external changes to the collection */
	function applyChanges(changes: DiffResult): void {
		if (!changes.changed) return
		let structural = false

		batch(() => {
			// Additions
			for (const key in changes.add) {
				const value = changes.add[key] as T
				signals.set(key, itemFactory(key, value))
				if (!keys.includes(key)) keys.push(key)
				structural = true
			}

			// Changes — only for State signals
			for (const key in changes.change) {
				const signal = signals.get(key)
				if (signal && isState(signal)) {
					signal.set(changes.change[key] as T)
				}
			}

			// Removals
			for (const key in changes.remove) {
				signals.delete(key)
				const index = keys.indexOf(key)
				if (index !== -1) keys.splice(index, 1)
				structural = true
			}

			if (structural) {
				node.sources = null
				node.sourcesTail = null
			}
			node.flags = FLAG_CLEAN
			propagate(node as unknown as SinkNode)
			node.flags |= FLAG_DIRTY
		})
	}

	// Initialize signals for initial value
	for (const item of initialValue) {
		const key = generateKey(item)
		signals.set(key, itemFactory(key, item))
		keys.push(key)
	}
	node.value = initialValue
	node.flags = FLAG_DIRTY // First refresh() will establish child edges

	function startWatching(): void {
		if (!node.sinks) node.stop = start(applyChanges)
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
			if (activeSink) {
				startWatching()
				link(node, activeSink)
			}
			return keys.length
		},

		keys() {
			if (activeSink) {
				startWatching()
				link(node, activeSink)
			}
			return keys.values()
		},

		get() {
			if (activeSink) {
				startWatching()
				link(node, activeSink)
			}
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
			cb: CollectionCallback<R, T>,
		): Collection<R> {
			return (
				createCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: CollectionCallback<T2, U2>,
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
	createSourceCollection,
	isCollection,
	isCollectionSource,
	type Collection,
	type CollectionCallback,
	type CollectionSource,
	type SourceCollectionCallback,
	type SourceCollectionOptions,
}
