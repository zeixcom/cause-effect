import { DuplicateKeyError, validateSignalValue } from '../errors'
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
	TYPE_STORE,
	untrack,
} from '../graph'
import {
	isFunction,
	isObjectOfType,
	isRecord,
	isRecordOrArray,
	isSymbol,
} from '../util'
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
	[Symbol.iterator](): IterableIterator<[string, State<T[keyof T] & {}>]>
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
	set(newValue: T): void
	update(fn: (oldValue: T) => T): void
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
function diffRecords<T extends UnknownRecord>(
	oldObj: T,
	newObj: T,
): DiffResult {
	// Guard against non-objects that can't be diffed properly with Object.keys and 'in' operator
	const oldValid = isRecordOrArray(oldObj)
	const newValid = isRecordOrArray(newObj)
	if (!oldValid || !newValid) {
		// For non-objects or non-plain objects, treat as complete change if different
		const changed = !Object.is(oldObj, newObj)
		return {
			changed,
			add: changed && newValid ? newObj : {},
			change: {},
			remove: changed && oldValid ? oldObj : {},
		}
	}

	const visited = new WeakSet()

	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	let changed = false

	const oldKeys = Object.keys(oldObj)
	const newKeys = Object.keys(newObj)

	// Pass 1: iterate new keys — find additions and changes
	for (const key of newKeys) {
		if (key in oldObj) {
			if (!isEqual(oldObj[key], newObj[key], visited)) {
				change[key] = newObj[key]
				changed = true
			}
		} else {
			add[key] = newObj[key]
			changed = true
		}
	}

	// Pass 2: iterate old keys — find removals
	for (const key of oldKeys) {
		if (!(key in newObj)) {
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
 * @param initialValue - Initial object value of the store
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
	initialValue: T,
	options?: StoreOptions,
): Store<T> {
	validateSignalValue(TYPE_STORE, initialValue, isRecord)

	const signals = new Map<
		string,
		State<unknown & {}> | Store<UnknownRecord> | List<unknown & {}>
	>()

	// --- Internal helpers ---

	const addSignal = (key: string, value: unknown): void => {
		validateSignalValue(`${TYPE_STORE} for key "${key}"`, value)
		if (Array.isArray(value)) signals.set(key, createList(value))
		else if (isRecord(value)) signals.set(key, createStore(value))
		else signals.set(key, createState(value as unknown & {}))
	}

	// Build current value from child signals
	const buildValue = (): T => {
		const record = {} as UnknownRecord
		signals.forEach((signal, key) => {
			record[key] = signal.get()
		})
		return record as T
	}

	// MemoNode for graph edge tracking (child signals → store → store sinks)
	const node: MemoNode<T> = {
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
					const value = changes.change[key]
					validateSignalValue(`${TYPE_STORE} for key "${key}"`, value)
					const signal = signals.get(key)
					if (signal) {
						// Type changed (e.g. primitive → object or vice versa): replace signal
						if (isRecord(value) !== isStore(signal)) {
							addSignal(key, value)
							structural = true
						} else signal.set(value as never)
					}
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
			structural = true
		}

		if (structural) {
			node.sources = null
			node.sourcesTail = null
		}

		return changes.changed
	}

	// --- Initialize ---
	for (const key of Object.keys(initialValue))
		addSignal(key, initialValue[key])

	// --- Store object ---
	const store: BaseStore<T> = {
		[Symbol.toStringTag]: TYPE_STORE,
		[Symbol.isConcatSpreadable]: false as const,

		*[Symbol.iterator]() {
			for (const key of Array.from(signals.keys())) {
				const signal = signals.get(key)
				if (signal)
					yield [key, signal] as [string, State<T[keyof T] & {}>]
			}
		},

		keys() {
			if (activeSink) {
				if (!node.sinks && options?.watched)
					node.stop = options.watched()
				link(node, activeSink)
			}
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
			if (activeSink) {
				if (!node.sinks && options?.watched)
					node.stop = options.watched()
				link(node, activeSink)
			}
			if (node.sources) {
				// Fast path: edges already established, rebuild value directly
				// from child signals using untrack to avoid creating spurious
				// edges to the current effect/memo consumer
				if (node.flags) {
					node.value = untrack(buildValue)
					node.flags = FLAG_CLEAN
				}
			} else {
				// First access: use refresh() to establish child → store edges
				refresh(node as unknown as SinkNode)
				if (node.error) throw node.error
			}
			return node.value
		},

		set(newValue: T) {
			// Use cached value if clean, recompute if dirty
			const currentValue =
				node.flags & FLAG_DIRTY ? buildValue() : node.value

			const changes = diffRecords(currentValue, newValue)
			if (applyChanges(changes)) {
				// Call propagate BEFORE marking dirty to ensure it doesn't early-return
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
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
			node.sources = null
			node.sourcesTail = null
			propagate(node as unknown as SinkNode)
			node.flags |= FLAG_DIRTY
			if (batchDepth === 0) flush()
			return key
		},

		remove(key: string) {
			const ok = signals.delete(key)
			if (ok) {
				node.sources = null
				node.sourcesTail = null
				propagate(node as unknown as SinkNode)
				node.flags |= FLAG_DIRTY
				if (batchDepth === 0) flush()
			}
		},
	}

	// --- Proxy ---
	return new Proxy(store, {
		get(target, prop) {
			if (prop in target) {
				const value = Reflect.get(target, prop)
				return isFunction(value) ? value.bind(target) : value
			}
			if (!isSymbol(prop)) return target.byKey(prop as keyof T & string)
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
			if (isSymbol(prop)) return undefined
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
