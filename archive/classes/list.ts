import { isFunction, isNumber, isObjectOfType, isString } from '../../src/util'
import { type DiffResult, diff, isEqual, type UnknownArray } from '../diff'
import {
	DuplicateKeyError,
	guardMutableSignal,
	validateSignalValue,
} from '../errors'
import {
	batch,
	notifyOf,
	registerWatchCallbacks,
	type SignalOptions,
	subscribeTo,
	UNSET,
	unsubscribeAllFrom,
} from '../system'
import { type CollectionCallback, DerivedCollection } from './collection'
import { State } from './state'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type KeyConfig<T> = string | ((item: T) => string)
type ListOptions<T extends {}> = SignalOptions<T> & {
	keyConfig?: KeyConfig<T>
}

/* === Constants === */

const TYPE_LIST = 'List' as const

/* === Class === */

class List<T extends {}> {
	#signals = new Map<string, State<T>>()
	#keys: string[] = []
	#generateKey: (item: T) => string
	#validate: (key: string, value: unknown) => value is T

	constructor(initialValue: T[], options?: ListOptions<T>) {
		validateSignalValue(TYPE_LIST, initialValue, Array.isArray)

		let keyCounter = 0
		const keyConfig = options?.keyConfig
		this.#generateKey = isString(keyConfig)
			? () => `${keyConfig}${keyCounter++}`
			: isFunction<string>(keyConfig)
				? (item: T) => keyConfig(item)
				: () => String(keyCounter++)

		this.#validate = (key: string, value: unknown): value is T => {
			validateSignalValue(
				`${TYPE_LIST} item for key "${key}"`,
				value,
				options?.guard,
			)
			return true
		}

		this.#change({
			add: this.#toRecord(initialValue),
			change: {},
			remove: {},
			changed: true,
		})
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	// Convert array to record with stable keys
	#toRecord(array: T[]): ArrayToRecord<T[]> {
		const record = {} as Record<string, T>

		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = this.#keys[i]
			if (!key) {
				key = this.#generateKey(value)
				this.#keys[i] = key
			}
			record[key] = value
		}
		return record
	}

	#add(key: string, value: T) {
		if (!this.#validate(key, value)) return false

		this.#signals.set(key, new State(value))
		return true
	}

	#change(changes: DiffResult) {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add) this.#add(key, changes.add[key] as T)
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!this.#validate(key as keyof T & string, value))
						continue

					const signal = this.#signals.get(key)
					if (
						guardMutableSignal(
							`${TYPE_LIST} item "${key}"`,
							value,
							signal,
						)
					)
						signal.set(value)
				}
			})
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove) {
				this.#signals.delete(key)
				const index = this.#keys.indexOf(key)
				if (index !== -1) this.#keys.splice(index, 1)
			}
			this.#keys = this.#keys.filter(() => true)
		}

		return changes.changed
	}

	get #value(): T[] {
		return this.#keys
			.map(key => this.#signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]
	}

	// Public methods
	get [Symbol.toStringTag](): 'List' {
		return TYPE_LIST
	}

	get [Symbol.isConcatSpreadable](): true {
		return true
	}

	*[Symbol.iterator](): IterableIterator<State<T>> {
		for (const key of this.#keys) {
			const signal = this.#signals.get(key)
			if (signal) yield signal as State<T>
		}
	}

	get length(): number {
		subscribeTo(this)
		return this.#keys.length
	}

	get(): T[] {
		subscribeTo(this)
		return this.#value
	}

	set(newValue: T[]): void {
		if (UNSET === newValue) {
			this.#signals.clear()
			notifyOf(this)
			unsubscribeAllFrom(this)
			return
		}

		const changes = diff(
			this.#toRecord(this.#value),
			this.#toRecord(newValue),
		)
		if (this.#change(changes)) notifyOf(this)
	}

	update(fn: (oldValue: T[]) => T[]): void {
		this.set(fn(this.get()))
	}

	at(index: number): State<T> | undefined {
		return this.#signals.get(this.#keys[index])
	}

	keys(): IterableIterator<string> {
		subscribeTo(this)
		return this.#keys.values()
	}

	byKey(key: string): State<T> | undefined {
		return this.#signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#keys[index]
	}

	indexOfKey(key: string): number {
		return this.#keys.indexOf(key)
	}

	add(value: T): string {
		const key = this.#generateKey(value)
		if (this.#signals.has(key))
			throw new DuplicateKeyError('store', key, value)

		if (!this.#keys.includes(key)) this.#keys.push(key)
		const ok = this.#add(key, value)
		if (ok) notifyOf(this)
		return key
	}

	remove(keyOrIndex: string | number): void {
		const key = isNumber(keyOrIndex) ? this.#keys[keyOrIndex] : keyOrIndex
		const ok = this.#signals.delete(key)
		if (ok) {
			const index = isNumber(keyOrIndex)
				? keyOrIndex
				: this.#keys.indexOf(key)
			if (index >= 0) this.#keys.splice(index, 1)
			this.#keys = this.#keys.filter(() => true)
			notifyOf(this)
		}
	}

	sort(compareFn?: (a: T, b: T) => number): void {
		const entries = this.#keys
			.map(key => [key, this.#signals.get(key)?.get()] as [string, T])
			.sort(
				isFunction(compareFn)
					? (a, b) => compareFn(a[1], b[1])
					: (a, b) => String(a[1]).localeCompare(String(b[1])),
			)
		const newOrder = entries.map(([key]) => key)

		if (!isEqual(this.#keys, newOrder)) {
			this.#keys = newOrder
			notifyOf(this)
		}
	}

	splice(start: number, deleteCount?: number, ...items: T[]): T[] {
		const length = this.#keys.length
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
			const key = this.#keys[index]
			if (key) {
				const signal = this.#signals.get(key)
				if (signal) remove[key] = signal.get() as T
			}
		}

		// Build new order: items before splice point
		const newOrder = this.#keys.slice(0, actualStart)

		// Add new items
		for (const item of items) {
			const key = this.#generateKey(item)
			newOrder.push(key)
			add[key] = item as T
		}

		// Add items after splice point
		newOrder.push(...this.#keys.slice(actualStart + actualDeleteCount))

		const changed = !!(
			Object.keys(add).length || Object.keys(remove).length
		)

		if (changed) {
			this.#change({
				add,
				change: {} as Record<string, T>,
				remove,
				changed,
			})
			this.#keys = newOrder.filter(() => true) // Update order array
			notifyOf(this)
		}

		return Object.values(remove)
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
}

/* === Functions === */

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
	isList,
	List,
	TYPE_LIST,
	type ArrayToRecord,
	type KeyConfig,
	type ListOptions,
}
