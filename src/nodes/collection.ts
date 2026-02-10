import { validateCallback } from '../errors'
import {
	activeSink,
	FLAG_CLEAN,
	FLAG_DIRTY,
	link,
	type MemoNode,
	refresh,
	type Signal,
	type SinkNode,
	TYPE_COLLECTION,
	untrack,
} from '../graph'
import { isAsyncFunction, isObjectOfType } from '../util'
import { isList, type List } from './list'
import { createMemo, type Memo } from './memo'
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
	isCollection,
	isCollectionSource,
	type Collection,
	type CollectionCallback,
	type CollectionSource,
}
