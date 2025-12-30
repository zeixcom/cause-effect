import { type DiffResult, diff, type UnknownRecord } from '../diff'
import {
	DuplicateKeyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
} from '../errors'
import { isMutableSignal, type Signal } from '../signal'
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
} from '../system'
import { isFunction, isObjectOfType, isRecord, isSymbol, UNSET } from '../util'
import { isComputed } from './computed'
import type { List } from './list'
import { createState, isState, type State } from './state'

/* === Types === */

type StoreKeySignal<T extends {}> = T extends readonly (infer U extends {})[]
	? List<U>
	: T extends UnknownRecord
		? Store<T>
		: State<T>

type Store<T extends UnknownRecord> = {
	[K in keyof T]: T[K] extends readonly (infer U extends {})[]
		? List<U>
		: T extends Record<string, unknown>
			? Store<T[K]>
			: State<T[K]>
} & {
	readonly [Symbol.toStringTag]: 'Store'
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
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
const createStore = <T extends UnknownRecord>(initialValue: T): Store<T> => {
	if (initialValue == null) throw new NullishSignalValueError('store')

	const watchers = new Set<Watcher>()
	const listeners: Omit<Listeners, 'sort'> = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
	}
	const signals = new Map<string, Signal<T[Extract<keyof T, string>] & {}>>()
	const ownWatchers = new Map<string, Watcher>()

	// Get current record
	const current = (): T => {
		const record = {} as Record<string, unknown>
		for (const [key, signal] of signals) record[key] = signal.get()
		return record as T
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

	// Add own watcher for nested signal
	const addOwnWatcher = <K extends keyof T & string>(
		key: K,
		signal: Signal<T[K] & {}>,
	) => {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				signal.get() // Subscribe to the signal
				emitNotification(listeners.change, [key])
			})
		})
		ownWatchers.set(key, watcher)
	}

	// Add nested signal and effect
	const addProperty = <K extends keyof T & string>(
		key: K,
		value: T[K] & {},
		single = false,
	): boolean => {
		if (!isValidValue(key, value)) return false

		// Create signal for key
		const signal: Signal<T[K] & {}> =
			isState(value) || isStore(value)
				? (value as unknown as Signal<T[K] & {}>)
				: isRecord(value) || Array.isArray(value)
					? createStore(value)
					: createState(value)

		// Set internal states
		// @ts-expect-error non-matching signal types
		signals.set(key, signal)
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
		const watcher = ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			ownWatchers.delete(key)
		}

		if (single) {
			notifyWatchers(watchers)
			emitNotification(listeners.remove, [key])
		}
	}

	// Commit batched changes and emit notifications
	const batchChanges = (changes: DiffResult, initialRun?: boolean) => {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				addProperty(
					key,
					changes.add[key] as T[Extract<keyof T, string>],
					false,
				)

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
					const value = changes.change[key] as T[Extract<
						keyof T,
						string
					>]
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
			emitNotification(listeners.remove, Object.keys(changes.remove))
		}

		return changes.changed
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean => batchChanges(diff(oldValue, newValue), initialRun)

	// Initialize data
	reconcile({} as T, initialValue, true)

	// Methods and Properties
	const prototype: Record<PropertyKey, unknown> = {}
	Object.defineProperties(prototype, {
		[Symbol.toStringTag]: {
			value: TYPE_STORE,
		},
		[Symbol.iterator]: {
			value: function* () {
				for (const [key, signal] of signals) yield [key, signal]
			},
		},
		add: {
			value: <K extends Extract<keyof T, string>>(
				key: K,
				value: T[K],
			): K => {
				if (signals.has(key))
					throw new DuplicateKeyError('store', key, value)

				addProperty(key, value, true)
				return key
			},
		},
		byKey: {
			value: (key: string) => {
				return signals.get(key)
			},
		},
		get: {
			value: (): T => {
				subscribeActiveWatcher(watchers)
				return current()
			},
		},
		remove: {
			value: (key: string): void => {
				if (signals.has(key)) removeProperty(key, true)
			},
		},
		set: {
			value: (newValue: T): void => {
				if (reconcile(current(), newValue)) {
					notifyWatchers(watchers)
					if (UNSET === newValue) watchers.clear()
				}
			},
		},
		update: {
			value: (fn: (oldValue: T) => T): void => {
				store.set(fn(current()))
			},
		},
		on: {
			value: <K extends keyof Omit<Listeners, 'sort'>>(
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
	const store = new Proxy(prototype as Store<T>, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (!isSymbol(prop)) return signals.get(prop)
		},
		has(target, prop) {
			if (prop in target) return true
			return signals.has(String(prop))
		},
		ownKeys(target) {
			const staticKeys = Reflect.ownKeys(target)
			return [...new Set([...signals.keys(), ...staticKeys])]
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)
			if (isSymbol(prop)) return undefined

			const signal = signals.get(prop)
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
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
const isStore = <T extends UnknownRecord>(value: unknown): value is Store<T> =>
	isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export { TYPE_STORE, isStore, createStore, type Store }
