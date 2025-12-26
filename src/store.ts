import { type Collection, createCollection } from './collection'
import { type ComputedCallback, isComputed } from './computed'
import {
	type ArrayToRecord,
	type DiffResult,
	diff,
	type PartialRecord,
	type UnknownArray,
	type UnknownRecord,
} from './diff'
import {
	DuplicateKeyError,
	ForbiddenMethodCallError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreIndexRangeError,
	StoreKeyReadonlyError,
} from './errors'
import { isMutableSignal, type Signal } from './signal'
import { createState, isState, type State } from './state'
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

type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never

type StoreKeySignal<T extends {}> = T extends
	| readonly unknown[]
	| Record<string, unknown>
	? Store<T>
	: State<T>

type KeyConfig<T> = string | ((item: ArrayItem<T>) => string)

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
	add<K extends Extract<keyof T, string>>(key: K, value: T[K]): K
	byKey<K extends Extract<keyof T, string>>(key: K): StoreKeySignal<T[K]>
	get(): T
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	set(value: T): void
	update(fn: (value: T) => T): void
	sort<U = T[Extract<keyof T, string>]>(
		compareFn?: (a: U, b: U) => number,
	): void
	on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup
	remove<K extends Extract<keyof T, string>>(key: K): void
}

type ArrayStore<T extends UnknownArray> = BaseStore & {
	[Symbol.iterator](): IterableIterator<StoreKeySignal<ArrayItem<T>>>
	readonly [Symbol.isConcatSpreadable]: boolean
	[n: number]: StoreKeySignal<ArrayItem<T>>
	add(value: ArrayItem<T>): string
	byKey(key: string): StoreKeySignal<ArrayItem<T>> | undefined
	deriveCollection<U extends UnknownArray>(
		mapFn: ComputedCallback<ArrayItem<U>>,
	): Collection<U>
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
	on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup
	remove(index: number): void
}

type Store<T extends UnknownRecord | UnknownArray> = T extends UnknownRecord
	? RecordStore<T>
	: T extends UnknownArray
		? ArrayStore<T>
		: never

/* === Constants === */

const TYPE_STORE = 'Store' as const

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
	const listeners: Listeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
		sort: new Set<Listener<'sort'>>(),
	}
	const signals = new Map<string, Signal<T[Extract<keyof T, string>] & {}>>()
	const signalWatchers = new Map<string, Watcher>()

	// Determine if this is an array-like store at creation time
	const isArrayLike = Array.isArray(initialValue)

	// Stable key support for array-like stores
	let keyCounter = 0
	let order: string[] = []

	// Get signal by key or index
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
			: isFunction<string>(keyConfig)
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
	const addProperty = (
		key: string,
		value: ArrayItem<T> | T[keyof T],
		single = false,
	): boolean => {
		if (!isValidValue(key, value)) return false

		// Create signal for key
		const signal =
			isState(value) || isStore(value)
				? value
				: isRecord(value) || Array.isArray(value)
					? createStore(value)
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
	const batchChanges = (changes: DiffResult<T>, initialRun?: boolean) => {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				addProperty(key, changes.add[key] ?? UNSET, false)

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
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean =>
		batchChanges(
			diff(
				(isArrayLike
					? arrayToRecord(oldValue)
					: oldValue) as T extends UnknownArray
					? ArrayToRecord<T>
					: T,
				(isArrayLike
					? arrayToRecord(newValue)
					: newValue) as T extends UnknownArray
					? ArrayToRecord<T>
					: T,
			),
			initialRun,
		)

	// Initialize data
	reconcile(
		isArrayLike ? ([] as unknown as T) : ({} as T),
		initialValue,
		true,
	)

	// Methods and Properties
	const prototype: Record<PropertyKey, unknown> = {}
	Object.defineProperties(prototype, {
		[Symbol.toStringTag]: {
			value: TYPE_STORE,
		},
		[Symbol.isConcatSpreadable]: {
			value: isArrayLike,
		},
		[Symbol.iterator]: {
			value: function* () {
				for (const key of order) {
					const signal = signals.get(key)
					if (signal) yield isArrayLike ? signal : [key, signal]
				}
			},
		},
		add: {
			value: isArrayLike
				? (value: ArrayItem<T>): string => {
						const key = generateKey(value as ArrayItem<T>)
						if (!signals.has(key)) {
							addProperty(key, value, true)
							return key
						} else throw new DuplicateKeyError('store', key, value)
					}
				: <K extends Extract<keyof T, string>>(
						key: K,
						value: T[K],
					): K => {
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
			value: <U extends UnknownArray>(
				mapFn: ComputedCallback<ArrayItem<U>>,
			): Collection<U> => {
				if (!isArrayLike)
					throw new ForbiddenMethodCallError(
						'deriveCollection',
						'store',
						'it is only supported for array-like stores',
					)

				const collection = createCollection(
					store as T extends UnknownArray ? ArrayStore<T> : never,
					mapFn,
				)
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
			value: (): T => {
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
			value: (newValue: T): void => {
				if (reconcile(current(), newValue)) {
					notify(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (oldValue: T) => T): void => {
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
				...items: ArrayItem<T>[]
			): ArrayItem<T>[] => {
				if (!isArrayLike)
					throw new ForbiddenMethodCallError(
						'splice',
						'store',
						'it is only supported for array-like stores',
					)

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

				const add = {} as PartialRecord<T>
				const remove = {} as PartialRecord<T>

				// Collect items to delete and their keys
				for (let i = 0; i < actualDeleteCount; i++) {
					const index = actualStart + i
					const key = order[index]
					if (key) {
						const signal = signals.get(key)
						if (signal) remove[key] = signal.get()
					}
				}

				// Build new order: items before splice point
				const newOrder = order.slice(0, actualStart)

				// Add new items
				for (const item of items) {
					const key = generateKey(item)
					newOrder.push(key)
					add[key] = item
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
						change: {} as PartialRecord<T>,
						remove,
						changed,
					})

				notify(watchers)

				return Object.values(remove) as ArrayItem<T>[]
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
	const store = new Proxy(prototype as Store<T>, {
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
	return store
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
	type ArrayItem,
	type ArrayStore,
	type Store,
	type KeyConfig,
}
