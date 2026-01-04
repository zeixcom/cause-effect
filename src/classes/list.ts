import { diff, isEqual, type UnknownArray } from '../diff'
import {
	DuplicateKeyError,
	InvalidHookError,
	validateSignalValue,
} from '../errors'
import {
	type Cleanup,
	type Hook,
	HOOK_ADD,
	HOOK_CHANGE,
	HOOK_REMOVE,
	HOOK_SORT,
	HOOK_WATCH,
	type HookCallback,
	type HookCallbacks,
	isHandledHook,
	notifyWatchers,
	subscribeActiveWatcher,
	triggerHook,
	UNSET,
	type Watcher,
} from '../system'
import { isFunction, isNumber, isObjectOfType, isString } from '../util'
import { type CollectionCallback, DerivedCollection } from './collection'
import { Composite } from './composite'
import { State } from './state'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type KeyConfig<T> = string | ((item: T) => string)

/* === Constants === */

const TYPE_LIST = 'List' as const

/* === Class === */

class List<T extends {}> {
	#composite: Composite<Record<string, T>, State<T>>
	#watchers = new Set<Watcher>()
	#hookCallbacks: HookCallbacks = {}
	#order: string[] = []
	#generateKey: (item: T) => string

	constructor(initialValue: T[], keyConfig?: KeyConfig<T>) {
		validateSignalValue(TYPE_LIST, initialValue, Array.isArray)

		let keyCounter = 0
		this.#generateKey = isString(keyConfig)
			? () => `${keyConfig}${keyCounter++}`
			: isFunction<string>(keyConfig)
				? (item: T) => keyConfig(item)
				: () => String(keyCounter++)

		this.#composite = new Composite<ArrayToRecord<T[]>, State<T>>(
			this.#toRecord(initialValue),
			(key: string, value: unknown): value is T => {
				validateSignalValue(`${TYPE_LIST} for key "${key}"`, value)
				return true
			},
			value => new State(value),
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
			.map(key => this.#composite.signals.get(key)?.get())
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
		for (const key of this.#order) {
			const signal = this.#composite.signals.get(key)
			if (signal) yield signal as State<T>
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

	at(index: number): State<T> | undefined {
		return this.#composite.signals.get(this.#order[index])
	}

	keys(): IterableIterator<string> {
		return this.#order.values()
	}

	byKey(key: string): State<T> | undefined {
		return this.#composite.signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#order[index]
	}

	indexOfKey(key: string): number {
		return this.#order.indexOf(key)
	}

	add(value: T): string {
		const key = this.#generateKey(value)
		if (this.#composite.signals.has(key))
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
			.map(
				key =>
					[key, this.#composite.signals.get(key)?.get()] as [
						string,
						T,
					],
			)
			.sort(
				isFunction(compareFn)
					? (a, b) => compareFn(a[1], b[1])
					: (a, b) => String(a[1]).localeCompare(String(b[1])),
			)
		const newOrder = entries.map(([key]) => key)

		if (!isEqual(this.#order, newOrder)) {
			this.#order = newOrder
			notifyWatchers(this.#watchers)
			triggerHook(this.#hookCallbacks.sort, this.#order)
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
				const signal = this.#composite.signals.get(key)
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

	on(type: Hook, callback: HookCallback): Cleanup {
		if (isHandledHook(type, [HOOK_SORT, HOOK_WATCH])) {
			this.#hookCallbacks[type] ||= new Set<HookCallback>()
			this.#hookCallbacks[type].add(callback)
			return () => {
				this.#hookCallbacks[type]?.delete(callback)
			}
		} else if (isHandledHook(type, [HOOK_ADD, HOOK_CHANGE, HOOK_REMOVE])) {
			return this.#composite.on(type, callback)
		}
		throw new InvalidHookError(TYPE_LIST, type)
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
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a List instance, false otherwise
 */
const isList = <T extends {}>(value: unknown): value is List<T> =>
	isObjectOfType(value, TYPE_LIST)

/* === Exports === */

export { isList, List, TYPE_LIST, type ArrayToRecord, type KeyConfig }
