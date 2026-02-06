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
import { isFunction, isNumber, isObjectOfType, isString } from '../util'
import {
	type Collection,
	type CollectionCallback,
	type CollectionSource,
	createCollection,
} from './collection'
import { createState, type State } from './state'
import { diff, type DiffResult, isEqual } from './store'

/* === Types === */

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

/* === Constants === */

const TYPE_LIST = 'List' as const

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

const createList = <T extends {}>(
	initialValue: T[],
	options?: ListOptions<T>,
): List<T> => {
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

	const node: RefNode<T[]> = {
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

	const linkList = () => {
		if (activeSink) {
			if (!node.sinks && options?.watched) node.stop = options.watched()
			link(node, activeSink)
		}
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

	const assembleValue = (): T[] => {
		return keys
			.map(key => signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]
	}

	const applyChanges = (changes: DiffResult): boolean => {
		// Additions
		for (const key in changes.add) {
			addSignal(key, changes.add[key] as T)
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
		}
		if (Object.keys(changes.remove).length) {
			keys = keys.filter(() => true)
		}

		return changes.changed
	}

	// --- Initialize ---
	const initRecord = toRecord(initialValue)
	for (const key in initRecord) {
		addSignal(key, initRecord[key])
	}

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
			linkList()
			return keys.length
		},

		get() {
			linkList()
			return assembleValue()
		},

		set(newValue: T[]) {
			const currentValue = assembleValue()
			const changes = diff(toRecord(currentValue), toRecord(newValue))
			if (applyChanges(changes)) notify()
		},

		update(fn: (oldValue: T[]) => T[]) {
			list.set(fn(list.get()))
		},

		at(index: number) {
			return signals.get(keys[index])
		},

		keys() {
			linkList()
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
			notify()
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
				keys = keys.filter(() => true)
				notify()
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
				notify()
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
				keys = newOrder.filter(() => true)
				notify()
			}

			return Object.values(remove)
		},

		deriveCollection<R extends {}>(
			cb: CollectionCallback<R, T>,
		): Collection<R> {
			return (
				createCollection as <T extends {}, U extends {}>(
					source: CollectionSource<U>,
					callback: CollectionCallback<T, U>,
				) => Collection<T>
			)(list, cb)
		},
	}

	return list
}

const isList = <T extends {}>(value: unknown): value is List<T> =>
	isObjectOfType(value, TYPE_LIST)

/* === Exports === */

export {
	createList,
	isList,
	TYPE_LIST,
	type KeyConfig,
	type List,
	type ListOptions,
}
