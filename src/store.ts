import { computed } from './computed'
// import { effect } from './effect'
import { batch, notify, subscribe, type Watcher } from './scheduler'
import { type Signal, toMutableSignal, UNSET } from './signal'
import { isState, type State, state } from './state'
import { hasMethod, isObjectOfType, isPrimitive, isRecord } from './util'

/* === Constants === */

const TYPE_STORE = 'Store'

/* === Types === */

interface StoreAddEvent<T extends Record<string, unknown & {}>>
	extends CustomEvent {
	type: 'store-add'
	detail: Partial<T>
}

interface StoreChangeEvent<T extends Record<string, unknown & {}>>
	extends CustomEvent {
	type: 'store-change'
	detail: Partial<T>
}

interface StoreRemoveEvent<T extends Record<string, unknown & {}>>
	extends CustomEvent {
	type: 'store-remove'
	detail: Partial<T>
}

type StoreEventMap<T extends Record<string, unknown & {}>> = {
	'store-add': StoreAddEvent<T>
	'store-change': StoreChangeEvent<T>
	'store-remove': StoreRemoveEvent<T>
}

interface StoreEventTarget<T extends Record<string, unknown & {}>>
	extends EventTarget {
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

type Store<
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
> = {
	[K in keyof T]: T[K] extends Record<string, unknown & {}>
		? Store<T[K]>
		: State<T[K]>
} & StoreEventTarget<T> & {
		[Symbol.toStringTag]: 'Store'
		[Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T]>]>

		// Signal methods
		get(): T
		set(value: T): void
		update(updater: (value: T) => T): void

		// Interals signals
		size: State<number>
	}

type StoreChanges = {
	add: Partial<Record<string, unknown & {}>>
	change: Partial<Record<string, unknown & {}>>
	remove: Partial<Record<string, unknown & {}>>
}

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object value of the store
 * @returns {Store<T>} - new store with reactive properties
 */
const store = <T extends Record<string, unknown & {}>>(
	initialValue: T,
): Store<T> => {
	const watchers: Set<Watcher> = new Set()
	const eventTarget = new EventTarget()
	const data: Map<string, Signal<unknown & {}>> = new Map()
	const version = state(0)
	const current = computed(() => {
		version.get()
		const record: Record<string, unknown & {}> = {}
		for (const [key, value] of data) {
			record[key] = value.get()
		}
		return record as T
	})
	const size = state(0)

	const emit = (type: keyof StoreEventMap<T>, detail: Partial<T>) =>
		eventTarget.dispatchEvent(new CustomEvent(type, { detail }))

	/* let oldRecord = initialValue
	effect(() => {
		const newRecord = current.get()
		if (reconcile(oldRecord, newRecord)) oldRecord = newRecord
	}) */

	// Create a wrapped signal that dispatches mutation events
	/* const createWrappedSignal = (key: string, value: unknown & {}) => {
		const signal = toMutableSignal(value)
		if (isState(signal)) {
			const stateSignal = signal as State<unknown & {}>
			const originalSet = stateSignal.set.bind(stateSignal)
			stateSignal.set = (newValue: unknown & {}) => {
				const oldValue = stateSignal.get()
				originalSet(newValue)
				if (!Object.is(oldValue, newValue)) {
					const event = new CustomEvent('store-change', {
						detail: { [key]: newValue } as Partial<T>,
					})
					eventTarget.dispatchEvent(event)
				}
			}
		}
		return signal
	} */

	// Reconcile data and dispatch events
	const reconcile = (oldValue: Partial<T>, newValue: T): boolean => {
		console.log('Reconciling data...', version.get())
		const oldKeys = new Set(Object.keys(oldValue))
		const newKeys = new Set(Object.keys(newValue))
		const allKeys = new Set([...oldKeys, ...newKeys])
		const changes: StoreChanges = {
			add: {},
			change: {},
			remove: {},
		}

		for (const key of allKeys) {
			const oldHas = oldKeys.has(key)
			const newHas = newKeys.has(key)
			const value = newValue[key]

			if (oldHas && !newHas) {
				data.delete(key)
				changes.remove[key] = UNSET
			} else if (!oldHas && newHas) {
				const signal = toMutableSignal(value)
				data.set(key, signal)
				changes.add[key] = value
			} else if (oldHas && newHas) {
				const signal = data.get(key)
				if (
					(isState(signal) && isPrimitive(value)) ||
					(isStore(signal) &&
						(isRecord(value) || Array.isArray(value)))
				) {
					signal.set(value)
				} else {
					if (signal && hasMethod(signal, 'set')) signal.set(UNSET)
					data.set(key, toMutableSignal(value))
				}

				changes.change[key] = value
			}
		}

		const hasAdditions = Object.keys(changes.add).length > 0
		const hasMutations = Object.keys(changes.change).length > 0
		const hasRemovals = Object.keys(changes.remove).length > 0
		const changed = hasAdditions || hasMutations || hasRemovals
		batch(() => {
			if (changed) version.update(v => ++v)
			size.set(data.size)
		})

		// Dispatch events for changes
		if (hasAdditions) emit('store-add', changes.add as Partial<T>)
		if (hasMutations) emit('store-change', changes.change as Partial<T>)
		if (hasRemovals) emit('store-remove', changes.remove as Partial<T>)

		return changed
	}

	// Initialize data
	reconcile({}, initialValue)

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
					for (const [key, signal] of data) {
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
			return data.get(key)
		},
		has(_target, prop) {
			const key = String(prop)
			return (
				data.has(key) ||
				storeProps.includes(key) ||
				prop === Symbol.toStringTag ||
				prop === Symbol.iterator
			)
		},
		ownKeys() {
			return Array.from(data.keys())
		},
		getOwnPropertyDescriptor(_target, prop) {
			const signal = data.get(String(prop))
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
const isStore = <T extends Record<string, unknown & {}>>(
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
