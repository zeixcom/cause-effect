import {
	activeSink,
	batchDepth,
	flush,
	link,
	propagate,
	type RefNode,
	type Signal,
	validateCallback,
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

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Functions === */

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
	let keys: string[] = []

	// Collection-level RefNode for structural reactivity
	const node: RefNode<T[]> = {
		value: [] as unknown as T[],
		sinks: null,
		sinksTail: null,
		stop: undefined,
	}

	const notifyCollection = () => {
		for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
		if (batchDepth === 0) flush()
	}

	const linkCollection = () => {
		if (activeSink) link(node, activeSink)
	}

	const addSignal = (key: string): void => {
		const signal = isAsync
			? createTask(async (_prev: T, abort: AbortSignal) => {
					const sourceValue = source.byKey(key)?.get() as U
					if (sourceValue == null) return _prev
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

	// Use a memo to track source keys reactively
	// When accessed, it reads source.keys() creating a dependency on the source's RefNode.
	// When source structure changes, this memo recomputes and returns new keys.
	const sourceKeysMemo = createMemo(() => {
		return Array.from(source.keys())
	})

	// Sync collection signals with source keys — called lazily on access
	const sync = () => {
		const newKeys = sourceKeysMemo.get()
		const oldKeySet = new Set(keys)
		const newKeySet = new Set(newKeys)

		let changed = false

		// Remove signals for deleted keys
		for (const key of keys) {
			if (!newKeySet.has(key)) {
				signals.delete(key)
				changed = true
			}
		}

		// Add signals for new keys
		for (const key of newKeys) {
			if (!oldKeySet.has(key)) {
				addSignal(key)
				changed = true
			}
		}

		// Detect reordering
		if (!changed && keys.length === newKeys.length) {
			for (let i = 0; i < keys.length; i++) {
				if (keys[i] !== newKeys[i]) {
					changed = true
					break
				}
			}
		}

		keys = newKeys

		if (changed) notifyCollection()
	}

	// Initialize signals for current source keys
	for (const key of Array.from(source.keys())) {
		addSignal(key)
		keys.push(key)
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
			linkCollection()
			sync()
			return keys.length
		},

		keys() {
			linkCollection()
			sync()
			return keys.values()
		},

		get() {
			linkCollection()
			sync()
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

const isCollection = <T extends {}>(value: unknown): value is Collection<T> =>
	isObjectOfType(value, TYPE_COLLECTION)

const isCollectionSource = <T extends {}>(
	value: unknown,
): value is CollectionSource<T> => isList(value) || isCollection(value)

/* === Exports === */

export {
	createCollection,
	isCollection,
	isCollectionSource,
	TYPE_COLLECTION,
	type Collection,
	type CollectionCallback,
	type CollectionSource,
}
