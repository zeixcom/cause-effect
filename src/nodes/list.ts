import {
	CircularDependencyError,
	DuplicateKeyError,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batch,
	batchDepth,
	type Cleanup,
	FLAG_CLEAN,
	FLAG_DIRTY,
	flush,
	link,
	type MemoNode,
	propagate,
	refresh,
	type SinkNode,
	TYPE_LIST,
	untrack,
} from '../graph'
import {
	isFunction,
	isNonNullObject,
	isNumber,
	isObjectOfType,
	isRecord,
	isString,
} from '../util'
import {
	type Collection,
	type CollectionCallback,
	type CollectionSource,
	createCollection,
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

type KeyConfig<T> = string | ((item: T) => string)

type ListOptions<T extends {}> = {
	keyConfig?: KeyConfig<T>
	watched?: () => Cleanup
}

type List<T extends {}> = {
	readonly [Symbol.toStringTag]: 'List'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<State<T>>
	readonly length: number
	get(): T[]
	set(newValue: T[]): void
	update(fn: (oldValue: T[]) => T[]): void
	at(index: number): State<T> | undefined
	keys(): IterableIterator<string>
	byKey(key: string): State<T> | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	add(value: T): string
	remove(keyOrIndex: string | number): void
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

/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
function isEqual<T>(a: T, b: T, visited?: WeakSet<object>): boolean {
	// Fast paths
	if (Object.is(a, b)) return true
	if (typeof a !== typeof b) return false
	if (!isNonNullObject(a) || !isNonNullObject(b)) return false

	// Cycle detection (only allocate WeakSet when both values are objects)
	if (!visited) visited = new WeakSet()
	if (visited.has(a as object) || visited.has(b as object))
		throw new CircularDependencyError('isEqual')
	visited.add(a)
	visited.add(b)

	try {
		const aIsArray = Array.isArray(a)
		if (aIsArray !== Array.isArray(b)) return false

		if (aIsArray) {
			const aa = a as unknown[]
			const ba = b as unknown[]
			if (aa.length !== ba.length) return false
			for (let i = 0; i < aa.length; i++) {
				if (!isEqual(aa[i], ba[i], visited)) return false
			}
			return true
		}

		if (isRecord(a) && isRecord(b)) {
			const aKeys = Object.keys(a)
			const bKeys = Object.keys(b)

			if (aKeys.length !== bKeys.length) return false
			for (const key of aKeys) {
				if (!(key in b)) return false
				if (!isEqual(a[key], b[key], visited)) return false
			}
			return true
		}

		// For non-records/non-arrays, they are only equal if they are the same reference
		// (which would have been caught by Object.is at the beginning)
		return false
	} finally {
		visited.delete(a)
		visited.delete(b)
	}
}

/**
 * Compares two arrays using existing keys and returns differences as a DiffResult.
 * Avoids object conversion by working directly with arrays and keys.
 *
 * @since 0.18.0
 * @param {T[]} oldArray - The old array
 * @param {T[]} newArray - The new array
 * @param {string[]} currentKeys - Current keys array (may be sparse or shorter than oldArray)
 * @param {(item: T) => string} generateKey - Function to generate keys for new items
 * @returns {DiffResult & { newKeys: string[] }} The differences in DiffResult format plus updated keys array
 */
function diffArrays<T>(
	oldArray: T[],
	newArray: T[],
	currentKeys: string[],
	generateKey: (item: T) => string,
): DiffResult & { newKeys: string[] } {
	const visited = new WeakSet()
	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	const newKeys: string[] = []
	let changed = false

	// Build a map of old values by key for quick lookup
	const oldByKey = new Map<string, T>()
	for (let i = 0; i < oldArray.length; i++) {
		const key = currentKeys[i]
		if (key && oldArray[i]) oldByKey.set(key, oldArray[i])
	}

	// Track which old keys we've seen
	const seenKeys = new Set<string>()

	// Process new array and build new keys array
	for (let i = 0; i < newArray.length; i++) {
		const newValue = newArray[i]
		if (newValue === undefined) continue

		// Get or generate key for this position
		let key = currentKeys[i]
		if (!key) key = generateKey(newValue)

		newKeys.push(key)
		seenKeys.add(key)

		// Check if this key existed before
		if (!oldByKey.has(key)) {
			add[key] = newValue
			changed = true
		} else {
			const oldValue = oldByKey.get(key)
			if (!isEqual(oldValue, newValue, visited)) {
				change[key] = newValue
				changed = true
			}
		}
	}

	// Find removed keys (existed in old but not in new)
	for (const [key] of oldByKey) {
		if (!seenKeys.has(key)) {
			remove[key] = null
			changed = true
		}
	}

	return { add, change, remove, newKeys, changed }
}

/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param initialValue - Initial array of items
 * @param options - Optional configuration for key generation and watch lifecycle
 * @returns A List signal
 */
function createList<T extends {}>(
	initialValue: T[],
	options?: ListOptions<T>,
): List<T> {
	validateSignalValue(TYPE_LIST, initialValue, Array.isArray)

	const signals = new Map<string, State<T>>()
	let keys: string[] = []

	let keyCounter = 0
	const keyConfig = options?.keyConfig
	const generateKey: (item: T) => string = isString(keyConfig)
		? () => `${keyConfig}${keyCounter++}`
		: isFunction<string>(keyConfig)
			? (item: T) => keyConfig(item)
			: () => String(keyCounter++)

	// --- Internal helpers ---

	// Build current value from child signals
	const buildValue = (): T[] =>
		keys
			.map(key => signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]

	const node: MemoNode<T[]> = {
		fn: buildValue,
		value: initialValue,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: isEqual,
		error: undefined,
	}

	// Force edge re-establishment on next get() after structural changes
	const invalidateEdges = () => {
		node.sources = null
		node.sourcesTail = null
	}

	const addSignal = (key: string, value: T): void => {
		validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value)
		signals.set(key, createState(value))
	}

	const toRecord = (array: T[]): Record<string, T> => {
		const record = {} as Record<string, T>
		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue
			let key = keys[i]
			if (!key) {
				key = generateKey(value)
				keys[i] = key
			}
			record[key] = value
		}
		return record
	}

	const applyChanges = (changes: DiffResult): boolean => {
		let structural = false

		// Additions
		for (const key in changes.add) {
			addSignal(key, changes.add[key] as T)
			structural = true
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					validateSignalValue(
						`${TYPE_LIST} item for key "${key}"`,
						value,
					)
					const signal = signals.get(key)
					if (signal) signal.set(value as T)
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

		if (structural) invalidateEdges()

		return changes.changed
	}

	// --- Initialize ---
	const initRecord = toRecord(initialValue)
	for (const key in initRecord) {
		addSignal(key, initRecord[key])
	}

	// Clear dirty flag after initialization - initial value is correct
	node.value = initialValue
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
			if (activeSink) {
				if (!node.sinks && options?.watched)
					node.stop = options.watched()
				link(node, activeSink)
			}
			return keys.length
		},

		get() {
			if (activeSink) {
				if (!node.sinks && options?.watched)
					node.stop = options.watched()
				link(node, activeSink)
			}
			if (node.sources) {
				// Fast path: edges already established, rebuild value directly
				if (node.flags) {
					node.value = untrack(buildValue)
					node.flags = FLAG_CLEAN
				}
			} else {
				// First access: use refresh() to establish child → list edges
				refresh(node as unknown as SinkNode)
				if (node.error) throw node.error
			}
			return node.value
		},

		set(newValue: T[]) {
			const currentValue =
				node.flags & FLAG_DIRTY ? buildValue() : node.value
			const changes = diffArrays(
				currentValue,
				newValue,
				keys,
				generateKey,
			)
			if (changes.changed) {
				keys = changes.newKeys
				applyChanges(changes)
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
				if (batchDepth === 0) flush()
			}
		},

		update(fn: (oldValue: T[]) => T[]) {
			list.set(fn(list.get()))
		},

		at(index: number) {
			return signals.get(keys[index])
		},

		keys() {
			if (activeSink) {
				if (!node.sinks && options?.watched)
					node.stop = options.watched()
				link(node, activeSink)
			}
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
			addSignal(key, value)
			invalidateEdges()
			propagate(node as unknown as SinkNode)
			node.flags |= FLAG_DIRTY
			if (batchDepth === 0) flush()
			return key
		},

		remove(keyOrIndex: string | number) {
			const key = isNumber(keyOrIndex) ? keys[keyOrIndex] : keyOrIndex
			const ok = signals.delete(key)
			if (ok) {
				const index = isNumber(keyOrIndex)
					? keyOrIndex
					: keys.indexOf(key)
				if (index >= 0) keys.splice(index, 1)
				invalidateEdges()
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
				if (batchDepth === 0) flush()
			}
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

			if (!isEqual(keys, newOrder)) {
				keys = newOrder
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
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

			for (const item of items) {
				const key = generateKey(item)
				newOrder.push(key)
				add[key] = item
			}

			newOrder.push(...keys.slice(actualStart + actualDeleteCount))

			const changed = !!(
				Object.keys(add).length || Object.keys(remove).length
			)

			if (changed) {
				applyChanges({
					add,
					change: {},
					remove,
					changed,
				})
				keys = newOrder
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
				if (batchDepth === 0) flush()
			}

			return Object.values(remove)
		},

		deriveCollection<R extends {}>(
			cb: CollectionCallback<R, T>,
		): Collection<R> {
			return (
				createCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: CollectionCallback<T2, U2>,
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
	return isObjectOfType(value, TYPE_LIST)
}

/* === Exports === */

export {
	type DiffResult,
	type KeyConfig,
	type List,
	type ListOptions,
	type UnknownRecord,
	createList,
	isEqual,
	isList,
	TYPE_LIST,
}
