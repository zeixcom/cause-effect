import { type DiffResult, diff, isEqual, type UnknownArray } from '../src/diff'
import {
	DuplicateKeyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
} from '../src/errors'
import { isMutableSignal, type MutableSignal } from '../src/signal'
import {
	batchSignalWrites,
	type Cleanup,
	createWatcher,
	emitNotification,
	type Listener,
	type Listeners,
	type Notifications,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
	type Watcher,
} from '../src/system'
import {
	isFunction,
	isNumber,
	isObjectOfType,
	isRecord,
	isString,
	isSymbol,
	UNSET,
} from '../src/util'
import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from './collection'
import { isComputed } from './computed'
import { createState, isState } from './state'
import { createStore, isStore } from './store'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type KeyConfig<T> = string | ((item: T) => string)

type List<T extends {}> = {
	readonly [Symbol.toStringTag]: 'List'
	[Symbol.iterator](): IterableIterator<MutableSignal<T>>
	readonly [Symbol.isConcatSpreadable]: boolean
	[n: number]: MutableSignal<T>
	readonly length: number
	add(value: T): string
	byKey(key: string): MutableSignal<T> | undefined
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
	const signals = new Map<string, MutableSignal<T>>()
	const ownWatchers = new Map<string, Watcher>()

	// Stable key support for lists
	let keyCounter = 0
	let order: string[] = []

	// Get signal by key or index
	const getSignal = (prop: string): MutableSignal<T> | undefined => {
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

	// Add own watcher for nested signal
	const addOwnWatcher = (key: string, signal: MutableSignal<T>) => {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				signal.get() // Subscribe to the signal
				emitNotification(listeners.change, [key])
			})
		})
		ownWatchers.set(key, watcher)
	}

	// Add nested signal and own watcher
	const addProperty = <K extends keyof T & string>(
		key: K,
		value: T[K],
		single = false,
	): boolean => {
		if (!isValidValue(key, value)) return false

		// Create signal for key
		// @ts-expect-error ignore
		const signal: MutableSignal<T[K] & {}> =
			isState(value) || isStore(value)
				? (value as unknown as MutableSignal<T[K] & {}>)
				: isRecord(value) || Array.isArray(value)
					? createStore(value)
					: createState(value)

		// Set internal states
		// @ts-expect-error ignore
		signals.set(key, signal)
		if (!order.includes(key)) order.push(key)
		// @ts-expect-error ignore
		if (listeners.change.size) addOwnWatcher(key, signal)

		if (single) {
			notifyWatchers(watchers)
			emitNotification(listeners.add, [key])
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
		const watcher = ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			ownWatchers.delete(key)
		}

		if (single) {
			order = order.filter(() => true) // Compact array
			notifyWatchers(watchers)
			emitNotification(listeners.remove, [key])
		}
	}

	// Commit batched changes and emit notifications
	const batchChanges = (changes: DiffResult, initialRun?: boolean) => {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				// @ts-expect-error ignore
				addProperty(key, changes.add[key] as T, false)

			// Queue initial additions event to allow listeners to be added first
			if (initialRun)
				setTimeout(() => {
					emitNotification(listeners.add, Object.keys(changes.add))
				}, 0)
			else emitNotification(listeners.add, Object.keys(changes.add))
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batchSignalWrites(() => {
				for (const key in changes.change) {
					const value = changes.change[key] as T
					if (!isValidValue(key, value)) continue

					const signal = signals.get(key)
					if (isMutableSignal(signal)) signal.set(value)
					else throw new ReadonlySignalError(key, value)
				}
				emitNotification(listeners.change, Object.keys(changes.change))
			})
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove) removeProperty(key)
			order = order.filter(() => true)
			emitNotification(listeners.remove, Object.keys(changes.remove))
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
		length: {
			get(): number {
				subscribeActiveWatcher(watchers)
				return signals.size
			},
		},
		order: {
			get(): string[] {
				subscribeActiveWatcher(watchers)
				return order
			},
		},
		at: {
			value(index: number): MutableSignal<T> | undefined {
				return signals.get(order[index])
			},
		},
		byKey: {
			value: (key: string): MutableSignal<T> | undefined => {
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
				subscribeActiveWatcher(watchers)
				return current()
			},
		},
		set: {
			value: (newValue: T[]): void => {
				if (reconcile(current(), newValue)) {
					notifyWatchers(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (oldValue: T[]) => T[]): void => {
				const oldValue = current()
				const newValue = fn(oldValue)
				if (reconcile(oldValue, newValue)) {
					notifyWatchers(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		add: {
			value: (value: T): string => {
				const key = generateKey(value)
				if (!signals.has(key)) {
					// @ts-expect-error ignore
					addProperty(key, value, true)
					return key
				} else throw new DuplicateKeyError('store', key, value)
			},
		},
		remove: {
			value: (keyOrIndex: string | number): void => {
				const key = isNumber(keyOrIndex)
					? order[keyOrIndex]
					: keyOrIndex
				if (key && signals.has(key)) removeProperty(key, true)
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
					.map(key => [key, signals.get(key)?.get()] as [string, T])
					.sort(
						compareFn
							? (a, b) => compareFn(a[1], b[1])
							: (a, b) =>
									String(a[1]).localeCompare(String(b[1])),
					)

				// Set new order
				const newOrder = entries.map(([key]) => key)
				if (!isEqual(newOrder, order)) {
					order = newOrder
					notifyWatchers(watchers)
					emitNotification(listeners.sort, order)
				}
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

				notifyWatchers(watchers)

				return Object.values(remove) as T[]
			},
		},
		on: {
			value: <K extends keyof Notifications>(
				type: K,
				listener: Listener<K>,
			): Cleanup => {
				listeners[type].add(listener)
				if (type === 'change' && !ownWatchers.size) {
					for (const [key, signal] of signals)
						addOwnWatcher(key, signal)
				}
				return () => {
					listeners[type].delete(listener)
					if (type === 'change' && !listeners.change.size) {
						if (ownWatchers.size) {
							for (const watcher of ownWatchers.values())
								watcher.stop()
							ownWatchers.clear()
						}
					}
				}
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
