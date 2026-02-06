import {
	activeSink,
	batch,
	batchDepth,
	CircularDependencyError,
	type Cleanup,
	flush,
	link,
	propagate,
	type RefNode,
	validateSignalValue,
} from '../graph'
import {
	isFunction,
	isNonNullObject,
	isObjectOfType,
	isRecord,
	isRecordOrArray,
	isSymbol,
} from '../util'
import { createState, type State } from './state'

/* === Types === */

type UnknownRecord = Record<string, unknown>

type DiffResult = {
	changed: boolean
	add: UnknownRecord
	change: UnknownRecord
	remove: UnknownRecord
}

type StoreOptions = {
	watched?: () => Cleanup
}

type Store<T extends UnknownRecord> = {
	readonly [Symbol.toStringTag]: 'Store'
	readonly [Symbol.isConcatSpreadable]: false
	[Symbol.iterator](): IterableIterator<[string, State<T[keyof T] & {}>]>
	keys(): IterableIterator<string>
	byKey<K extends keyof T & string>(
		key: K,
	): T[K] extends UnknownRecord
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

/* === Constants === */

const TYPE_STORE = 'Store' as const

/* === Errors === */

class DuplicateKeyError extends Error {
	constructor(where: string, key: string, value?: unknown) {
		super(
			`Could not add ${where} key "${key}"${
				value ? ` with value ${JSON.stringify(value)}` : ''
			} because it already exists`,
		)
		this.name = 'DuplicateKeyError'
	}
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
const isEqual = <T>(a: T, b: T, visited?: WeakSet<object>): boolean => {
	// Fast paths
	if (Object.is(a, b)) return true
	if (typeof a !== typeof b) return false
	if (!isNonNullObject(a) || !isNonNullObject(b)) return false

	// Cycle detection
	if (!visited) visited = new WeakSet()
	if (visited.has(a as object) || visited.has(b as object))
		throw new CircularDependencyError('isEqual')
	visited.add(a)
	visited.add(b)

	try {
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false
			for (let i = 0; i < a.length; i++) {
				if (!isEqual(a[i], b[i], visited)) return false
			}
			return true
		}

		if (Array.isArray(a) !== Array.isArray(b)) return false

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
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult} The result of the comparison
 */
const diff = <T extends UnknownRecord>(oldObj: T, newObj: T): DiffResult => {
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

	const oldKeys = Object.keys(oldObj)
	const newKeys = Object.keys(newObj)
	const allKeys = new Set([...oldKeys, ...newKeys])

	for (const key of allKeys) {
		const oldHas = key in oldObj
		const newHas = key in newObj

		if (!oldHas && newHas) {
			add[key] = newObj[key]
			continue
		} else if (oldHas && !newHas) {
			remove[key] = null
			continue
		}

		const oldValue = oldObj[key]
		const newValue = newObj[key]

		if (!isEqual(oldValue, newValue, visited)) change[key] = newValue
	}

	return {
		add,
		change,
		remove,
		changed: !!(
			Object.keys(add).length ||
			Object.keys(change).length ||
			Object.keys(remove).length
		),
	}
}

const createStore = <T extends UnknownRecord>(
	initialValue: T,
	options?: StoreOptions,
): Store<T> => {
	validateSignalValue(TYPE_STORE, initialValue, isRecord)

	const signals = new Map<
		string,
		State<unknown & {}> | Store<UnknownRecord>
	>()

	const node: RefNode<T> = {
		value: initialValue,
		sinks: null,
		sinksTail: null,
		stop: undefined,
	}

	// --- Internal helpers ---

	const notify = () => {
		for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
		if (batchDepth === 0) flush()
	}

	const linkStore = () => {
		if (activeSink) {
			if (!node.sinks && options?.watched) node.stop = options.watched()
			link(node, activeSink)
		}
	}

	const addSignal = (key: string, value: unknown): void => {
		validateSignalValue(`${TYPE_STORE} for key "${key}"`, value)
		if (isRecord(value)) {
			signals.set(key, createStore(value))
		} else {
			signals.set(key, createState(value as unknown & {}))
		}
	}

	const assembleValue = (): T => {
		const record = {} as UnknownRecord
		signals.forEach((signal, key) => {
			record[key] = signal.get()
		})
		return record as T
	}

	const applyChanges = (changes: DiffResult): boolean => {
		// Additions
		for (const key in changes.add) {
			addSignal(key, changes.add[key])
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
						} else {
							signal.set(value as never)
						}
					}
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
		}

		return changes.changed
	}

	// --- Initialize ---
	for (const key of Object.keys(initialValue)) {
		addSignal(key, initialValue[key])
	}

	// --- Store object ---
	const store: Store<T> = {
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
			linkStore()
			return signals.keys()
		},

		byKey<K extends keyof T & string>(key: K) {
			return signals.get(key) as T[K] extends UnknownRecord
				? Store<T[K]>
				: T[K] extends unknown & {}
					? State<T[K] & {}>
					: State<T[K] & {}> | undefined
		},

		get() {
			linkStore()
			return assembleValue()
		},

		set(newValue: T) {
			const currentValue = assembleValue()
			const changed = applyChanges(diff(currentValue, newValue))
			if (changed) notify()
		},

		update(fn: (oldValue: T) => T) {
			store.set(fn(store.get()))
		},

		add<K extends keyof T & string>(key: K, value: T[K]) {
			if (signals.has(key))
				throw new DuplicateKeyError(TYPE_STORE, key, value)
			addSignal(key, value)
			notify()
			return key
		},

		remove(key: string) {
			const ok = signals.delete(key)
			if (ok) notify()
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

const isStore = <T extends UnknownRecord>(value: unknown): value is Store<T> =>
	isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export {
	createStore,
	diff,
	type DiffResult,
	isEqual,
	isStore,
	type Store,
	type StoreOptions,
	TYPE_STORE,
}
