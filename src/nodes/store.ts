import { DuplicateKeyError, validateSignalValue } from '../errors'
import {
	activeSink,
	batch,
	batchDepth,
	type Cleanup,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RELINK,
	flush,
	link,
	type MemoNode,
	propagate,
	refresh,
	type SinkNode,
	TYPE_STORE,
	untrack,
} from '../graph'
import { isObjectOfType, isRecord } from '../util'
import {
	createList,
	type DiffResult,
	isEqual,
	type List,
	type UnknownRecord,
} from './list'
import { createState, type State } from './state'

/* === Types === */

type StoreOptions = {
	watched?: () => Cleanup
}

type BaseStore<T extends UnknownRecord> = {
	readonly [Symbol.toStringTag]: 'Store'
	readonly [Symbol.isConcatSpreadable]: false
	[Symbol.iterator](): IterableIterator<
		[
			string,
			State<T[keyof T] & {}> | Store<UnknownRecord> | List<unknown & {}>,
		]
	>
	keys(): IterableIterator<string>
	byKey<K extends keyof T & string>(
		key: K,
	): T[K] extends readonly (infer U extends {})[]
		? List<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: T[K] extends unknown & {}
				? State<T[K] & {}>
				: State<T[K] & {}> | undefined
	get(): T
	set(next: T): void
	update(fn: (prev: T) => T): void
	add<K extends keyof T & string>(key: K, value: T[K]): K
	remove(key: string): void
}

type Store<T extends UnknownRecord> = BaseStore<T> & {
	[K in keyof T]: T[K] extends readonly (infer U extends {})[]
		? List<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: T[K] extends unknown & {}
				? State<T[K] & {}>
				: State<T[K] & {}> | undefined
}

/* === Functions === */

/** Diff two records and return granular changes */
function diffRecords<T extends UnknownRecord>(prev: T, next: T): DiffResult {
	// Guard against non-objects that can't be diffed properly with Object.keys and 'in' operator
	const prevValid = isRecord(prev) || Array.isArray(prev)
	const nextValid = isRecord(next) || Array.isArray(next)
	if (!prevValid || !nextValid) {
		// For non-objects or non-plain objects, treat as complete change if different
		const changed = !Object.is(prev, next)
		return {
			changed,
			add: changed && nextValid ? next : {},
			change: {},
			remove: changed && prevValid ? prev : {},
		}
	}

	const visited = new WeakSet()

	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	let changed = false

	const prevKeys = Object.keys(prev)
	const nextKeys = Object.keys(next)

	// Pass 1: iterate new keys — find additions and changes
	for (const key of nextKeys) {
		if (key in prev) {
			if (!isEqual(prev[key], next[key], visited)) {
				change[key] = next[key]
				changed = true
			}
		} else {
			add[key] = next[key]
			changed = true
		}
	}

	// Pass 2: iterate old keys — find removals
	for (const key of prevKeys) {
		if (!(key in next)) {
			remove[key] = undefined
			changed = true
		}
	}

	return { add, change, remove, changed }
}

/**
 * Creates a reactive store with deeply nested reactive properties.
 * Each property becomes its own signal (State for primitives, nested Store for objects, List for arrays).
 * Properties are accessible directly via proxy.
 *
 * @since 0.15.0
 * @param value - Initial object value of the store
 * @param options - Optional configuration for watch lifecycle
 * @returns A Store with reactive properties
 *
 * @example
 * ```ts
 * const user = createStore({ name: 'Alice', age: 30 });
 * user.name.set('Bob'); // Only name subscribers react
 * console.log(user.get()); // { name: 'Bob', age: 30 }
 * ```
 */
