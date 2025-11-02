import { notify, subscribe, watch, type Watcher } from './scheduler'
import { type Signal, toMutableSignal, UNSET } from './signal'
import { isState, type State, state } from './state'
import { hasMethod, isObjectOfType, isPrimitive } from './util'

/* === Constants === */

const TYPE_STORE = 'Store'

/* === Types === */

type Store<
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
> = {
	[K in keyof T]: T[K] extends Record<string, unknown & {}>
		? Store<T[K]>
		: State<T[K]>
} & {
	[Symbol.toStringTag]: 'Store'
	[Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T]>]>

	// Signal methods
	get(): T
	set(value: T): void
	update(updater: (value: T) => T): void

	// Change tracking signals
	additions: Signal<Partial<T>>
	removals: Signal<Partial<T>>
	mutations: Signal<Partial<T>>
	size: State<number>
}

type StoreChanges = {
	additions: Partial<Record<string, unknown & {}>>
	removals: Partial<Record<string, unknown & {}>>
	mutations: Partial<Record<string, unknown & {}>>
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
	const data = new Map<string, Signal<unknown & {}>>()

	const tracker = (watcher?: Watcher) => {
		const trackWatchers: Set<Watcher> = new Set()
		if (watcher) trackWatchers.add(watcher)
		let trackRecord: Partial<T> = {}

		return {
			get: (): Partial<T> => {
				subscribe(trackWatchers)
				const value = { ...trackRecord }
				trackRecord = {}
				return value as Partial<T>
			},
			merge: (other: Partial<T>) => {
				trackRecord = { ...trackRecord, ...other }
				notify(trackWatchers)
			},
		}
	}

	const additions = tracker()
	const track = watch(() => {
		const newKeys = Object.keys(additions.get())
		console.log('Additions watcher called', newKeys)
		for (const key of newKeys) {
			data.get(key) // Subscribe to the signal to track changes
		}
	})
	const mutations = tracker(track)
	const removals = tracker()
	const size = state(0)

	const current = (): T => {
		const record: Record<string, unknown & {}> = {}
		for (const [key, value] of data) {
			record[key] = value.get()
		}
		return record as T
	}

	// Reconcile data
	const reconcile = (oldValue: Partial<T>, newValue: T): boolean => {
		const oldKeys = new Set(Object.keys(oldValue))
		const newKeys = new Set(Object.keys(newValue))
		const allKeys = new Set([...oldKeys, ...newKeys])
		const changes: StoreChanges = {
			additions: {},
			mutations: {},
			removals: {},
		}

		for (const key of allKeys) {
			const oldHas = oldKeys.has(key)
			const newHas = newKeys.has(key)
			const value = newValue[key]

			if (oldHas && !newHas) {
				data.delete(key)
				changes.removals[key] = UNSET
			} else if (!oldHas && newHas) {
				const signal = toMutableSignal(value)
				data.set(key, signal)
				changes.additions[key] = value
			} else {
				// if (Object.is(oldValue[key], value)) continue
				console.log(key, oldValue[key], value)

				const signal = data.get(key)
				if (
					(isState(signal) && isPrimitive(value)) ||
					(isStore(signal) &&
						(isObjectOfType(value, 'Object') ||
							Array.isArray(value)))
				) {
					signal.set(value)
				} else {
					if (signal && hasMethod(signal, 'set')) signal.set(UNSET)
					data.set(key, toMutableSignal(value))
				}

				changes.mutations[key] = value
			}
		}
		const hasAdditions = Object.keys(changes.additions).length > 0
		const hasMutations = Object.keys(changes.mutations).length > 0
		const hasRemovals = Object.keys(changes.removals).length > 0
		if (hasAdditions) additions.merge(changes.additions as Partial<T>)
		if (hasMutations) mutations.merge(changes.mutations as Partial<T>)
		if (hasRemovals) removals.merge(changes.removals as Partial<T>)
		size.set(data.size)
		return hasAdditions || hasMutations || hasRemovals
	}

	// Initialize data
	reconcile({}, initialValue)

	// Return proxy directly with integrated signal methods
	return new Proxy({} as Store<T>, {
		get(_target, prop) {
			const key = String(prop)

			// Handle signal methods
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.iterator) {
				return function* () {
					for (const [key, signal] of data) {
						yield [key, signal as Signal<T[keyof T]>]
					}
				}
			}
			if (prop === 'get') {
				return (): T => {
					subscribe(watchers)
					return current()
				}
			}
			if (prop === 'set') {
				return (v: T): void => {
					if (reconcile(current(), v)) {
						notify(watchers)
						if (UNSET === v) watchers.clear()
					}
				}
			}
			if (prop === 'update') {
				return (fn: (v: T) => T): void => {
					const oldValue = current()
					const newValue = fn(oldValue)
					if (reconcile(oldValue, newValue)) {
						notify(watchers)
						if (UNSET === newValue) watchers.clear()
					}
				}
			}
			if (prop === 'additions') return additions
			if (prop === 'mutations') return mutations
			if (prop === 'removals') return removals
			if (prop === 'size') return size

			// Handle data properties - return signals
			return data.get(key)
		},
		has(_target, prop) {
			const key = String(prop)
			return (
				data.has(key) ||
				prop === 'get' ||
				prop === 'set' ||
				prop === 'update' ||
				prop === 'additions' ||
				prop === 'mutations' ||
				prop === 'removals' ||
				prop === 'size' ||
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

export { TYPE_STORE, isStore, store, type Store }
