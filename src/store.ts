import { isComputed } from './computed'
import {
	type ArrayToRecord,
	diff,
	type PartialRecord,
	type UnknownArray,
	type UnknownRecord,
} from './diff'
import {
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreKeyExistsError,
	StoreKeyRangeError,
	StoreKeyReadonlyError,
} from './errors'
import { isMutableSignal, type Signal } from './signal'
import { createState, isState, type State } from './state'
import {
	batch,
	type Cleanup,
	createWatcher,
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
	valueString,
} from './util'

/* === Types === */

type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never

type StoreKeySignal<T extends {}> = T extends
	| readonly unknown[]
	| Record<string, unknown>
	? Store<T>
	: State<T>

type KeyConfig<T> = string | ((item: ArrayItem<T>) => string)

type StoreChanges<T> = {
	add: PartialRecord<T>
	change: PartialRecord<T>
	remove: PartialRecord<T>
	sort: string[]
}

type StoreListeners<T> = {
	[K in keyof StoreChanges<T>]: Set<(change: StoreChanges<T>[K]) => void>
}

interface BaseStore {
	readonly [Symbol.toStringTag]: 'Store'
	readonly length: number
}

type RecordStore<T extends UnknownRecord> = BaseStore & {
	[K in keyof T]: T[K] extends readonly unknown[] | Record<string, unknown>
		? Store<T[K]>
		: State<T[K]>
} & {
	[Symbol.iterator](): IterableIterator<
		[Extract<keyof T, string>, StoreKeySignal<T[Extract<keyof T, string>]>]
	>
	add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void
	byKey<K extends Extract<keyof T, string>>(key: K): StoreKeySignal<T[K]>
	get(): T
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	set(value: T): void
	update(fn: (value: T) => T): void
	sort<U = T[Extract<keyof T, string>]>(
		compareFn?: (a: U, b: U) => number,
	): void
	on<K extends keyof StoreChanges<T>>(
		type: K,
		listener: (change: StoreChanges<T>[K]) => void,
	): Cleanup
	remove<K extends Extract<keyof T, string>>(key: K): void
}

type ArrayStore<T extends UnknownArray> = BaseStore & {
	[Symbol.iterator](): IterableIterator<StoreKeySignal<ArrayItem<T>>>
	readonly [Symbol.isConcatSpreadable]: boolean
	[n: number]: StoreKeySignal<ArrayItem<T>>
	add(value: ArrayItem<T>): void
	byKey(key: string): StoreKeySignal<ArrayItem<T>> | undefined
	get(): T
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	set(value: T): void
	update(fn: (value: T) => T): void
	sort<U = ArrayItem<T>>(compareFn?: (a: U, b: U) => number): void
	splice(
		start: number,
		deleteCount?: number,
		...items: ArrayItem<T>[]
	): ArrayItem<T>[]
	on<K extends keyof StoreChanges<T>>(
		type: K,
		listener: (change: StoreChanges<T>[K]) => void,
	): Cleanup
	remove(index: number): void
}

type Store<T extends UnknownRecord | UnknownArray> = T extends UnknownRecord
	? RecordStore<T>
	: T extends UnknownArray
		? ArrayStore<T>
		: never

/* === Constants === */

const TYPE_STORE = 'Store'

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * For array-like stores, an optional keyConfig parameter can be provided to
 * generate stable keys for array items. This creates persistent references
 * that remain stable across sort and compact operations.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @param {KeyConfig<T>} keyConfig - optional key configuration for array-like stores:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
