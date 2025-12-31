import { diff, isEqual, type UnknownArray, type UnknownRecord } from '../diff'
import { DuplicateKeyError, validateSignalValue } from '../errors'
import type { MutableSignal } from '../signal'
/* import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from '../signals/collection' */
import {
	type Cleanup,
	emitNotification,
	type Listener,
	type Listeners,
	type Notifications,
	notifyWatchers,
	subscribeActiveWatcher,
	type Watcher,
} from '../system'
import {
	isFunction,
	isNumber,
	isObjectOfType,
	isString,
	isSymbol,
	UNSET,
} from '../util'
import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from './collection'
import { MutableComposite } from './composite'
import type { State } from './state'
import type { Store } from './store'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type KeyConfig<T> = string | ((item: T) => string)

type List<T extends {}> = BaseList<T> & {
	[n: number]: T extends readonly (infer U extends {})[]
		? List<U>
		: T extends UnknownRecord
			? Store<T>
			: State<T>
}

/* === Constants === */

const TYPE_LIST = 'List' as const

/* === Class === */

class BaseList<T extends {}> {
	#composite: MutableComposite<Record<string, T>>
	#watchers = new Set<Watcher>()
	#listeners: Pick<Listeners, 'sort'> = {
		sort: new Set<Listener<'sort'>>(),
	}
	#order: string[] = []
	#generateKey: (item: T) => string

	constructor(initialValue: T[], keyConfig?: KeyConfig<T>) {
		validateSignalValue('list', initialValue, Array.isArray)

		let keyCounter = 0
		this.#generateKey = isString(keyConfig)
			? () => `${keyConfig}${keyCounter++}`
			: isFunction<string>(keyConfig)
				? (item: T) => keyConfig(item)
				: () => String(keyCounter++)

		this.#composite = new MutableComposite(
			this.#toRecord(initialValue),
			(key: string, value: unknown): value is T => {
				validateSignalValue(`list for key "${key}"`, value)
				return true
			},
		)
	}

	// Convert array to record with stable keys
	#toRecord(array: T[]): ArrayToRecord<T[]> {
		const record = {} as Record<string, T>

		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = this.#order[i]
			if (!key) {
				key = this.#generateKey(value)
				this.#order[i] = key
			}
			record[key] = value
		}
		return record
	}

	get #value(): T[] {
		return this.#order
			.map(key => this.#composite.get(key)?.get())
			.filter(v => v !== undefined) as T[]
	}

	// Public methods
	get [Symbol.toStringTag](): 'List' {
		return TYPE_LIST
	}

	get [Symbol.isConcatSpreadable](): boolean {
		return true
	}

	*[Symbol.iterator](): IterableIterator<MutableSignal<T>> {
		for (const key of this.#order) {
			const signal = this.#composite.get(key)
			if (signal) yield signal as MutableSignal<T>
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

	set(newValue: T[]): void {
		if (UNSET === newValue) {
			this.#composite.clear()
			notifyWatchers(this.#watchers)
			this.#watchers.clear()
			return
		}

		const oldValue = this.#value
		const changes = diff(this.#toRecord(oldValue), this.#toRecord(newValue))
		const removedKeys = Object.keys(changes.remove)

		const changed = this.#composite.change(changes)
		if (changed) {
			for (const key of removedKeys) {
				const index = this.#order.indexOf(key)
				if (index !== -1) this.#order.splice(index, 1)
			}
			this.#order = this.#order.filter(() => true)
			notifyWatchers(this.#watchers)
		}
	}

	update(fn: (oldValue: T[]) => T[]): void {
		this.set(fn(this.get()))
	}

	at(index: number): MutableSignal<T> | undefined {
		return this.#composite.get(this.#order[index])
	}

	keys(): IterableIterator<string> {
		return this.#order.values()
	}

	byKey(key: string): MutableSignal<T> | undefined {
		return this.#composite.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#order[index]
	}

	indexOfKey(key: string): number {
		return this.#order.indexOf(key)
	}

	add(value: T): string {
		const key = this.#generateKey(value)
		if (this.#composite.has(key))
			throw new DuplicateKeyError('store', key, value)

		if (!this.#order.includes(key)) this.#order.push(key)
		const ok = this.#composite.add(key, value)
		if (ok) notifyWatchers(this.#watchers)
		return key
	}

	remove(keyOrIndex: string | number): void {
		const key = isNumber(keyOrIndex) ? this.#order[keyOrIndex] : keyOrIndex
		const ok = this.#composite.remove(key)
		if (ok) {
			const index = isNumber(keyOrIndex)
				? keyOrIndex
				: this.#order.indexOf(key)
			if (index >= 0) this.#order.splice(index, 1)
			this.#order = this.#order.filter(() => true)
			notifyWatchers(this.#watchers)
		}
	}

	sort(compareFn?: (a: T, b: T) => number): void {
		const entries = this.#order
			.map(key => [key, this.#composite.get(key)?.get()] as [string, T])
			.sort(
				isFunction(compareFn)
					? (a, b) => compareFn(a[1], b[1])
					: (a, b) => String(a[1]).localeCompare(String(b[1])),
			)
		const newOrder = entries.map(([key]) => key)

		if (!isEqual(this.#order, newOrder)) {
			this.#order = newOrder
			notifyWatchers(this.#watchers)
			emitNotification(this.#listeners.sort, this.#order)
		}
	}

	splice(start: number, deleteCount?: number, ...items: T[]): T[] {
		const length = this.#order.length
		const actualStart =
			start < 0 ? Math.max(0, length + start) : Math.min(start, length)
		const actualDeleteCount = Math.max(
			0,
			Math.min(
				deleteCount ?? Math.max(0, length - Math.max(0, actualStart)),
				length - actualStart,
			),
		)

		const add = {} as Record<string, T>
		const remove = {} as Record<string, T>

		// Collect items to delete and their keys
		for (let i = 0; i < actualDeleteCount; i++) {
			const index = actualStart + i
			const key = this.#order[index]
			if (key) {
				const signal = this.#composite.get(key)
				if (signal) remove[key] = signal.get() as T
			}
		}

		// Build new order: items before splice point
		const newOrder = this.#order.slice(0, actualStart)

		// Add new items
		for (const item of items) {
			const key = this.#generateKey(item)
			newOrder.push(key)
			add[key] = item as T
		}

		// Add items after splice point
		newOrder.push(...this.#order.slice(actualStart + actualDeleteCount))

		const changed = !!(
			Object.keys(add).length || Object.keys(remove).length
		)

		if (changed) {
			this.#composite.change({
				add,
				change: {} as Record<string, T>,
				remove,
				changed,
			})
			this.#order = newOrder.filter(() => true) // Update order array
			notifyWatchers(this.#watchers)
		}

		return Object.values(remove)
	}

	on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup {
		if (type === 'sort') {
			this.#listeners.sort.add(listener as Listener<'sort'>)
			return () =>
				this.#listeners.sort.delete(listener as Listener<'sort'>)
		}

		// For other types, delegate to the composite
		return this.#composite.on(
			type,
			listener as Listener<
				keyof Pick<Notifications, 'add' | 'remove' | 'change'>
			>,
		)
	}

	deriveCollection<U extends {}>(
		callback: CollectionCallback<U, T>,
	): Collection<U, T> {
		return createCollection(this, callback)
	}
}

/* === Functions === */

/**
 * Create a new list with deeply nested reactive list items
 *
 * @since 0.16.2
 * @param {T[]} initialValue - Initial array of the list
 * @param {KeyConfig<T>} keyConfig - Optional key configuration:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {List<T>} - New list with reactive items of type T
 */
const createList = <T extends {}>(
	initialValue: T[],
	keyConfig?: KeyConfig<T>,
): List<T> => {
	const instance = new BaseList(initialValue, keyConfig)

	const getSignal = (prop: string) => {
		const index = Number(prop)
		return Number.isInteger(index) && index >= 0
			? instance.at(index)
			: instance.byKey(prop)
	}

	// Return proxy for property access
	return new Proxy(instance, {
		get(target, prop) {
			if (prop in target) {
				const value = Reflect.get(target, prop)
				return isFunction(value) ? value.bind(target) : value
			}
			return !isSymbol(prop) ? getSignal(prop) : undefined
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
	}) as List<T>
}

/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a List instance, false otherwise
 */
const isList = <T extends {}>(value: unknown): value is List<T> =>
	isObjectOfType(value, TYPE_LIST)

/* === Exports === */

export {
	createList,
	isList,
	BaseList,
	TYPE_LIST,
	type ArrayToRecord,
	type KeyConfig,
	type List,
}
