import { isComputed } from './computed'
import {
	type ArrayToRecord,
	diff,
	type UnknownArray,
	type UnknownRecord,
	type UnknownRecordOrArray,
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
	isSymbol,
	recordToArray,
	UNSET,
	valueString,
} from './util'

/* === Types === */

type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never

type StoreChanges<T> = {
	add: Partial<T>
	change: Partial<T>
	remove: Partial<T>
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
		[
			Extract<keyof T, string>,
			T[Extract<keyof T, string>] extends
				| readonly unknown[]
				| Record<string, unknown>
				? Store<T[Extract<keyof T, string>]>
				: State<T[Extract<keyof T, string>]>,
		]
	>
	add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void
	get(): T
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
	[Symbol.iterator](): IterableIterator<
		ArrayItem<T> extends readonly unknown[] | Record<string, unknown>
			? Store<ArrayItem<T>>
			: State<ArrayItem<T>>
	>
	readonly [Symbol.isConcatSpreadable]: boolean
	[n: number]: ArrayItem<T> extends
		| readonly unknown[]
		| Record<string, unknown>
		? Store<ArrayItem<T>>
		: State<ArrayItem<T>>
	add(value: ArrayItem<T>): void
	get(): T
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
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
const createStore = <T extends UnknownRecord | UnknownArray>(
	initialValue: T,
): Store<T> => {
	if (initialValue == null) throw new NullishSignalValueError('store')

	const watchers = new Set<Watcher>()
	const listeners: StoreListeners<T> = {
		add: new Set<(change: Partial<T>) => void>(),
		change: new Set<(change: Partial<T>) => void>(),
		remove: new Set<(change: Partial<T>) => void>(),
		sort: new Set<(change: string[]) => void>(),
	}
	const signals = new Map<string, Signal<T[Extract<keyof T, string>] & {}>>()
	const signalWatchers = new Map<string, Watcher>()

	// Determine if this is an array-like store at creation time
	const isArrayLike = Array.isArray(initialValue)

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
		Array.from(signals.keys())
			.map(k => Number(k))
			.filter(n => Number.isInteger(n))
			.sort((a, b) => a - b)

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
	const addProperty = <K extends Extract<keyof T, string>>(
		key: K,
		value: T[K] | ArrayItem<T>,
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
				emit('change', {
					[key]: signal.get(),
				} as unknown as Partial<T>)
			}, watcher),
		)
		watcher()
		signalWatchers.set(key, watcher)

		if (single) {
			notify(watchers)
			emit('add', {
				[key]: value,
			} as unknown as Partial<T>)
		}
		return true
	}

	// Remove nested signal and effect
	const removeProperty = <K extends Extract<keyof T, string>>(
		key: K,
		single = false,
	) => {
		const ok = signals.delete(key)
		if (ok) {
			const watcher = signalWatchers.get(key)
			if (watcher) watcher.cleanup()
			signalWatchers.delete(key)
		}

		if (single) {
			notify(watchers)
			emit('remove', {
				[key]: UNSET,
			} as unknown as Partial<T>)
		}
		return ok
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean => {
		const changes = diff(
			oldValue as T extends UnknownArray ? ArrayToRecord<T> : T,
			newValue as T extends UnknownArray ? ArrayToRecord<T> : T,
		)

		batch(() => {
			// Additions
			if (Object.keys(changes.add).length) {
				for (const key in changes.add) {
					const value = changes.add[key] ?? UNSET
					addProperty(
						key as Extract<keyof T, string>,
						value as T[Extract<keyof T, string>] & {},
					)
				}

				// Queue initial additions event to allow listeners to be added first
				if (initialRun) {
					setTimeout(() => {
						emit('add', changes.add as Partial<T>)
					}, 0)
				} else {
					emit('add', changes.add as Partial<T>)
				}
			}

			// Changes
			if (Object.keys(changes.change).length) {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!isValidValue(key, value)) continue
					const signal = signals.get(key as Extract<keyof T, string>)
					if (isMutableSignal(signal))
						signal.set(value as T[Extract<keyof T, string>] & {})
					else
						throw new StoreKeyReadonlyError(key, valueString(value))
				}
				emit('change', changes.change as Partial<T>)
			}

			// Removals
			if (Object.keys(changes.remove).length) {
				for (const key in changes.remove)
					removeProperty(key as Extract<keyof T, string>)
				emit('remove', changes.remove as Partial<T>)
			}
		})

		return changes.changed
	}

	// Initialize data - convert arrays to records for internal storage
	reconcile({} as T, initialValue, true)

	// Methods and Properties
	const store: Record<string, unknown> = {
		add: isArrayLike
			? (v: ArrayItem<T>): void => {
					const nextIndex = signals.size
					const key = String(nextIndex) as Extract<keyof T, string>
					addProperty(key, v, true)
				}
			: <K extends Extract<keyof T, string>>(k: K, v: T[K]): void => {
					if (!signals.has(k)) addProperty(k, v, true)
					else throw new StoreKeyExistsError(k, valueString(v))
				},
		get: (): T => {
			subscribe(watchers)
			return recordToArray(current()) as T
		},
		remove: isArrayLike
			? (index: number): void => {
					const currentArray = recordToArray(current()) as T
					const currentLength = signals.size
					if (
						!Array.isArray(currentArray) ||
						index <= -currentLength ||
						index >= currentLength
					)
						throw new StoreKeyRangeError(index)
					const newArray = [...currentArray]
					newArray.splice(index, 1)

					if (reconcile(currentArray, newArray as unknown as T))
						notify(watchers)
				}
			: <K extends Extract<keyof T, string>>(k: K): void => {
					if (signals.has(k)) removeProperty(k, true)
				},
		set: (v: T): void => {
			if (reconcile(current() as T, v)) {
				notify(watchers)
				if (UNSET === v) watchers.clear()
			}
		},
		update: (fn: (v: T) => T): void => {
			const oldValue = current()
			const newValue = fn(recordToArray(oldValue) as T)
			if (reconcile(oldValue as T, newValue)) {
				notify(watchers)
				if (UNSET === newValue) watchers.clear()
			}
		},
		sort: (
			compareFn?: <
				U = T extends UnknownArray
					? ArrayItem<T>
					: T[Extract<keyof T, string>],
			>(
				a: U,
				b: U,
			) => number,
		): void => {
			// Get all entries as [key, value] pairs
			const entries = Array.from(signals.entries())
				.map(
					([key, signal]) =>
						[key, signal.get()] as [
							string,
							T[Extract<keyof T, string>],
						],
				)
				.sort(
					compareFn
						? (a, b) => compareFn(a[1], b[1])
						: (a, b) => String(a[1]).localeCompare(String(b[1])),
				)

			// Create array of original keys in their new sorted order
			const newOrder: string[] = entries.map(([key]) => String(key))
			const newSignals = new Map<
				string,
				Signal<T[Extract<keyof T, string>] & {}>
			>()

			entries.forEach(([key], newIndex) => {
				const oldKey = String(key)
				const newKey = isArrayLike ? String(newIndex) : String(key)

				const signal = signals.get(oldKey)
				if (signal) newSignals.set(newKey, signal)
			})

			// Replace signals map
			signals.clear()
			newSignals.forEach((signal, key) => signals.set(key, signal))
			notify(watchers)
			emit('sort', newOrder)
		},
		on: <K extends keyof StoreChanges<T>>(
			type: K,
			listener: (change: StoreChanges<T>[K]) => void,
		): Cleanup => {
			listeners[type].add(listener)
			return () => listeners[type].delete(listener)
		},
	}

	// Return proxy directly with integrated signal methods
	return new Proxy({} as Store<T>, {
		get(_target, prop) {
			// Symbols
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.isConcatSpreadable) return isArrayLike
			if (prop === Symbol.iterator)
				return isArrayLike
					? function* () {
							const indexes = getSortedIndexes()
							for (const index of indexes) {
								const signal = signals.get(
									String(index) as Extract<keyof T, string>,
								)
								if (signal) yield signal
							}
						}
					: function* () {
							for (const [key, signal] of signals)
								yield [key, signal]
						}
			if (isSymbol(prop)) return undefined

			// Methods and Properties
			if (prop in store) return store[prop]
			if (prop === 'length') {
				subscribe(watchers)
				return signals.size
			}

			// Signals
			return signals.get(prop as Extract<keyof T, string>)
		},
		has(_target, prop) {
			const stringProp = String(prop)
			return (
				(stringProp &&
					signals.has(stringProp as Extract<keyof T, string>)) ||
				Object.keys(store).includes(stringProp) ||
				prop === Symbol.toStringTag ||
				prop === Symbol.iterator ||
				prop === Symbol.isConcatSpreadable ||
				prop === 'length'
			)
		},
		ownKeys() {
			return isArrayLike
				? getSortedIndexes()
						.map(key => String(key))
						.concat(['length'])
				: Array.from(signals.keys())
						.map(key => String(key))
						.concat(['length'])
		},
		getOwnPropertyDescriptor(_target, prop) {
			const nonEnumerable = <T>(value: T) => ({
				enumerable: false,
				configurable: true,
				writable: false,
				value,
			})

			if (prop === 'length')
				return {
					enumerable: isArrayLike,
					configurable: true,
					get: () => {
						subscribe(watchers)
						return signals.size
					},
				}
			if (prop === Symbol.isConcatSpreadable)
				return nonEnumerable(isArrayLike)
			if (prop === Symbol.toStringTag) return nonEnumerable(TYPE_STORE)
			if (isSymbol(prop)) return undefined

			if (Object.keys(store).includes(prop))
				return nonEnumerable(store[prop])

			const signal = signals.get(prop as Extract<keyof T, string>)
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
const isStore = <T extends UnknownRecordOrArray>(
	value: unknown,
): value is Store<T> => isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export { TYPE_STORE, isStore, createStore, type Store, type StoreChanges }
