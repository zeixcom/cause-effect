import { diff, type UnknownRecord, type UnknownRecordOrArray } from './diff'
import { effect } from './effect'
import {
	batch,
	type Cleanup,
	notify,
	subscribe,
	type Watcher,
} from './scheduler'
import { type Signal, toMutableSignal } from './signal'
import { type State, state } from './state'
import {
	hasMethod,
	isObjectOfType,
	isString,
	recordToArray,
	UNSET,
	validArrayIndexes,
} from './util'

/* === Types === */

interface StoreAddEvent<T extends UnknownRecordOrArray> extends CustomEvent {
	type: 'store-add'
	detail: Partial<T>
}

interface StoreChangeEvent<T extends UnknownRecordOrArray> extends CustomEvent {
	type: 'store-change'
	detail: Partial<T>
}

interface StoreRemoveEvent<T extends UnknownRecordOrArray> extends CustomEvent {
	type: 'store-remove'
	detail: Partial<T>
}

type StoreEventMap<T extends UnknownRecordOrArray> = {
	'store-add': StoreAddEvent<T>
	'store-change': StoreChangeEvent<T>
	'store-remove': StoreRemoveEvent<T>
}

interface StoreEventTarget<T extends UnknownRecordOrArray> extends EventTarget {
	addEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void

	removeEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | EventListenerOptions,
	): void

	dispatchEvent(event: Event): boolean
}

type Store<T extends UnknownRecordOrArray = UnknownRecord> = {
	[K in keyof T]: T[K] extends UnknownRecord ? Store<T[K]> : State<T[K]>
} & StoreEventTarget<T> & {
		[Symbol.toStringTag]: 'Store'
		[Symbol.iterator](): IterableIterator<[keyof T, Signal<T[keyof T]>]>

		add<K extends keyof T>(key: K, value: T[K]): void
		get(): T
		remove<K extends keyof T>(key: K): void
		set(value: T): void
		update(updater: (value: T) => T): void
		size: State<number>
	}

/* === Constants === */

const TYPE_STORE = 'Store'

const STORE_EVENT_ADD = 'store-add'
const STORE_EVENT_CHANGE = 'store-change'
const STORE_EVENT_REMOVE = 'store-remove'

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
const store = <T extends UnknownRecordOrArray>(initialValue: T): Store<T> => {
	const watchers: Set<Watcher> = new Set()
	const eventTarget = new EventTarget()
	const signals: Map<keyof T, Store<T[keyof T]> | State<T[keyof T]>> =
		new Map()
	const cleanups = new Map<keyof T, Cleanup>()

	// Internal state
	const size = state(0)

	// Get current record
	const current = () => {
		const record: Record<string, unknown> = {}
		for (const [key, signal] of signals) {
			record[String(key)] = signal.get()
		}
		return record
	}

	// Emit event
	const emit = (type: keyof StoreEventMap<T>, detail: Partial<T>) =>
		eventTarget.dispatchEvent(new CustomEvent(type, { detail }))

	// Add nested signal and effect
	const addProperty = <K extends keyof T>(key: K, value: T[K]) => {
		const stringKey = String(key)
		const signal = toMutableSignal(value)
		signals.set(stringKey, signal as Store<T[keyof T]> | State<T[keyof T]>)
		const cleanup = effect(() => {
			const currentValue = signal.get()
			if (currentValue != null)
				emit(STORE_EVENT_CHANGE, { [key]: currentValue } as Partial<T>)
		})
		cleanups.set(stringKey, cleanup)
	}

	// Remove nested signal and effect
	const removeProperty = <K extends keyof T>(key: K) => {
		const stringKey = String(key)
		signals.delete(stringKey)
		const cleanup = cleanups.get(stringKey)
		if (cleanup) cleanup()
		cleanups.delete(stringKey)
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean => {
		const changes = diff(oldValue, newValue)

		batch(() => {
			if (Object.keys(changes.add).length) {
				for (const key in changes.add) {
					const value = changes.add[key]
					if (value != null) addProperty(key, value as T[keyof T])
				}

				// Queue initial additions event to allow listeners to be added first
				if (initialRun) {
					setTimeout(() => {
						emit(STORE_EVENT_ADD, changes.add)
					}, 0)
				} else {
					emit(STORE_EVENT_ADD, changes.add)
				}
			}
			if (Object.keys(changes.change).length) {
				for (const key in changes.change) {
					const signal = signals.get(key)
					const value = changes.change[key]
					if (
						signal &&
						value != null &&
						hasMethod<Signal<T[keyof T]>>(signal, 'set')
					)
						signal.set(value)
				}
				emit(STORE_EVENT_CHANGE, changes.change)
			}
			if (Object.keys(changes.remove).length) {
				for (const key in changes.remove) {
					removeProperty(key)
				}
				emit(STORE_EVENT_REMOVE, changes.remove)
			}

			size.set(signals.size)
		})

		return changes.changed
	}

	// Initialize data
	reconcile({} as T, initialValue, true)

	// Methods and Properties
	const s: Record<string, unknown> = {
		add: <K extends keyof T>(k: K, v: T[K]): void => {
			const indexes = validArrayIndexes(Array.from(signals.keys()))
			const key = indexes
				? indexes.length
					? Math.max(...indexes) + 1
					: 0
				: k
			if (!signals.has(String(key))) {
				addProperty(key, v)
				notify(watchers)
				emit(STORE_EVENT_ADD, {
					[key]: v,
				} as unknown as Partial<T>)
				size.set(signals.size)
			}
		},
		get: (): T => {
			subscribe(watchers)
			return recordToArray(current()) as T
		},
		remove: <K extends keyof T>(k: K): void => {
			if (signals.has(String(k))) {
				removeProperty(k)
				notify(watchers)
				emit(STORE_EVENT_REMOVE, {
					[k]: UNSET,
				} as Partial<T>)
				size.set(signals.size)
			}
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
		addEventListener: eventTarget.addEventListener.bind(eventTarget),
		removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
		dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
		size,
	}

	// Return proxy directly with integrated signal methods
	return new Proxy({} as Store<T>, {
		get(_target, prop) {
			if (isString(prop) && prop in s) return s[prop]

			// Symbols
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.iterator)
				return function* () {
					for (const [key, signal] of signals) {
						yield [key, signal]
					}
				}

			// Handle data properties - return signals
			return signals.get(String(prop))
		},
		has(_target, prop) {
			const key = String(prop)
			return (
				signals.has(key) ||
				Object.keys(s).includes(key) ||
				prop === Symbol.toStringTag ||
				prop === Symbol.iterator
			)
		},
		ownKeys() {
			return Array.from(signals.keys()).map(key => String(key))
		},
		getOwnPropertyDescriptor(_target, prop) {
			const signal = signals.get(String(prop))
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

export {
	TYPE_STORE,
	isStore,
	store,
	type Store,
	type StoreAddEvent,
	type StoreChangeEvent,
	type StoreRemoveEvent,
	type StoreEventMap,
}
