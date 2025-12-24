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
	isObjectOfType,
	isRecord,
	isString,
	isSymbol,
	recordToArray,
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
	keyAt(index: number): undefined
	indexByKey(key: string): undefined
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
	indexByKey(key: string): number | undefined
	set(value: T): void
	update(fn: (value: T) => T): void
	sort<U = ArrayItem<T>>(compareFn?: (a: U, b: U) => number): void
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
	const keyAt = new Map<number, string>() // Maps positional index to stable key
	const indexByKey = new Map<string, number>() // Maps stable key to positional index

	// Get signal by key or index (for array-like stores only)
	const getSignal = (
		prop: string,
	): Signal<T[Extract<keyof T, string>] & {}> | undefined => {
		let key = prop
		if (isArrayLike) {
			const index = Number(prop)
			if (Number.isInteger(index) && index >= 0)
				key = keyAt.get(index) ?? prop
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
	const arrayToRecord = (array: T): Record<string, unknown> => {
		if (!isArrayLike) return array as Record<string, unknown>

		const record: Record<string, unknown> = {}
		const arrayValue = array as unknown[]

		for (let i = 0; i < arrayValue.length; i++) {
			const value = arrayValue[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = keyAt.get(i)
			if (!key) {
				// Generate new stable key for this position
				key = generateKey(value as ArrayItem<T>)
				keyAt.set(i, key)
				indexByKey.set(key, i)
			}
			record[key] = value
		}
		return record
	}

	// Get current record
	const current = () => {
		const record: Record<string, unknown> = {}
		for (const [key, signal] of signals) record[key] = signal.get()
		return record
	}

	// Emit change notifications
	const emit = <K extends keyof StoreChanges<T>>(
		key: K,
		changes: StoreChanges<T>[K],
	) => {
		Object.freeze(changes)
		for (const listener of listeners[key]) listener(changes)
	}

	// Get sorted indexes
	const getSortedIndexes = () =>
		Array.from(keyAt.keys()).sort((a, b) => a - b)

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
		// For array-like stores, clean up mappings
		if (isArrayLike) {
			const index = indexByKey.get(key)
			if (index !== undefined) {
				indexByKey.delete(key)
				keyAt.delete(index)
			}
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
		return ok
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
						const indexes = getSortedIndexes()
						for (const index of indexes) {
							const key = keyAt.get(index)
							if (key) yield signals.get(key)
						}
					}
				: function* () {
						for (const [key, signal] of signals) yield [key, signal]
					},
		},
		add: {
			value: isArrayLike
				? (v: ArrayItem<T>): void => {
						const index = keyAt.size
						const key = generateKey(v as ArrayItem<T>)
						keyAt.set(index, key)
						indexByKey.set(key, index)
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
				if (!isArrayLike) return undefined
				return keyAt.get(index)
			},
		},
		indexByKey: {
			value(key: string): number | undefined {
				if (!isArrayLike) return undefined
				return indexByKey.get(key)
			},
		},
		get: {
			value: (): T => {
				subscribe(watchers)
				if (isArrayLike) {
					// For array-like stores, reconstruct array using positional mappings
					const array: unknown[] = []
					for (const [index, key] of keyAt.entries()) {
						const signal = signals.get(key)
						if (signal) array[index] = signal.get()
					}
					return array as unknown as T
				} else {
					return current() as T
				}
			},
		},
		remove: {
			value: isArrayLike
				? (index: number): void => {
						if (index < 0 || index >= signals.size)
							throw new StoreKeyRangeError(index)

						// Find the stable key at this position
						const key = keyAt.get(index)
						if (!key) return

						// Remove the signal and mappings
						removeProperty(key, false)

						// Compact the remaining positional mappings
						const newKeyAt = new Map<number, string>()
						const newIndexByKey = new Map<string, number>()
						let newPos = 0
						for (const [pos, k] of keyAt.entries()) {
							if (pos !== index) {
								newKeyAt.set(newPos, k)
								newIndexByKey.set(k, newPos)
								newPos++
							}
						}

						// Update the mappings
						keyAt.clear()
						indexByKey.clear()
						newKeyAt.forEach((k, pos) => {
							keyAt.set(pos, k)
							indexByKey.set(k, pos)
						})

						// Notify watchers and emit remove event
						notify(watchers)
						emit('remove', {
							[key]: UNSET,
						} as PartialRecord<T>)
					}
				: (k: string): void => {
						if (signals.has(k)) removeProperty(k, true)
					},
		},
		set: {
			value: (v: T): void => {
				const currentValue = isArrayLike
					? recordToArray(current())
					: current()
				if (reconcile(currentValue as T, v)) {
					notify(watchers)
					if (UNSET === v) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (v: T) => T): void => {
				const oldValue = current()
				const newValue = fn(recordToArray(oldValue) as T)
				if (reconcile(oldValue as T, newValue)) {
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
				if (isArrayLike) {
					// For array-like stores with stable keys, sort by updating positional mappings
					const entries = Array.from(keyAt.entries())
						.map(([index, key]) => {
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
										String(a[2]).localeCompare(
											String(b[2]),
										),
						)

					// Create new positional mappings
					const newKeyAt = new Map<number, string>()
					const newIndexByKey = new Map<string, number>()

					entries.forEach(
						([_oldIndex, stableKey, _value], newIndex) => {
							newKeyAt.set(newIndex, stableKey)
							newIndexByKey.set(stableKey, newIndex)
						},
					)

					// Update mappings
					keyAt.clear()
					indexByKey.clear()
					newKeyAt.forEach((key, index) => {
						keyAt.set(index, key)
						indexByKey.set(key, index)
					})

					const newOrder: string[] = entries.map(([oldIndex]) =>
						String(oldIndex),
					)
					notify(watchers)
					emit('sort', newOrder)
				} else {
					// For record stores, sort by value
					const entries = Array.from(signals.entries())
						.map(([key, signal]) => [key, signal.get()])
						.sort(
							compareFn
								? (a, b) => compareFn(a[1], b[1])
								: (a, b) =>
										String(a[1]).localeCompare(
											String(b[1]),
										),
						)

					// Create new signals map in sorted order
					const newSignals = new Map<
						string,
						Signal<T[Extract<keyof T, string>] & {}>
					>()
					entries.forEach(([key]) => {
						const keyStr = String(key)
						const signal = signals.get(keyStr)
						if (signal) newSignals.set(keyStr, signal)
					})

					// Replace signals map
					signals.clear()
					newSignals.forEach((signal, key) =>
						signals.set(key, signal),
					)

					const newOrder: string[] = entries.map(([key]) =>
						String(key),
					)
					notify(watchers)
					emit('sort', newOrder)
				}
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
			const signalKeys = isArrayLike
				? getSortedIndexes().map(key => String(key))
				: Array.from(signals.keys())
			return [...new Set([...signalKeys, ...staticKeys])]
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
