import { diff, type UnknownRecord } from './diff'
import { effect } from './effect'
import {
	batch,
	type Cleanup,
	notify,
	subscribe,
	type Watcher,
} from './scheduler'
import { type Signal, toMutableSignal, UNSET } from './signal'
import { type State, state } from './state'
import { hasMethod, isObjectOfType } from './util'

/* === Constants === */

const TYPE_STORE = 'Store'

/* === Types === */

interface StoreAddEvent<T extends UnknownRecord> extends CustomEvent {
	type: 'store-add'
	detail: Partial<T>
}

interface StoreChangeEvent<T extends UnknownRecord> extends CustomEvent {
	type: 'store-change'
	detail: Partial<T>
}

interface StoreRemoveEvent<T extends UnknownRecord> extends CustomEvent {
	type: 'store-remove'
	detail: Partial<T>
}

type StoreEventMap<T extends UnknownRecord> = {
	'store-add': StoreAddEvent<T>
	'store-change': StoreChangeEvent<T>
	'store-remove': StoreRemoveEvent<T>
}

interface StoreEventTarget<T extends UnknownRecord> extends EventTarget {
	addEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void

	removeEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | EventListenerOptions,
	): void
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void

	dispatchEvent(event: Event): boolean
}

type Store<T extends UnknownRecord = UnknownRecord> = {
	[K in keyof T & string]: T[K] extends UnknownRecord
		? Store<T[K]>
		: State<T[K]>
} & StoreEventTarget<T> & {
		[Symbol.toStringTag]: 'Store'
		[Symbol.iterator](): IterableIterator<[keyof T, Signal<T[keyof T]>]>

		// Signal methods
		add<K extends keyof T>(key: K, value: T[K]): void
		get(): T
		remove<K extends keyof T>(key: K): void
		set(value: T): void
		update(updater: (value: T) => T): void

		// Interals signals
		size: State<number>
	}

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object value of the store
 * @returns {Store<T>} - new store with reactive properties
 */
const store = <T extends UnknownRecord>(initialValue: T): Store<T> => {
	const watchers: Set<Watcher> = new Set()
	const eventTarget = new EventTarget()
	const signals: Map<
		keyof T & string,
		Store<T[keyof T & string]> | State<T[keyof T & string]>
	> = new Map()
	const cleanups = new Map<keyof T & string, Cleanup>()

	// Internal state
	const size = state(0)

	// Get current record
	const current = () => {
		const record: Partial<T> = {}
		for (const [key, value] of signals) {
			record[key] = value.get()
		}
		return record as T
	}

	// Emit event
	const emit = (type: keyof StoreEventMap<T>, detail: Partial<T>) =>
		eventTarget.dispatchEvent(new CustomEvent(type, { detail }))

	// Add nested signal and effect
	const addSignalAndEffect = <K extends keyof T & string>(
		key: K,
		value: T[K],
	) => {
		const signal = toMutableSignal(value)
		signals.set(
			key,
			signal as Store<T[keyof T & string]> | State<T[keyof T & string]>,
		)
		const cleanup = effect(() => {
			const value = signal.get()
			if (value != null)
				emit('store-change', { [key]: value } as unknown as Partial<T>)
		})
		cleanups.set(key, cleanup)
	}

	// Remove nested signal and effect
	const removeSignalAndEffect = <K extends keyof T & string>(key: K) => {
		signals.delete(key)
		const cleanup = cleanups.get(key)
		if (cleanup) cleanup()
		cleanups.delete(key)
	}

	// Reconcile data and dispatch events
	const reconcile = (oldValue: T, newValue: T): boolean => {
		const changes = diff(oldValue, newValue)

		batch(() => {
			if (Object.keys(changes.add).length) {
				for (const key in changes.add) {
					const value = changes.add[key]
					if (value != null) addSignalAndEffect(key, value)
				}
				emit('store-add', changes.add)
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
				emit('store-change', changes.change)
			}
			if (Object.keys(changes.remove).length) {
				for (const key in changes.remove) {
					removeSignalAndEffect(key)
				}
				emit('store-remove', changes.remove)
			}

			size.set(signals.size)
		})

		return changes.changed
	}

	// Initialize data
	reconcile({} as T, initialValue)

	// Queue initial additions event to allow listeners to be added first
	setTimeout(() => {
		const initialAdditionsEvent = new CustomEvent('store-add', {
			detail: initialValue as Partial<T>,
		}) as StoreAddEvent<T>
		eventTarget.dispatchEvent(initialAdditionsEvent)
	}, 0)

	const storeProps = [
		'add',
		'get',
		'remove',
		'set',
		'update',
		'addEventListener',
		'removeEventListener',
		'dispatchEvent',
		'size',
	]

	// Return proxy directly with integrated signal methods
	return new Proxy({} as Store<T>, {
		get(_target, prop) {
			// Handle signal methods and size property
			switch (prop) {
				case 'add':
					return <K extends keyof T & string>(
						k: K,
						v: T[K],
					): void => {
						if (!signals.has(k)) {
							addSignalAndEffect(k, v)
							notify(watchers)
							emit('store-add', {
								[k]: v,
							} as unknown as Partial<T>)
							size.set(signals.size)
						}
					}
				case 'get':
					return (): T => {
						subscribe(watchers)
						return current()
					}
				case 'remove':
					return <K extends keyof T & string>(k: K): void => {
						if (signals.has(k)) {
							removeSignalAndEffect(k)
							notify(watchers)
							emit('store-remove', { [k]: UNSET } as Partial<T>)
							size.set(signals.size)
						}
					}
				case 'set':
					return (v: T): void => {
						if (reconcile(current(), v)) {
							notify(watchers)
							if (UNSET === v) watchers.clear()
						}
					}
				case 'update':
					return (fn: (v: T) => T): void => {
						const oldValue = current()
						const newValue = fn(oldValue)
						if (reconcile(oldValue, newValue)) {
							notify(watchers)
							if (UNSET === newValue) watchers.clear()
						}
					}
				case 'addEventListener':
					return eventTarget.addEventListener.bind(eventTarget)
				case 'removeEventListener':
					return eventTarget.removeEventListener.bind(eventTarget)
				case 'dispatchEvent':
					return eventTarget.dispatchEvent.bind(eventTarget)
				case 'size':
					return size
			}

			// Handle symbol properties
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.iterator) {
				return function* () {
					for (const [key, signal] of signals) {
						yield [key, signal as Signal<T[keyof T]>]
					}
				}
			}

			// Handle data properties - return signals
			return signals.get(String(prop))
		},
		has(_target, prop) {
			const key = String(prop)
			return (
				signals.has(key) ||
				storeProps.includes(key) ||
				prop === Symbol.toStringTag ||
				prop === Symbol.iterator
			)
		},
		ownKeys() {
			return Array.from(signals.keys())
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
const isStore = <T extends UnknownRecord>(value: unknown): value is Store<T> =>
	isObjectOfType(value, TYPE_STORE)

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
