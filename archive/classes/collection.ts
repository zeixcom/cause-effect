import { InvalidCollectionSourceError, validateCallback } from '../errors'
import type { Signal } from '../signal'
import {
	createWatcher,
	notifyOf,
	registerWatchCallbacks,
	type SignalOptions,
	subscribeTo,
	UNSET,
	type Watcher,
} from '../system'
import { isAsyncFunction, isFunction, isObjectOfType } from '../../src/util'
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
	keys(): IterableIterator<string>
	get: () => T[]
	at: (index: number) => Signal<T> | undefined
	byKey: (key: string) => Signal<T> | undefined
	keyAt: (index: number) => string | undefined
	indexOfKey: (key: string) => number | undefined
	deriveCollection: <R extends {}>(
		callback: CollectionCallback<R, T>,
	) => DerivedCollection<R, T>
	readonly length: number
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Class === */

class DerivedCollection<T extends {}, U extends {}> implements Collection<T> {
	#source: CollectionSource<U>
	#callback: CollectionCallback<T, U>
	#signals = new Map<string, Computed<T>>()
	#keys: string[] = []
	#dirty = true
	#watcher: Watcher | undefined

	constructor(
		source: CollectionSource<U> | (() => CollectionSource<U>),
		callback: CollectionCallback<T, U>,
		options?: SignalOptions<T[]>,
	) {
		validateCallback(TYPE_COLLECTION, callback)

		if (isFunction(source)) source = source()
		if (!isCollectionSource(source))
			throw new InvalidCollectionSourceError(TYPE_COLLECTION, source)
		this.#source = source

		this.#callback = callback

		for (let i = 0; i < this.#source.length; i++) {
			const key = this.#source.keyAt(i)
			if (!key) continue

			this.#add(key)
		}

		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	#getWatcher(): Watcher {
		this.#watcher ||= createWatcher(
			() => {
				this.#dirty = true
				if (!notifyOf(this)) this.#watcher?.stop()
			},
			() => {
				const newKeys = Array.from(this.#source.keys())
				const allKeys = new Set([...this.#keys, ...newKeys])
				const addedKeys: string[] = []
				const removedKeys: string[] = []

				for (const key of allKeys) {
					const oldHas = this.#keys.includes(key)
					const newHas = newKeys.includes(key)

					if (!oldHas && newHas) addedKeys.push(key)
					else if (oldHas && !newHas) removedKeys.push(key)
				}

				for (const key of removedKeys) this.#signals.delete(key)
				for (const key of addedKeys) this.#add(key)
				this.#keys = newKeys
				this.#dirty = false
			},
		)
		this.#watcher.onCleanup(() => {
			this.#watcher = undefined
		})

		return this.#watcher
	}

	#add(key: string): boolean {
		const computedCallback = isAsyncCollectionCallback<T>(this.#callback)
			? async (_: T, abort: AbortSignal) => {
					const sourceValue = this.#source.byKey(key)?.get() as U
					if (sourceValue === UNSET) return UNSET
					return this.#callback(sourceValue, abort)
				}
			: () => {
					const sourceValue = this.#source.byKey(key)?.get() as U
					if (sourceValue === UNSET) return UNSET
					return (this.#callback as (sourceValue: U) => T)(
						sourceValue,
					)
				}

		const signal = createComputed(computedCallback)

		this.#signals.set(key, signal)
		if (!this.#keys.includes(key)) this.#keys.push(key)
		return true
	}

	get [Symbol.toStringTag](): 'Collection' {
		return TYPE_COLLECTION
	}

	get [Symbol.isConcatSpreadable](): true {
		return true
	}

	*[Symbol.iterator](): IterableIterator<Computed<T>> {
		for (const key of this.#keys) {
			const signal = this.#signals.get(key)
			if (signal) yield signal as Computed<T>
		}
	}

	keys(): IterableIterator<string> {
		subscribeTo(this)
		if (this.#dirty) this.#getWatcher().run()
		return this.#keys.values()
	}

	get(): T[] {
		subscribeTo(this)

		if (this.#dirty) this.#getWatcher().run()
		return this.#keys
			.map(key => this.#signals.get(key)?.get())
			.filter(v => v != null && v !== UNSET) as T[]
	}

	at(index: number): Computed<T> | undefined {
		return this.#signals.get(this.#keys[index])
	}

	byKey(key: string): Computed<T> | undefined {
		return this.#signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#keys[index]
	}

	indexOfKey(key: string): number {
		return this.#keys.indexOf(key)
	}

	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
		options?: SignalOptions<R[]>,
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
		options?: SignalOptions<R[]>,
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: CollectionCallback<R, T>,
		options?: SignalOptions<R[]>,
	): DerivedCollection<R, T> {
		return new DerivedCollection(this, callback, options)
	}

	get length(): number {
		subscribeTo(this)
		if (this.#dirty) this.#getWatcher().run()
		return this.#keys.length
	}
}

/* === Functions === */

/**
 * Check if a value is a collection signal
 *
 * @since 0.17.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
const isCollection = /*#__PURE__*/ <T extends {}>(
	value: unknown,
): value is Collection<T> => isObjectOfType(value, TYPE_COLLECTION)

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
