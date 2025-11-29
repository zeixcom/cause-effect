import type { UnknownArray } from './diff'
import { createStore, type Store } from './store'
import { subscribe, type Watcher } from './system'
import { isObjectOfType, UNSET } from './util'

/* === Types === */

type Collection<T extends UnknownArray> = {
	readonly [Symbol.toStringTag]: 'Collection'
	get(): T
}

type CollectionCallback<T extends UnknownArray> = (store: Store<T>) => T

/* === Constants === */

const TYPE_COLLECTION = 'Collection'

/* === Functions === */

/**
 * Create a collection signal
 *
 * @param {CollectionCallback<T>} fn - callback function to create the collection
 * @returns {Collection<T>} - collection signal
 */
const createCollection = <T extends UnknownArray>(
	fn: CollectionCallback<T>,
): Collection<T> => {
	const watchers: Set<Watcher> = new Set()

	const store = createStore<T>(UNSET)
	let error: Error | undefined

	const collect = () => {
		try {
			store.set(fn(store))
		} catch (err) {
			error = err as Error
		}
	}

	return {
		[Symbol.toStringTag]: TYPE_COLLECTION,
		get: (): T => {
			subscribe(watchers)
			if (error) throw error
			const value = store.get()
			// @ts-expect-error because we're initializing the store with UNSET store subtype cannot be inferred statically
			if (value !== UNSET) return value
			collect()
			// @ts-expect-error because we're initializing the store with UNSET store subtype cannot be inferred statically
			return store.get()
		},
	}
}

/**
 * Check if a value is a collection signal
 *
 * @since 0.16.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a computed state, false otherwise
 */
const isCollection = /*#__PURE__*/ <T extends UnknownArray>(
	value: unknown,
): value is Collection<T> => isObjectOfType(value, TYPE_COLLECTION)

export { TYPE_COLLECTION, createCollection, isCollection, type Collection }