function createStore<T extends UnknownRecord>(
	value: T,
	options?: StoreOptions,
): Store<T> {
	validateSignalValue(TYPE_STORE, value, isRecord)

	const signals = new Map<
		string,
		State<unknown & {}> | Store<UnknownRecord> | List<unknown & {}>
	>()

	// --- Internal helpers ---

	const addSignal = (key: string, val: unknown): void => {
		validateSignalValue(`${TYPE_STORE} for key "${key}"`, val)
		if (Array.isArray(val)) signals.set(key, createList(val))
		else if (isRecord(val)) signals.set(key, createStore(val))
		else signals.set(key, createState(val as unknown & {}))
	}

	// Build current value from child signals
	const buildValue = (): T => {
		const record = {} as UnknownRecord
		signals.forEach((signal, key) => {
			record[key] = signal.get()
		})
		return record as T
	}

	// Structural tracking node — not a general-purpose Memo.
	// On first get(): refresh() establishes edges from child signals.
	// On subsequent get(): untrack(buildValue) rebuilds without re-linking.
	// Mutation methods set FLAG_RELINK to force re-establishment on next read.
	const node: MemoNode<T> = {
		fn: buildValue,
		value,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: isEqual,
		error: undefined,
	}

	const applyChanges = (changes: DiffResult): boolean => {
		let structural = false

		// Additions
		for (const key in changes.add) {
			addSignal(key, changes.add[key])
			structural = true
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const val = changes.change[key]
					validateSignalValue(`${TYPE_STORE} for key "${key}"`, val)
					const signal = signals.get(key)
					if (signal) {
						// Type changed (e.g. primitive → object or vice versa): replace signal
						if (isRecord(val) !== isStore(signal)) {
							addSignal(key, val)
							structural = true
						} else signal.set(val as never)
					}
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
			structural = true
		}

		if (structural) node.flags |= FLAG_RELINK

		return changes.changed
	}

	const watched = options?.watched
	const subscribe = watched
		? () => {
				if (activeSink) {
					if (!node.sinks) node.stop = watched()
					link(node, activeSink)
				}
			}
		: () => {
				if (activeSink) link(node, activeSink)
			}

	// --- Initialize ---
	for (const key of Object.keys(value)) addSignal(key, value[key])

	// --- Store object ---
	const store: BaseStore<T> = {
		[Symbol.toStringTag]: TYPE_STORE,
		[Symbol.isConcatSpreadable]: false as const,

		*[Symbol.iterator]() {
			for (const key of Array.from(signals.keys())) {
				const signal = signals.get(key)
				if (signal)
					yield [key, signal] as [
						string,
						(
							| State<T[keyof T] & {}>
							| Store<UnknownRecord>
							| List<unknown & {}>
						),
					]
			}
		},

		keys() {
			subscribe()
			return signals.keys()
		},

		byKey<K extends keyof T & string>(key: K) {
			return signals.get(key) as T[K] extends readonly (infer U extends
				{})[]
				? List<U>
				: T[K] extends UnknownRecord
					? Store<T[K]>
					: T[K] extends unknown & {}
						? State<T[K] & {}>
						: State<T[K] & {}> | undefined
		},

		get() {
			subscribe()
			if (node.sources) {
				// Fast path: edges already established, rebuild value directly
				// from child signals using untrack to avoid creating spurious
				// edges to the current effect/memo consumer
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
				// First access: use refresh() to establish child → store edges
				refresh(node as unknown as SinkNode)
				if (node.error) throw node.error
			}
			return node.value
		},

		set(next: T) {
			// Use cached value if clean, recompute if dirty
			const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value

			const changes = diffRecords(prev, next)
			if (applyChanges(changes)) {
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		update(fn: (prev: T) => T) {
			store.set(fn(store.get()))
		},

		add<K extends keyof T & string>(key: K, value: T[K]) {
			if (signals.has(key))
				throw new DuplicateKeyError(TYPE_STORE, key, value)
			addSignal(key, value)
			node.flags |= FLAG_DIRTY | FLAG_RELINK
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			if (batchDepth === 0) flush()
			return key
		},

		remove(key: string) {
			const ok = signals.delete(key)
			if (ok) {
				node.flags |= FLAG_DIRTY | FLAG_RELINK
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},
	}

	// --- Proxy ---
	return new Proxy(store, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (typeof prop !== 'symbol')
				return target.byKey(prop as keyof T & string)
		},
		has(target, prop) {
			if (prop in target) return true
			return target.byKey(String(prop) as keyof T & string) !== undefined
		},
		ownKeys(target) {
			return Array.from(target.keys())
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)
			if (typeof prop === 'symbol') return undefined
			const signal = target.byKey(String(prop) as keyof T & string)
			return signal
				? {
						enumerable: true,
						configurable: true,
						writable: true,
						value: signal,
					}
				: undefined
		},
	}) as Store<T>
}

/**
 * Checks if a value is a Store signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a Store
 */
function isStore<T extends UnknownRecord>(value: unknown): value is Store<T> {
	return isObjectOfType(value, TYPE_STORE)
}

/* === Exports === */

export { createStore, isStore, type Store, type StoreOptions, TYPE_STORE }
