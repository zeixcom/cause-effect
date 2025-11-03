import { computed } from './computed'
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
		[Symbol.iterator](): IterableIterator<
			[string, Signal<T[keyof T & string]>]
		>

		// Signal methods
		get(): T
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
	const version = state(0)
	const current = computed(() => {
		version.get()
		const record: Partial<T> = {}
		for (const [key, value] of signals) {
			record[key] = value.get()
		}
		return record as T
	})
	const size = state(0)

	const emit = (type: keyof StoreEventMap<T>, detail: Partial<T>) =>
		eventTarget.dispatchEvent(new CustomEvent(type, { detail }))

	const addSignalAndEffect = <K extends keyof T & string>(
		key: K,
		value: T[K],
	) => {
		const signal = toMutableSignal<T[keyof T & string]>(value)
		signals.set(key, signal)
		const cleanup = effect(() => {
			const value = signal.get()
			if (value)
				emit('store-change', { [key]: value } as unknown as Partial<T>)
		})
		cleanups.set(key, cleanup)
	}

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
					const signal = signals.get(key as keyof T & string)
					const value = changes.change[key]
					if (
						signal &&
						value != null &&
						hasMethod<Signal<T[keyof T & string]>>(signal, 'set')
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

			if (changes.changed) version.update(v => ++v)
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
		'get',
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
			const key = String(prop)

			// Handle symbol properties
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.iterator) {
				return function* () {
					for (const [key, signal] of signals) {
						yield [key, signal as Signal<T[keyof T]>]
					}
				}
			}

			// Handle signal methods
			if (prop === 'get') {
				return (): T => {
					subscribe(watchers)
					return current.get()
				}
			}
			if (prop === 'set') {
				return (v: T): void => {
					if (reconcile(current.get(), v)) {
						notify(watchers)
						if (UNSET === v) watchers.clear()
					}
				}
			}
			if (prop === 'update') {
				return (fn: (v: T) => T): void => {
					const oldValue = current.get()
					const newValue = fn(oldValue)
					if (reconcile(oldValue, newValue)) {
						notify(watchers)
						if (UNSET === newValue) watchers.clear()
					}
				}
			}

			// Handle EventTarget methods
			if (prop === 'addEventListener') {
				return eventTarget.addEventListener.bind(eventTarget)
			}
			if (prop === 'removeEventListener') {
				return eventTarget.removeEventListener.bind(eventTarget)
			}
			if (prop === 'dispatchEvent') {
				return eventTarget.dispatchEvent.bind(eventTarget)
			}

			// Handle size property
			if (prop === 'size') return size

			// Handle data properties - return signals
			return signals.get(key)
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