const createStore = <T extends UnknownRecord | UnknownArray>(
	initialValue: T,
	keyConfig?: T extends UnknownArray ? KeyConfig<T> : never,
): Store<T> => {
	if (initialValue == null) throw new NullishSignalValueError('store')

	const watchers = new Set<Watcher>()
	const listeners: StoreListeners<T> = {
		add: new Set<(change: PartialRecord<T>) => void>(),
		change: new Set<(change: PartialRecord<T>) => void>(),
		remove: new Set<(change: PartialRecord<T>) => void>(),
		sort: new Set<(change: string[]) => void>(),
	}
	const signals = new Map<string, Signal<T[Extract<keyof T, string>] & {}>>()
	const signalWatchers = new Map<string, Watcher>()

	// Determine if this is an array-like store at creation time
	const isArrayLike = Array.isArray(initialValue)

	// Stable key support for array-like stores
	let keyCounter = 0
	let order: string[] = []

	// Get signal by key or index (for array-like stores only)
	const getSignal = (
		prop: string,
	): Signal<T[Extract<keyof T, string>] & {}> | undefined => {
		let key = prop
		if (isArrayLike) {
			const index = Number(prop)
			if (Number.isInteger(index) && index >= 0)
				key = order[index] ?? prop
		}
		return signals.get(key)
	}

	// Generate stable key for array items
	const generateKey = (item: ArrayItem<T>): string => {
		if (!isArrayLike) return ''
		const id = keyCounter++
		return isString(keyConfig)
			? `${keyConfig}${id}`
			: isFunction(keyConfig)
				? keyConfig(item)
				: String(id)
	}

	// Convert array to record with stable keys
	const arrayToRecord = (array: T) => {
		if (!Array.isArray(array)) return array

		const record = {} as Record<string, ArrayItem<T>>

		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = order[i]
			if (!key) {
				// Generate new stable key for this position
				key = generateKey(value as ArrayItem<T>)
				order[i] = key
			}
			record[key] = value
		}
		return record
	}

	// Get current record
	const current = (): T => {
		if (isArrayLike)
			return order
				.map(key => signals.get(key)?.get())
				.filter(v => v !== undefined) as unknown as T
		const record = {} as PartialRecord<T>
		for (const key of order) {
			const signal = signals.get(key)
			if (signal) record[key] = signal.get()
		}
		return record as unknown as T
	}

	// Emit change notifications
	const emit = <K extends keyof StoreChanges<T>>(
		key: K,
		changes: StoreChanges<T>[K],
	) => {
		Object.freeze(changes)
		for (const listener of listeners[key]) listener(changes)
	}

	// Validate input
	const isValidValue = <T>(
		key: string,
		value: T,
	): value is NonNullable<T> => {
		if (value == null)
			throw new NullishSignalValueError(`store for key "${key}"`)
		if (value === UNSET) return true
		if (isSymbol(value) || isFunction(value) || isComputed(value))
			throw new InvalidSignalValueError(
				`store for key "${key}"`,
				valueString(value),
			)
		return true
	}

	// Add nested signal and effect
	const addProperty = (
		key: string,
		value: ArrayItem<T> | T[keyof T],
		single = false,
	): boolean => {
		if (!isValidValue(key, value)) return false

		const signal =
			isState(value) || isStore(value)
				? value
				: isRecord(value) || Array.isArray(value)
					? createStore(value)
					: createState(value)
		// @ts-expect-error non-matching signal types
		signals.set(key, signal)

		// Add to order array for all stores
		if (!order.includes(key)) {
			order.push(key)
		}

		const watcher = createWatcher(() =>
			observe(() => {
				emit('change', { [key]: signal.get() } as PartialRecord<T>)
			}, watcher),
		)
		watcher()
		signalWatchers.set(key, watcher)

		if (single) {
			notify(watchers)
			emit('add', { [key]: value } as PartialRecord<T>)
		}
		return true
	}

	// Remove nested signal and effect
	const removeProperty = (key: string, single = false) => {
		// Remove from order array for all stores
		const index = order.indexOf(key)
		if (index >= 0) {
			order = [...order.slice(0, index), ...order.slice(index + 1)]
			if (single) order = [...order]
		}

		const ok = signals.delete(key)
		if (ok) {
			const watcher = signalWatchers.get(key)
			if (watcher) watcher.cleanup()
			signalWatchers.delete(key)
		}

		if (single) {
			notify(watchers)
			emit('remove', { [key]: UNSET } as PartialRecord<T>)
		}
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean => {
		const oldRecord = isArrayLike ? arrayToRecord(oldValue) : oldValue
		const newRecord = isArrayLike ? arrayToRecord(newValue) : newValue

		const changes = diff(
			oldRecord as T extends UnknownArray ? ArrayToRecord<T> : T,
			newRecord as T extends UnknownArray ? ArrayToRecord<T> : T,
		)

		batch(() => {
			// Additions
			if (Object.keys(changes.add).length) {
				for (const key in changes.add) {
					const value = changes.add[key]
					// Skip undefined values in sparse arrays
					if (value === undefined) continue

					addProperty(key, value ?? UNSET, false)
				}

				// Queue initial additions event to allow listeners to be added first
				if (initialRun) {
					setTimeout(() => {
						emit('add', changes.add)
					}, 0)
				} else {
					emit('add', changes.add)
				}
			}

			// Changes
			if (Object.keys(changes.change).length) {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!isValidValue(key, value)) continue

					const signal = signals.get(key)
					if (isMutableSignal(signal)) signal.set(value)
					else
						throw new StoreKeyReadonlyError(key, valueString(value))
				}
				emit('change', changes.change)
			}

			// Removals
			if (Object.keys(changes.remove).length) {
				for (const key in changes.remove) removeProperty(key)
				order = order.filter(() => true)
				emit('remove', changes.remove)
			}
		})

		return changes.changed
	}

	// Initialize data
	reconcile(
		isArrayLike ? ([] as unknown as T) : ({} as T),
		initialValue,
		true,
	)

	// Methods and Properties
	const store: Record<PropertyKey, unknown> = {}
	Object.defineProperties(store, {
		[Symbol.toStringTag]: {
			value: TYPE_STORE,
		},
		[Symbol.isConcatSpreadable]: {
			value: isArrayLike,
		},
		[Symbol.iterator]: {
			value: isArrayLike
				? function* () {
						const indexes = order.keys()
						for (const index of indexes) {
							const key = order[index]
							if (key) yield signals.get(key)
						}
					}
				: function* () {
						for (const key of order) {
							const signal = signals.get(key)
							if (signal) yield [key, signal]
						}
					},
		},
		add: {
			value: isArrayLike
				? (v: ArrayItem<T>): void => {
						const index = order.length
						const key = generateKey(v as ArrayItem<T>)
						order[index] = key
						addProperty(key, v, true)
					}
				: <K extends Extract<keyof T, string>>(k: K, v: T[K]): void => {
						if (!signals.has(k)) addProperty(k, v, true)
						else throw new StoreKeyExistsError(k, valueString(v))
					},
		},
		byKey: {
			value(key: string) {
				return getSignal(key)
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
			value: (): T => {
				subscribe(watchers)
				if (isArrayLike) {
					return order
						.map(key => signals.get(key)?.get())
						.filter(v => v !== undefined) as unknown as T
				} else {
					return current() as T
				}
			},
		},
		remove: {
			value: (keyOrIndex: string | number): void => {
				let key = String(keyOrIndex)
				if (isArrayLike && isNumber(keyOrIndex)) {
					if (!order[keyOrIndex])
						throw new StoreKeyRangeError(keyOrIndex)
					key = order[keyOrIndex]
				}
				if (signals.has(key)) removeProperty(key, true)
			},
		},
		set: {
			value: (v: T): void => {
				if (reconcile(current(), v)) {
					notify(watchers)
					if (UNSET === v) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (v: T) => T): void => {
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
						? ArrayItem<T>
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

				// Create new positional mappings
				order = entries.map(([_, key]) => key)

				notify(watchers)
				emit('sort', order)
			},
		},
		splice: {
			value: (
				start: number,
				deleteCount?: number,
				...items: ArrayItem<T>[]
			): ArrayItem<T>[] => {
				if (!isArrayLike)
					throw new Error('Cannot splice non-array-like object')

				const length = signals.size
				if (deleteCount === undefined)
					deleteCount = Math.max(0, length - Math.max(0, start))

				// Normalize start index
				const actualStart =
					start < 0
						? Math.max(0, length + start)
						: Math.min(start, length)

				// Normalize deleteCount
				const actualDeleteCount = Math.max(
					0,
					Math.min(deleteCount, length - actualStart),
				)

				const deleted: ArrayItem<T>[] = []
				const deletedKeys: string[] = []

				// Work with a copy of order to avoid mutation during operation
				const originalOrder = [...order]

				// Collect items to delete and their keys
				for (let i = 0; i < actualDeleteCount; i++) {
					const index = actualStart + i
					const key = originalOrder[index]
					if (key) {
						const signal = signals.get(key)
						if (signal) {
							deleted.push(signal.get() as ArrayItem<T>)
							deletedKeys.push(key)
						}
					}
				}

				// Remove deleted items from signals map
				deletedKeys.forEach(key => {
					signals.delete(key)
					const watcher = signalWatchers.get(key)
					if (watcher) watcher.cleanup()
					signalWatchers.delete(key)
				})

				// Build new order: items before splice point
				const newOrder = originalOrder.slice(0, actualStart)

				// Add new items
				const addedKeys: string[] = []
				for (const item of items) {
					const key = generateKey(item)
					newOrder.push(key)
					addProperty(key, item, false)
					addedKeys.push(key)
				}

				// Add items after splice point
				newOrder.push(
					...originalOrder.slice(actualStart + actualDeleteCount),
				)

				// Update the order array
				order = newOrder

				// Emit events for changes
				if (deletedKeys.length > 0) {
					const removeChange = {} as PartialRecord<T>
					deletedKeys.forEach(key => {
						removeChange[key] = UNSET
					})
					emit('remove', removeChange)
				}

				if (addedKeys.length > 0) {
					const addChange = {} as PartialRecord<T>
					addedKeys.forEach(key => {
						const signal = signals.get(key)
						if (signal) addChange[key] = signal.get()
					})
					emit('add', addChange)
				}

				// Notify watchers
				notify(watchers)

				return deleted
			},
		},
		on: {
			value: <K extends keyof StoreChanges<T>>(
				type: K,
				listener: (change: StoreChanges<T>[K]) => void,
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
	return new Proxy(store as Store<T>, {
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
}

/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
const isStore = <T extends UnknownRecord | UnknownArray>(
	value: unknown,
): value is Store<T> => isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export {
	TYPE_STORE,
	isStore,
	createStore,
	type Store,
	type StoreChanges,
	type KeyConfig,
}
