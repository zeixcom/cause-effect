import { notify, subscribe, type Watcher } from './scheduler'
import { type Signal, toSignal, UNSET } from './signal'
import { type State, state } from './state'
import { isObjectOfType } from './util'

/* === Constants === */

const TYPE_STORE = 'Store'

/* === Types === */

type Store<
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
> = {
	[Symbol.toStringTag]: 'Store'
	[Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T]>]>

	// Data proxy
	data: T

	// Methods
	entries(): IterableIterator<[string, Signal<T[keyof T]>]>
	forEach(
		callback: (
			value: Signal<T[keyof T]>,
			key: string,
			store: Store<T>,
		) => void,
	): void
	get(): T
	keys(): IterableIterator<string>
	set(value: T): void
	update(updater: (value: T) => T): void
	values(): IterableIterator<Signal<T[keyof T]>>

	// Change tracking signals
	additions: State<Partial<T>>
	removals: State<Partial<T>>
	mutations: State<Partial<T>>
	length: State<number>
}

type UnknownStore = Store<Record<string, unknown & {}>>

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

	const additions = state<Partial<T>>({})
	const mutations = state<Partial<T>>({})
	const removals = state<Partial<T>>({})
	const size = state(0)

	const current = (): T => {
		const result: Record<string, unknown & {}> = {}
		for (const [key, value] of data) {
			result[key] = value.get()
		}
		return result as T
	}

	// Reconcile data
	const reconcile = (oldValue: Partial<T>, newValue: T): boolean => {
		const oldKeys = new Set(Object.keys(oldValue))
		const newKeys = new Set(Object.keys(newValue))
		const allKeys = new Set([...oldKeys, ...newKeys])
		let changed = false

		for (const key of allKeys) {
			const oldHas = oldKeys.has(key)
			const newHas = newKeys.has(key)

			if (oldHas && !newHas) {
				removals.update(prev => ({ ...prev, [key]: UNSET }))
				data.delete(key)
				changed = true
			} else if (!oldHas && newHas) {
				additions.update(prev => ({ ...prev, [key]: newValue[key] }))
				data.set(key, toSignal(newValue[key]))
				changed = true
			} else {
				if (Object.is(oldValue[key], newValue[key])) continue
				mutations.update(prev => ({ ...prev, [key]: newValue[key] }))
				data.set(key, toSignal(newValue[key]))
				changed = true
			}
		}
		size.set(data.size)
		return changed
	}

	// Initialize data
	reconcile({}, initialValue)

	const proxy = new Proxy({} as T, {
		get(target, prop, receiver) {
			return Reflect.get(target, prop, receiver)
		},
		set(target, prop, value, receiver) {
			return Reflect.set(target, prop, value, receiver)
		},
	})

	const s: Store<T> = {
		[Symbol.toStringTag]: TYPE_STORE,
		[Symbol.iterator]: function* () {
			for (const [key, value] of data) {
				yield [key, value.get()]
			}
		},

		data: proxy,

		/**
		 * Get the current value of the store
		 *
		 * @since 0.15.0
		 * @returns {T} - current value of the store
		 */
		get: (): T => {
			subscribe(watchers)
			return current()
		},

		/**
		 * Set a new value of the store
		 *
		 * @since 0.15.0
		 * @param {T} v
		 * @returns {void}
		 */
		set: (v: T): void => {
			const changed = reconcile(current(), v)
			if (changed) {
				notify(watchers)

				// Setting to UNSET clears the watchers so the signal can be garbage collected
				if (UNSET === v) watchers.clear()
			}
		},

		/**
		 * Update the store with a new value using a function
		 *
		 * @since 0.15.0
		 * @param {(v: T) => T} fn - function to update the store
		 * @returns {void} - updates the store with the result of the function
		 */
		update: (fn: (v: T) => T): void => {
			s.set(fn(current()))
		},

		additions,
		mutations,
		removals,
		size,
	}

	return s
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

export { TYPE_STORE, isStore, store, type Store, type UnknownStore }
