import type { UnknownArray } from '../src/diff'
import { match } from '../src/match'
import { resolve } from '../src/resolve'
import type { Signal } from '../src/signal'
import {
	createWatcher,
	notifyWatchers,
	subscribeActiveWatcher,
	UNSET,
	type Watcher,
} from '../src/system'
import { isAsyncFunction, isObjectOfType, isSymbol } from '../src/util'
import { type Computed, createComputed } from './computed'
import type { List } from './list'

/* === Types === */

type CollectionKeySignal<T extends {}> = T extends UnknownArray
	? Collection<T>
	: Computed<T>

type CollectionCallback<T extends {} & { then?: undefined }, O extends {}> =
	| ((originValue: O, abort: AbortSignal) => Promise<T>)
	| ((originValue: O) => T)

type Collection<T extends {}> = {
	readonly [Symbol.toStringTag]: typeof TYPE_COLLECTION
	readonly [Symbol.isConcatSpreadable]: boolean
	[Symbol.iterator](): IterableIterator<CollectionKeySignal<T>>
	readonly [n: number]: CollectionKeySignal<T>
	readonly length: number

	byKey(key: string): CollectionKeySignal<T> | undefined
	get(): T[]
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	sort(compareFn?: (a: T, b: T) => number): void
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection' as const

/* === Exported Functions === */

/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.16.2
 * @param {List<O> | Collection<O>} origin - Origin of collection to derive values from
 * @param {ComputedCallback<ArrayItem<T>>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
const createCollection = <T extends {}, O extends {}>(
	origin: List<O> | Collection<O>,
	callback: CollectionCallback<T, O>,
): Collection<T> => {
	const watchers = new Set<Watcher>()
	const signals = new Map<string, Signal<T>>()
	const signalWatchers = new Map<string, Watcher>()

	let order: string[] = []

	// Add nested signal and effect
	const addProperty = (key: string): boolean => {
		const computedCallback = isAsyncFunction(callback)
			? async (_: T, abort: AbortSignal) => {
					const originSignal = origin.byKey(key)
					if (!originSignal) return UNSET

					let result = UNSET
					match(resolve({ originSignal }), {
						ok: async ({ originSignal: originValue }) => {
							result = await callback(originValue, abort)
						},
						err: (errors: readonly Error[]) => {
							console.log(errors)
						},
					})
					return result
				}
			: () => {
					const originSignal = origin.byKey(key)
					if (!originSignal) return UNSET

					let result = UNSET
					match(resolve({ originSignal }), {
						ok: ({ originSignal: originValue }) => {
							result = (callback as (originValue: O) => T)(
								originValue as unknown as O,
							)
						},
						err: (errors: readonly Error[]) => {
							console.log(errors)
						},
					})
					return result
				}

		const signal = createComputed(computedCallback)

		// Set internal states
		signals.set(key, signal)
		if (!order.includes(key)) order.push(key)
		const watcher = createWatcher(
			() => {
				signal.get() // Subscribe to the signal
			},
			() => {},
		)
		watcher()
		signalWatchers.set(key, watcher)
		return true
	}

	// Initialize properties
	for (let i = 0; i < origin.length; i++) {
		const key = origin.keyAt(i)
		if (!key) continue
		addProperty(key)
	}

	// Get signal by key or index
	const getSignal = (prop: string): Signal<T> | undefined => {
		let key = prop
		const index = Number(prop)
		if (Number.isInteger(index) && index >= 0) key = order[index] ?? prop
		return signals.get(key)
	}

	// Get current array
	const current = (): T =>
		order
			.map(key => signals.get(key)?.get())
			.filter(v => v !== UNSET) as unknown as T

	// Methods and Properties
	const collection: Record<PropertyKey, unknown> = {}
	Object.defineProperties(collection, {
		[Symbol.toStringTag]: {
			value: TYPE_COLLECTION,
		},
		[Symbol.isConcatSpreadable]: {
			value: true,
		},
		[Symbol.iterator]: {
			value: function* () {
				for (const key of order) {
					const signal = signals.get(key)
					if (signal) yield signal
				}
			},
		},
		byKey: {
			value(key: string) {
				return getSignal(key)
			},
		},
		keyAt: {
			value(index: number): string | undefined {
				return order[index]
			},
		},
		indexOfKey: {
			value(key: string): number {
				return order.indexOf(key)
			},
		},
		get: {
			value: (): T => {
				subscribeActiveWatcher(watchers)
				return current()
			},
		},
		sort: {
			value: (compareFn?: (a: T, b: T) => number): void => {
				const entries = order
					.map((key, index) => {
						const signal = signals.get(key)
						return [
							index,
							key,
							signal ? signal.get() : undefined,
						] as [number, string, T]
					})
					.sort(
						compareFn
							? (a, b) => compareFn(a[2], b[2])
							: (a, b) =>
									String(a[2]).localeCompare(String(b[2])),
					)

				// Set new order
				order = entries.map(([_, key]) => key)

				notifyWatchers(watchers)
			},
		},
		length: {
			get(): number {
				subscribeActiveWatcher(watchers)
				return signals.size
			},
		},
	})

	// Return proxy directly with integrated signal methods
	return new Proxy(collection as Collection<T>, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (!isSymbol(prop)) return getSignal(prop)
		},
		has(target, prop) {
			if (prop in target) return true
			return signals.has(String(prop))
		},
		ownKeys(target) {
			const staticKeys = Reflect.ownKeys(target)
			return [...new Set([...order, ...staticKeys])]
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)
			if (isSymbol(prop)) return undefined

			const signal = getSignal(prop)
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

const isCollection = /*#__PURE__*/ <T extends UnknownArray>(
	value: unknown,
): value is Collection<T> => isObjectOfType(value, TYPE_COLLECTION)

export {
	type Collection,
	type CollectionCallback,
	createCollection,
	isCollection,
	TYPE_COLLECTION,
}
