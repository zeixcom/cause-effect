import { InvalidCollectionSourceError, validateCallback } from '../errors'
import type { Signal } from '../signal'
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
import { isAsyncFunction, isFunction, isObjectOfType, UNSET } from '../util'
import { type Computed, createComputed } from './computed'
import { isList, type List } from './list'

/* === Types === */

type CollectionSource<T extends {}> = List<T> | Collection<T>

type CollectionCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abort: AbortSignal) => Promise<T>)

type Collection<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Collection'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<Signal<T>>
	get: () => T[]
	at: (index: number) => Signal<T> | undefined
	byKey: (key: string) => Signal<T> | undefined
	keyAt: (index: number) => string | undefined
	indexOfKey: (key: string) => number | undefined
	on: <K extends keyof Listeners>(type: K, listener: Listener<K>) => Cleanup
	deriveCollection: <R extends {}>(
		callback: CollectionCallback<R, T>,
	) => DerivedCollection<R, T>
	readonly length: number
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Class === */

class DerivedCollection<T extends {}, U extends {}> implements Collection<T> {
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
		source: CollectionSource<U> | (() => CollectionSource<U>),
		callback: CollectionCallback<T, U>,
	) {
		validateCallback('collection', callback)

		if (isFunction(source)) source = source()
		if (!isCollectionSource(source))
			throw new InvalidCollectionSourceError('derived collection', source)
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

				const watcher = this.#ownWatchers.get(key)
				if (watcher) {
					watcher.stop()
					this.#ownWatchers.delete(key)
				}
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

	#add(key: string): boolean {
		const computedCallback = isAsyncCollectionCallback<T>(this.#callback)
			? async (_: T, abort: AbortSignal) => {
					const sourceSignal = this.#source.byKey(key)
					if (!sourceSignal) return UNSET

					const sourceValue = sourceSignal.get() as U
					if (sourceValue === UNSET) return UNSET
					return this.#callback(sourceValue, abort)
				}
			: () => {
					const sourceSignal = this.#source.byKey(key)
					if (!sourceSignal) return UNSET

					const sourceValue = sourceSignal.get() as U
					if (sourceValue === UNSET) return UNSET
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

	get [Symbol.toStringTag](): 'Collection' {
		return TYPE_COLLECTION
	}

	get [Symbol.isConcatSpreadable](): true {
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
		return this.#order
			.map(key => this.#signals.get(key)?.get())
			.filter(v => v != null && v !== UNSET) as T[]
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
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: CollectionCallback<R, T>,
	): DerivedCollection<R, T> {
		return new DerivedCollection(this, callback)
	}
}

/* === Functions === */

/**
 * Check if a value is a collection signal
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
const isCollection = /*#__PURE__*/ <T extends {}, U extends {}>(
	value: unknown,
): value is DerivedCollection<T, U> => isObjectOfType(value, TYPE_COLLECTION)

/**
 * Check if a value is a collection source
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection source, false otherwise
 */
const isCollectionSource = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is CollectionSource<T> => isList(value) || isCollection(value)

/**
 * Check if the provided callback is an async function
 *
 * @since 0.17.0
 * @param {unknown} callback - Value to check
 * @returns {boolean} - True if value is an async collection callback, false otherwise
 */
const isAsyncCollectionCallback = <T extends {}>(
	callback: unknown,
): callback is (sourceValue: unknown, abort: AbortSignal) => Promise<T> =>
	isAsyncFunction(callback)

export {
	type Collection,
	type CollectionSource,
	type CollectionCallback,
	DerivedCollection,
	isCollection,
	TYPE_COLLECTION,
}
