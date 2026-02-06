import { diff } from '../diff'
import {
	activeSink,
	batch,
	batchDepth,
	type Cleanup,
	flush,
	link,
	propagate,
	type RefNode,
	validateSignalValue,
} from '../graph'
import { isFunction, isObjectOfType, isRecord, isSymbol } from '../util'
import {
	createList,
	type DiffResult,
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

const createStore = <T extends UnknownRecord>(
	initialValue: T,
	options?: StoreOptions,
): Store<T> => {
	validateSignalValue(TYPE_STORE, initialValue, isRecord)

	const signals = new Map<
		string,
		State<unknown & {}> | Store<UnknownRecord> | List<unknown & {}>
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
		if (Array.isArray(value)) signals.set(key, createList(value))
		else if (isRecord(value)) signals.set(key, createStore(value))
		else signals.set(key, createState(value as unknown & {}))
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
			linkStore()
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

export { createStore, isStore, type Store, type StoreOptions, TYPE_STORE }
