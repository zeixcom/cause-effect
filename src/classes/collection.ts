import { type Computed, createComputed } from '../signals/computed'
import {
	type Cleanup,
	createWatcher,
	emitNotification,
	type Listener,
	type Listeners,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
	type Watcher,
} from '../system'
import {
	isAsyncFunction,
	isFunction,
	isObjectOfType,
	isSymbol,
	UNSET,
} from '../util'
import type { BaseList, List } from './list'

/* === Types === */

type CollectionSource<T extends {}> =
	| List<T>
	| BaseList<T>
	| Collection<T, unknown & {}>
	| BaseCollection<T, unknown & {}>

type CollectionCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abort: AbortSignal) => Promise<T>)

type Collection<T extends {}, U extends {}> = BaseCollection<T, U> & {
	[n: number]: Computed<T>
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Class === */

class BaseCollection<T extends {}, U extends {}> {
	#watchers = new Set<Watcher>()
	#source: CollectionSource<U>
	#callback: CollectionCallback<T, U>
	#signals = new Map<string, Computed<T>>()
	#ownWatchers = new Map<string, Watcher>()
	#listeners: Listeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
		sort: new Set<Listener<'sort'>>(),
	}
	#order: string[] = []

	constructor(
		source: CollectionSource<U>,
		callback: CollectionCallback<T, U>,
	) {
		this.#source = source
		this.#callback = callback

		for (let i = 0; i < this.#source.length; i++) {
			const key = this.#source.keyAt(i)
			if (!key) continue

			this.#add(key)
		}

		this.#source.on('add', additions => {
			for (const key of additions) {
				if (!this.#signals.has(key)) {
					this.#add(key)
					// For async computations, trigger initial computation
					const signal = this.#signals.get(key)
					if (signal && isAsyncCollectionCallback(this.#callback))
						signal.get()
				}
			}
			notifyWatchers(this.#watchers)
			emitNotification(this.#listeners.add, additions)
		})

		this.#source.on('remove', removals => {
			for (const key of removals) {
				if (!this.#signals.has(key)) continue

				this.#signals.delete(key)
				const index = this.#order.indexOf(key)
				if (index >= 0) this.#order.splice(index, 1)
				this.#removeWatcher(key)
			}
			this.#order = this.#order.filter(() => true) // Compact array
			notifyWatchers(this.#watchers)
			emitNotification(this.#listeners.remove, removals)
		})

		this.#source.on('sort', newOrder => {
			this.#order = [...newOrder]
			notifyWatchers(this.#watchers)
			emitNotification(this.#listeners.sort, newOrder)
		})
	}

	get #value(): T[] {
		return this.#order
			.map(key => this.#signals.get(key)?.get())
			.filter(v => v != null && v !== UNSET) as T[]
	}

	#add(key: string): boolean {
		const computedCallback = isAsyncCollectionCallback<T>(this.#callback)
			? async (_: T, abort: AbortSignal) => {
					const sourceSignal = this.#source.byKey(key)
					if (!sourceSignal) return UNSET

					const sourceValue = sourceSignal.get() as U
					return this.#callback(sourceValue, abort)
				}
			: () => {
					const sourceSignal = this.#source.byKey(key)
					if (!sourceSignal) return UNSET

					const sourceValue = sourceSignal.get() as U
					return (this.#callback as (sourceValue: U) => T)(
						sourceValue,
					)
				}

		const signal = createComputed(computedCallback)

		this.#signals.set(key, signal)
		if (!this.#order.includes(key)) this.#order.push(key)
		if (this.#listeners.change.size) this.#addWatcher(key)
		return true
	}

	#addWatcher(key: string): void {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				this.#signals.get(key)?.get() // Subscribe to the signal
			})
		})
		this.#ownWatchers.set(key, watcher)
		watcher()
	}

	#removeWatcher(key: string): void {
		const watcher = this.#ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			this.#ownWatchers.delete(key)
		}
	}

	get [Symbol.toStringTag](): 'Collection' {
		return TYPE_COLLECTION
	}

	get [Symbol.isConcatSpreadable](): boolean {
		return true
	}

	*[Symbol.iterator](): IterableIterator<Computed<T>> {
		for (const key of this.#order) {
			const signal = this.#signals.get(key)
			if (signal) yield signal as Computed<T>
		}
	}

	get length(): number {
		subscribeActiveWatcher(this.#watchers)
		return this.#order.length
	}

	get(): T[] {
		subscribeActiveWatcher(this.#watchers)
		return this.#value
	}

	at(index: number): Computed<T> | undefined {
		return this.#signals.get(this.#order[index])
	}

	keys(): IterableIterator<string> {
		return this.#order.values()
	}

	byKey(key: string): Computed<T> | undefined {
		return this.#signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#order[index]
	}

	indexOfKey(key: string): number {
		return this.#order.indexOf(key)
	}

	on<K extends keyof Listeners>(type: K, listener: Listener<K>): Cleanup {
		this.#listeners[type].add(listener)
		if (type === 'change' && !this.#ownWatchers.size) {
			for (const key of this.#signals.keys()) this.#addWatcher(key)
		}

		return () => {
			this.#listeners[type].delete(listener)
			if (type === 'change' && !this.#listeners.change.size) {
				if (this.#ownWatchers.size) {
					for (const watcher of this.#ownWatchers.values())
						watcher.stop()
					this.#ownWatchers.clear()
				}
			}
		}
	}

	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
	): Collection<R, T>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): Collection<R, T>
	deriveCollection<R extends {}>(
		callback: CollectionCallback<R, T>,
	): Collection<R, T> {
		// @ts-expect-error this type can't be properly inferred
		return createCollection(this, callback)
	}
}

/* === Functions === */

/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.17.0
 * @param {CollectionSource<U>} source - Source of collection to derive values from
 * @param {CollectionCallback<T, U>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U) => T,
): Collection<T, U>
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
): Collection<T, U>
function createCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: CollectionCallback<T, U>,
): Collection<T, U> {
	const instance = new BaseCollection(source, callback)

	const getSignal = (prop: string) => {
		const index = Number(prop)
		return Number.isInteger(index) && index >= 0
			? instance.at(index)
			: instance.byKey(prop)
	}

	return new Proxy(instance, {
		get(target, prop) {
			if (prop in target) {
				const value = Reflect.get(target, prop)
				return isFunction(value) ? value.bind(target) : value
			}
			if (!isSymbol(prop)) return getSignal(prop)
		},
		has(target, prop) {
			if (prop in target) return true
			return !isSymbol(prop) ? getSignal(prop) !== undefined : false
		},
		ownKeys(target) {
			return Object.getOwnPropertyNames(target.keys())
		},
		getOwnPropertyDescriptor(target, prop) {
			if (isSymbol(prop)) return undefined

			if (prop === 'length') {
				return {
					enumerable: false,
					configurable: false,
					writable: false,
					value: target.length,
				}
			}

			const index = Number(prop)
			if (
				Number.isInteger(index) &&
				index >= 0 &&
				index < target.length
			) {
				const signal = target.at(index)
				return signal
					? {
							enumerable: true,
							configurable: true,
							writable: true,
							value: signal,
						}
					: undefined
			}

			return undefined
		},
	}) as Collection<T, U>
}

const isCollection = /*#__PURE__*/ <T extends {}, U extends {}>(
	value: unknown,
): value is Collection<T, U> => isObjectOfType(value, TYPE_COLLECTION)

const isAsyncCollectionCallback = <T extends {}>(
	callback: unknown,
): callback is (sourceValue: unknown, abort: AbortSignal) => Promise<T> =>
	isAsyncFunction(callback)

export {
	type Collection,
	type CollectionSource,
	type CollectionCallback,
	createCollection,
	isCollection,
	TYPE_COLLECTION,
}
