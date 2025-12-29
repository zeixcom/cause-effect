import {
	type DiffResult,
	diff,
	isEqual,
	type UnknownArray,
	type UnknownRecord,
} from '../diff'
import {
	DuplicateKeyError,
	guardMutableSignal,
	validateSignalValue,
} from '../errors'
import { createMutableSignal, type MutableSignal } from '../signal'
import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from '../signals/collection'
import {
	batchSignalWrites,
	type Cleanup,
	createWatcher,
	emitNotification,
	type Listener,
	type Listeners,
	type Notifications,
	notifyWatchers,
	subscribeActiveWatcher,
	trackSignalReads,
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
	protected watchers = new Set<Watcher>()
	protected listeners: Listeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
		sort: new Set<Listener<'sort'>>(),
	}
	protected signals = new Map<string, MutableSignal<T>>()
	protected order: string[] = []
	protected ownWatchers = new Map<string, Watcher>()
	protected batching = false
	protected keyCounter = 0
	protected keyConfig?: KeyConfig<T>

	constructor(initialValue: T[], keyConfig?: KeyConfig<T>) {
		validateSignalValue('list', initialValue, Array.isArray)

		this.keyConfig = keyConfig
		this.reconcile([] as T[], initialValue, true)
	}

	// Generate stable key for array items
	protected generateKey(item: T): string {
		const id = this.keyCounter++
		return isString(this.keyConfig)
			? `${this.keyConfig}${id}`
			: isFunction<string>(this.keyConfig)
				? this.keyConfig(item)
				: String(id)
	}

	// Convert array to record with stable keys
	protected arrayToRecord(array: T[]): ArrayToRecord<T[]> {
		const record = {} as Record<string, T>

		for (let i = 0; i < array.length; i++) {
			const value = array[i]
			if (value === undefined) continue // Skip sparse array positions

			let key = this.order[i]
			if (!key) {
				key = this.generateKey(value)
				this.order[i] = key
			}
			record[key] = value
		}
		return record
	}

	// Validate input
	protected isValidValue(
		key: string,
		value: unknown,
	): value is NonNullable<T> {
		validateSignalValue(`list for key "${key}"`, value)
		return true
	}

	// Add own watcher for nested signal
	protected addOwnWatcher(key: string, signal: MutableSignal<T>) {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				signal.get() // Subscribe to the signal
				if (!this.batching)
					emitNotification(this.listeners.change, [key])
			})
		})
		this.ownWatchers.set(key, watcher)
		watcher()
	}

	// Add nested signal and own watcher
	protected addProperty(key: string, value: T, single = false): boolean {
		if (!this.isValidValue(key, value)) return false

		const signal = createMutableSignal(value) as MutableSignal<T>

		// Set internal states
		this.signals.set(key, signal)
		if (!this.order.includes(key)) this.order.push(key)
		if (this.listeners.change.size) this.addOwnWatcher(key, signal)

		if (single) {
			notifyWatchers(this.watchers)
			emitNotification(this.listeners.add, [key])
		}
		return true
	}

	// Remove nested signal and effect
	protected removeProperty(key: string, single = false) {
		// Remove signal for key
		const ok = this.signals.delete(key)
		if (!ok) return

		// Clean up internal states
		const index = this.order.indexOf(key)
		if (index >= 0) this.order.splice(index, 1)
		const watcher = this.ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			this.ownWatchers.delete(key)
		}

		if (single) {
			this.order = this.order.filter(() => true) // Compact array
			notifyWatchers(this.watchers)
			emitNotification(this.listeners.remove, [key])
		}
	}

	// Commit batched changes and emit notifications
	protected batchChanges(changes: DiffResult, initialRun?: boolean) {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				this.addProperty(key, changes.add[key] as T, false)

			// Queue initial additions event to allow listeners to be added first
			if (initialRun)
				setTimeout(() => {
					emitNotification(
						this.listeners.add,
						Object.keys(changes.add),
					)
				}, 0)
			else emitNotification(this.listeners.add, Object.keys(changes.add))
		}

		// Changes
		if (Object.keys(changes.change).length) {
			this.batching = true
			batchSignalWrites(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!this.isValidValue(key, value)) continue

					const signal = this.signals.get(key)
					if (guardMutableSignal(`list item "${key}"`, value, signal))
						signal.set(value)
				}
			})
			this.batching = false
			emitNotification(this.listeners.change, Object.keys(changes.change))
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove) this.removeProperty(key)
			this.order = this.order.filter(() => true)
			emitNotification(this.listeners.remove, Object.keys(changes.remove))
		}

		return changes.changed
	}

	// Reconcile data and dispatch events
	protected reconcile(
		oldValue: T[],
		newValue: T[],
		initialRun?: boolean,
	): boolean {
		return this.batchChanges(
			diff(this.arrayToRecord(oldValue), this.arrayToRecord(newValue)),
			initialRun,
		)
	}

	// Public methods
	get [Symbol.toStringTag](): 'List' {
		return TYPE_LIST
	}

	get [Symbol.isConcatSpreadable](): boolean {
		return true
	}

	*[Symbol.iterator](): IterableIterator<MutableSignal<T>> {
		for (const key of this.order) {
			const signal = this.signals.get(key)
			if (signal) yield signal as MutableSignal<T>
		}
	}

	get length(): number {
		subscribeActiveWatcher(this.watchers)
		return this.signals.size
	}

	get(): T[] {
		subscribeActiveWatcher(this.watchers)
		return this.order
			.map(key => this.signals.get(key)?.get())
			.filter(v => v !== undefined) as T[]
	}

	set(newValue: T[]): void {
		if (this.reconcile(this.get(), newValue)) {
			notifyWatchers(this.watchers)
			if (UNSET === newValue) this.watchers.clear()
		}
	}

	update(fn: (oldValue: T[]) => T[]): void {
		this.set(fn(this.get()))
	}

	at(index: number): MutableSignal<T> | undefined {
		return this.signals.get(this.order[index])
	}

	keys(): IterableIterator<string> {
		return this.order.values()
	}

	byKey(key: string): MutableSignal<T> | undefined {
		return this.signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.order[index]
	}

	indexOfKey(key: string): number {
		return this.order.indexOf(key)
	}

	add(value: T): string {
		const key = this.generateKey(value)
		if (!this.signals.has(key)) {
			this.addProperty(key, value, true)
			return key
		} else throw new DuplicateKeyError('store', key, value)
	}

	remove(keyOrIndex: string | number): void {
		const key = isNumber(keyOrIndex) ? this.order[keyOrIndex] : keyOrIndex
		if (key && this.signals.has(key)) this.removeProperty(key, true)
	}

	sort(compareFn?: (a: T, b: T) => number): void {
		const entries = this.order
			.map(key => [key, this.signals.get(key)?.get()] as [string, T])
			.sort(
				isFunction(compareFn)
					? (a, b) => compareFn(a[1], b[1])
					: (a, b) => String(a[1]).localeCompare(String(b[1])),
			)
		const newOrder = entries.map(([key]) => key)

		if (!isEqual(this.order, newOrder)) {
			this.order = newOrder
			notifyWatchers(this.watchers)
			emitNotification(this.listeners.sort, this.order)
		}
	}

	splice(start: number, deleteCount?: number, ...items: T[]): T[] {
		// Normalize start and deleteCount
		const length = this.signals.size
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
			const key = this.order[index]
			if (key) {
				const signal = this.signals.get(key)
				if (signal) remove[key] = signal.get() as T
			}
		}

		// Build new order: items before splice point
		const newOrder = this.order.slice(0, actualStart)

		// Add new items
		for (const item of items) {
			const key = this.generateKey(item)
			newOrder.push(key)
			add[key] = item as T
		}

		// Add items after splice point
		newOrder.push(...this.order.slice(actualStart + actualDeleteCount))

		// Update the order array
		this.order = newOrder.filter(() => true) // Compact array

		const changed = !!(
			Object.keys(add).length || Object.keys(remove).length
		)

		if (changed)
			this.batchChanges({
				add,
				change: {} as Record<string, T>,
				remove,
				changed,
			})

		notifyWatchers(this.watchers)

		return Object.values(remove) as T[]
	}

	on<K extends keyof Notifications>(type: K, listener: Listener<K>): Cleanup {
		this.listeners[type].add(listener)
		if (type === 'change' && !this.ownWatchers.size) {
			// Set up watchers for existing signals
			this.batching = true
			for (const [key, signal] of this.signals)
				this.addOwnWatcher(key, signal)

			// Start watchers after setup is complete
			for (const watcher of this.ownWatchers.values()) watcher()
			this.batching = false
		}
		return () => {
			this.listeners[type].delete(listener)
			if (type === 'change' && !this.listeners.change.size) {
				if (this.ownWatchers.size) {
					for (const watcher of this.ownWatchers.values())
						watcher.stop()
					this.ownWatchers.clear()
				}
			}
		}
	}

	deriveCollection<U extends {}>(
		callback: CollectionCallback<U, T extends UnknownArray ? T : never>,
	): Collection<U> {
		// @ts-expect-error proxy type issue
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
			if (prop in target) return Reflect.get(target, prop)
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
