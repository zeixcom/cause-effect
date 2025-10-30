import { notify, subscribe, type Watcher } from './scheduler'
import { UNSET } from './signal'
import { isState, type State, state } from './state'
import { isObjectOfType } from './util'

/* === Types === */

type StoreProperty<T> = T extends (...args: unknown[]) => unknown
	? never // Functions are not allowed as property values
	: T extends Record<string, unknown & {}>
		? Store<T>
		: State<T & {}>

type Store<
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
> = {
	[Symbol.toStringTag]: 'Store'
	get(): T
	has(key: string): boolean // Non-tracking existence check
	add<K extends string, V>(key: K, value: V): Store<T & Record<K, V>>
	delete<K extends keyof T>(key: K): Store<Omit<T, K>>
} & {
	[K in keyof T]: StoreProperty<T[K]>
}

type UnknownStore = Store<Record<string, unknown & {}>>

/* === Constants === */

const TYPE_STORE = 'Store'

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
	const propertyStores = new Map<
		string | symbol,
		Store<Record<string, unknown & {}>> | State<unknown & {}>
	>()

	const createPropertyStore = (key: string | symbol, value: unknown & {}) => {
		if (typeof value === 'function') {
			throw new Error(
				`Functions are not allowed as store property values (property: ${String(key)})`,
			)
		}

		if (isObjectOfType(value, 'Object')) {
			return store(value as Record<string, unknown & {}>) // Recursive store creation
		} else {
			return state(value) // Leaf properties are state signals
		}
	}

	// Initialize property stores
	for (const [key, value] of Object.entries(initialValue)) {
		propertyStores.set(key, createPropertyStore(key, value))
	}

	const proxy = new Proxy({} as Store<T>, {
		get(_target, prop) {
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === 'get') {
				return () => {
					subscribe(watchers)
					// Subscribe to all children to detect changes
					const result = {} as T
					for (const [key, store] of propertyStores) {
						;(result as Record<string, unknown & {}>)[
							key as string
						] = store.get()
					}
					return result
				}
			}
			if (prop === 'has') {
				return (key: string) => {
					// Non-tracking existence check
					return propertyStores.has(key)
				}
			}
			if (prop === 'add') {
				return (key: string, value: unknown & {}) => {
					if (propertyStores.has(key)) {
						throw new Error(`Property '${key}' already exists`)
					}
					const newStore = createPropertyStore(key, value)
					propertyStores.set(key, newStore)
					notify(watchers) // Notify store-level watchers of structure change
					return proxy // Return self for chaining
				}
			}
			if (prop === 'delete') {
				return (key: string) => {
					if (!propertyStores.has(key)) {
						throw new Error(`Property '${key}' does not exist`)
					}
					// Clean up child subscriptions
					const childStore = propertyStores.get(key)
					if (isState(childStore)) {
						childStore.set(UNSET) // Triggers cleanup in state implementation
					}
					propertyStores.delete(key)
					notify(watchers) // Notify store-level watchers of structure change
					return proxy // Return self for chaining
				}
			}

			// Property access
			if (propertyStores.has(prop)) {
				return propertyStores.get(prop)
			}

			// Throw error for non-existent property access
			throw new Error(
				`Property '${String(prop)}' does not exist on store`,
			)
		},

		has(_target, prop) {
			return (
				propertyStores.has(prop) ||
				prop === 'get' ||
				prop === 'has' ||
				prop === 'add' ||
				prop === 'delete' ||
				prop === Symbol.toStringTag
			)
		},

		ownKeys(_target) {
			return Array.from(propertyStores.keys())
		},

		getOwnPropertyDescriptor(_target, prop) {
			if (this.has?.(_target, prop)) {
				return {
					enumerable: true,
					configurable: true,
				}
			}
			return undefined
		},
	})

	return proxy
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
