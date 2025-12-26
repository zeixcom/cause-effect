import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from './collection'
import { isComputed } from './computed'
import {
	type DiffResult,
	diff,
	type UnknownArray,
	type UnknownRecord,
} from './diff'
import {
	DuplicateKeyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreIndexRangeError,
	StoreKeyReadonlyError,
} from './errors'
import { isMutableSignal } from './signal'
import { createState, isState, type State } from './state'
import { createStore, isStore, type Store } from './store'
import {
	batch,
	type Cleanup,
	createWatcher,
	emit,
	type Listener,
	type Listeners,
	type Notifications,
	notify,
	observe,
	subscribe,
	type Watcher,
} from './system'
import {
	isFunction,
	isNumber,
	isObjectOfType,
	isRecord,
	isString,
	isSymbol,
	UNSET,
} from './util'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type ListItemSignal<T extends {}> = T extends readonly (infer U extends {})[]
	? List<U>
	: T extends UnknownRecord
		? Store<T>
		: State<T>

type KeyConfig<T> = string | ((item: T) => string)

type List<T extends {}> = {
	readonly [Symbol.toStringTag]: 'List'
	[Symbol.iterator](): IterableIterator<ListItemSignal<T>>
	readonly [Symbol.isConcatSpreadable]: boolean
	[n: number]: ListItemSignal<T>
	readonly length: number
	add(value: T): string
	byKey(key: string): ListItemSignal<T> | undefined
	deriveCollection<U extends {}>(
		callback: CollectionCallback<U, T extends UnknownArray ? T : never>,
	): Collection<U>
	get(): T
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	set(value: T): void
	update(fn: (value: T) => T): void
	sort<U = T>(compareFn?: (a: U, b: U) => number): void
	splice(start: number, deleteCount?: number, ...items: T[]): T[]
	on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup
	remove(index: number): void
}

/* === Constants === */

const TYPE_LIST = 'List' as const

/* === Functions === */

/**
 * Create a new list with deeply nested reactive list items
 *
 * @since 0.16.2
 * @param {T} initialValue - Initial array of the list
 * @param {KeyConfig<T>} keyConfig - Optional key configuration:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {List<T>} - New list with reactive items of type T
 */
const createList = <T extends {}>(
	initialValue: T[],
	keyConfig?: KeyConfig<T>,
): List<T> => {
	if (initialValue == null) throw new NullishSignalValueError('store')

	const watchers = new Set<Watcher>()
	const listeners: Listeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
		sort: new Set<Listener<'sort'>>(),
	}
	const signals = new Map<string, ListItemSignal<T>>()
	const signalWatchers = new Map<string, Watcher>()

	// Stable key support for array-like stores
	let keyCounter = 0
	let order: string[] = []

	// Get signal by key or index
	const getSignal = (prop: string): ListItemSignal<T> | undefined => {
		let key = prop
		const index = Number(prop)
		if (Number.isInteger(index) && index >= 0) key = order[index] ?? prop
		return signals.get(key)
	}

	// Generate stable key for array items
	const generateKey = (item: T): string => {
		const id = keyCounter++
		return isString(keyConfig)
			? `${keyConfig}${id}`
			: isFunction<string>(keyConfig)
				? keyConfig(item)
				: String(id)
	}

	// Convert array to record with stable keys
	const arrayToRecord = (array: T[]): ArrayToRecord<T[]> => {
		const record = {} as Record<string, T>

		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = order[i]
			if (!key) {
				key = generateKey(value)
				order[i] = key
			}
			record[key] = value
		}
		return record
	}

	// Get current record
	const current = (): T[] =>
		order
			.map(key => signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]

	// Validate input
	const isValidValue = <T>(
		key: string,
		value: T,
	): value is NonNullable<T> => {
		if (value == null)
			throw new NullishSignalValueError(`store for key "${key}"`)
		if (value === UNSET) return true
		if (isSymbol(value) || isFunction(value) || isComputed(value))
			throw new InvalidSignalValueError(`store for key "${key}"`, value)
		return true
	}

	// Add nested signal and effect
	const addProperty = (key: string, value: T, single = false): boolean => {
		if (!isValidValue(key, value)) return false

		// Create signal for key
		const signal =
			isState(value) || isStore(value) || isList(value)
				? value
				: isRecord(value)
					? createStore(value)
					: Array.isArray(value)
						? createList(value)
						: createState(value)

		// Set internal states
		// @ts-expect-error non-matching signal types
		signals.set(key, signal)
		if (!order.includes(key)) order.push(key)

		// Create a watcher to detect changes in the nested signal
		const watcher = createWatcher(() =>
			observe(() => {
				signal.get() // Subscribe to the signal
				emit(listeners.change, [key])
			}, watcher),
		)
		watcher()
		signalWatchers.set(key, watcher)

		if (single) {
			notify(watchers)
			emit(listeners.add, [key])
		}
		return true
	}

	// Remove nested signal and effect
	const removeProperty = (key: string, single = false) => {
		// Remove signal for key
		const ok = signals.delete(key)
		if (!ok) return

		// Clean up internal states
		const index = order.indexOf(key)
		if (index >= 0) order.splice(index, 1)
		const watcher = signalWatchers.get(key)
		if (watcher) watcher.cleanup()
		signalWatchers.delete(key)

		if (single) {
			order = order.filter(() => true) // Compact array
			notify(watchers)
			emit(listeners.remove, [key])
		}
	}

	// Commit batched changes and emit notifications
	const batchChanges = (changes: DiffResult, initialRun?: boolean) => {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				addProperty(key, changes.add[key] as T, false)

			// Queue initial additions event to allow listeners to be added first
			if (initialRun)
				setTimeout(() => {
					emit(listeners.add, Object.keys(changes.add))
				}, 0)
			else emit(listeners.add, Object.keys(changes.add))
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!isValidValue(key, value)) continue

					const signal = signals.get(key)
					if (isMutableSignal(signal)) signal.set(value)
					else throw new StoreKeyReadonlyError(key, value)
				}
				emit(listeners.change, Object.keys(changes.change))
			})
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove) removeProperty(key)
			order = order.filter(() => true)
			emit(listeners.remove, Object.keys(changes.remove))
		}

		return changes.changed
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T[],
		newValue: T[],
		initialRun?: boolean,
	): boolean =>
		batchChanges(
			diff(arrayToRecord(oldValue), arrayToRecord(newValue)),
			initialRun,
		)

	// Initialize data
	reconcile([] as T[], initialValue, true)

	// Methods and Properties
	const prototype: Record<PropertyKey, unknown> = {}
	Object.defineProperties(prototype, {
		[Symbol.toStringTag]: {
			value: TYPE_LIST,
		},
		[Symbol.isConcatSpreadable]: {
			value: true,
		},
		[Symbol.iterator]: {
			value: function* () {
				for (const key of order) {
					const signal = signals.get(key)
					if (signal) yield signal
				}
			},
		},
		add: {
			value: (value: T): string => {
				const key = generateKey(value)
				if (!signals.has(key)) {
					addProperty(key, value, true)
					return key
				} else throw new DuplicateKeyError('store', key, value)
			},
		},
		byKey: {
			value: (key: string) => {
				return getSignal(key)
			},
		},
		deriveCollection: {
			value: <U extends {}>(
				callback: CollectionCallback<U, T>,
			): Collection<U> => {
				const collection = createCollection(list, callback)
				return collection
			},
		},
		keyAt: {
			value(index: number): string | undefined {
				return order[index]
			},
		},
		indexOfKey: {
			value(key: string): number {
				return order.indexOf(key)
			},
		},
		get: {
			value: (): T[] => {
				subscribe(watchers)
				return current()
			},
		},
		remove: {
			value: (keyOrIndex: string | number): void => {
				let key = String(keyOrIndex)
				if (isNumber(keyOrIndex)) {
					if (!order[keyOrIndex])
						throw new StoreIndexRangeError(keyOrIndex)
					key = order[keyOrIndex]
				}
				if (signals.has(key)) removeProperty(key, true)
			},
		},
		set: {
			value: (newValue: T[]): void => {
				if (reconcile(current(), newValue)) {
					notify(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (oldValue: T[]) => T[]): void => {
				const oldValue = current()
				const newValue = fn(oldValue)
				if (reconcile(oldValue, newValue)) {
					notify(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		sort: {
			value: (
				compareFn?: <
					U = T extends UnknownArray
						? T
						: T[Extract<keyof T, string>],
				>(
					a: U,
					b: U,
				) => number,
			): void => {
				const entries = order
					.map((key, index) => {
						const signal = signals.get(key)
						return [
							index,
							key,
							signal ? signal.get() : undefined,
						] as [number, string, unknown]
					})
					.sort(
						compareFn
							? (a, b) => compareFn(a[2], b[2])
							: (a, b) =>
									String(a[2]).localeCompare(String(b[2])),
					)

				// Set new order
				order = entries.map(([_, key]) => key)

				notify(watchers)
				emit(listeners.sort, order)
			},
		},
		splice: {
			value: (
				start: number,
				deleteCount?: number,
				...items: T[]
			): T[] => {
				// Normalize start and deleteCount
				const length = signals.size
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

				// Collect items to delete and their keys
				for (let i = 0; i < actualDeleteCount; i++) {
					const index = actualStart + i
					const key = order[index]
					if (key) {
						const signal = signals.get(key)
						if (signal) remove[key] = signal.get() as T
					}
				}

				// Build new order: items before splice point
				const newOrder = order.slice(0, actualStart)

				// Add new items
				for (const item of items) {
					const key = generateKey(item)
					newOrder.push(key)
					add[key] = item as T
				}

				// Add items after splice point
				newOrder.push(...order.slice(actualStart + actualDeleteCount))

				// Update the order array
				order = newOrder.filter(() => true) // Compact array

				const changed = !!(
					Object.keys(add).length || Object.keys(remove).length
				)

				if (changed)
					batchChanges({
						add,
						change: {} as Record<string, T>,
						remove,
						changed,
					})

				notify(watchers)

				return Object.values(remove) as T[]
			},
		},
		on: {
			value: <K extends keyof Notifications>(
				type: K,
				listener: Listener<K>,
			): Cleanup => {
				listeners[type].add(listener)
				return () => listeners[type].delete(listener)
			},
		},
		length: {
			get(): number {
				subscribe(watchers)
				return signals.size
			},
		},
	})

	// Return proxy directly with integrated signal methods
	const list = new Proxy(prototype as List<T>, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (!isSymbol(prop)) return getSignal(prop)
		},
		has(target, prop) {
			if (prop in target) return true
			return signals.has(String(prop))
		},
		ownKeys(target) {
			const staticKeys = Reflect.ownKeys(target)
			return [...new Set([...order, ...staticKeys])]
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)
			if (isSymbol(prop)) return undefined

			const signal = getSignal(prop)
			return signal
				? {
						enumerable: true,
						configurable: true,
						writable: true,
						value: signal,
					}
				: undefined
		},
	})
	return list
}

/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a List instance, false otherwise
 */
const isList = <T extends {}>(value: unknown): value is List<T> =>
	isObjectOfType(value, TYPE_LIST)

/* === Exports === */

export {
	TYPE_LIST,
	isList,
	createList,
	type ArrayToRecord,
	type List,
	type KeyConfig,
}
