import { type DiffResult, diff, type UnknownArray } from '../diff'
import {
	DuplicateKeyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreIndexRangeError,
	StoreKeyReadonlyError,
} from '../errors'
import { isMutableSignal, type Signal } from '../signal'
import {
	type Collection,
	type CollectionCallback,
	createCollection,
} from '../signals/collection'
import { isComputed } from '../signals/computed'
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
	isRecord,
	isString,
	isSymbol,
	UNSET,
} from '../util'
import { isState, State } from './state'
import { createStore, isStore } from './store'

/* === Types === */

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type KeyConfig<T> = string | ((item: T) => string)

/* === Constants === */

const TYPE_LIST = 'List' as const

/* === List Implementation === */

class List<T extends {}> {
	protected watchers = new Set<Watcher>()
	protected listeners: Listeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
		sort: new Set<Listener<'sort'>>(),
	}
	protected signals = new Map<string, Signal<T>>()
	protected _order: string[] = []
	protected ownWatchers = new Map<string, Watcher>()
	protected keyCounter = 0
	protected keyConfig?: KeyConfig<T>

	constructor(initialValue: T[], keyConfig?: KeyConfig<T>) {
		if (initialValue == null) throw new NullishSignalValueError('store')

		this.keyConfig = keyConfig

		// Initialize data
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

			let key = this._order[i]
			if (!key) {
				key = this.generateKey(value)
				this._order[i] = key
			}
			record[key] = value
		}
		return record
	}

	// Validate input
	protected isValidValue<V>(key: string, value: V): value is NonNullable<V> {
		if (value == null)
			throw new NullishSignalValueError(`store for key "${key}"`)
		if (value === UNSET) return true
		if (isSymbol(value) || isFunction(value) || isComputed(value))
			throw new InvalidSignalValueError(`store for key "${key}"`, value)
		return true
	}

	// Add own watcher for nested signal
	protected addOwnWatcher(key: string, signal: Signal<T>) {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				signal.get() // Subscribe to the signal
				emitNotification(this.listeners.change, [key])
			})
		})
		this.ownWatchers.set(key, watcher)
	}

	// Add nested signal and own watcher
	protected addProperty(key: string, value: T, single = false): boolean {
		if (!this.isValidValue(key, value)) return false

		// Create signal for key
		const signal =
			isState(value) || isStore(value) || isList(value)
				? (value as unknown as Signal<T>)
				: isRecord(value)
					? createStore(value)
					: Array.isArray(value)
						? createList(value)
						: new State(value)

		// Set internal states
		// @ts-expect-error non-matching signal types
		this.signals.set(key, signal)
		if (!this._order.includes(key)) this._order.push(key)
		// @ts-expect-error non-matching signal types
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
		const index = this._order.indexOf(key)
		if (index >= 0) this._order.splice(index, 1)
		const watcher = this.ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			this.ownWatchers.delete(key)
		}

		if (single) {
			this._order = this._order.filter(() => true) // Compact array
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
			batchSignalWrites(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!this.isValidValue(key, value)) continue

					const signal = this.signals.get(key)
					if (isMutableSignal(signal)) signal.set(value)
					else throw new StoreKeyReadonlyError(key, value)
				}
				emitNotification(
					this.listeners.change,
					Object.keys(changes.change),
				)
			})
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove) this.removeProperty(key)
			this._order = this._order.filter(() => true)
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

	*[Symbol.iterator](): IterableIterator<Signal<T>> {
		for (const key of this._order) {
			const signal = this.signals.get(key)
			if (signal) yield signal
		}
	}

	get length(): number {
		subscribeActiveWatcher(this.watchers)
		return this.signals.size
	}

	get order(): string[] {
		subscribeActiveWatcher(this.watchers)
		return this._order
	}

	get(): T[] {
		subscribeActiveWatcher(this.watchers)
		return this._order
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

	at(index: number): Signal<T> | undefined {
		return this.signals.get(this._order[index])
	}

	byKey(key: string): Signal<T> | undefined {
		return this.signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this._order[index]
	}

	indexOfKey(key: string): number {
		return this._order.indexOf(key)
	}

	add(value: T): string {
		const key = this.generateKey(value)
		if (!this.signals.has(key)) {
			this.addProperty(key, value, true)
			return key
		} else throw new DuplicateKeyError('store', key, value)
	}

	remove(keyOrIndex: string | number): void {
		let key = String(keyOrIndex)
		if (isNumber(keyOrIndex)) {
			if (!this._order[keyOrIndex])
				throw new StoreIndexRangeError(keyOrIndex)
			key = this._order[keyOrIndex]
		}
		if (this.signals.has(key)) this.removeProperty(key, true)
	}

	sort(compareFn?: (a: T, b: T) => number): void {
		const entries = this._order
			.map((key, index) => {
				const signal = this.signals.get(key)
				return [index, key, signal?.get()] as [number, string, T]
			})
			.sort(
				compareFn
					? (a, b) => compareFn(a[2], b[2])
					: (a, b) => String(a[2]).localeCompare(String(b[2])),
			)

		// Set new order
		this._order = entries.map(([_, key]) => key)

		notifyWatchers(this.watchers)
		emitNotification(this.listeners.sort, this._order)
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
			const key = this._order[index]
			if (key) {
				const signal = this.signals.get(key)
				if (signal) remove[key] = signal.get() as T
			}
		}

		// Build new order: items before splice point
		const newOrder = this._order.slice(0, actualStart)

		// Add new items
		for (const item of items) {
			const key = this.generateKey(item)
			newOrder.push(key)
			add[key] = item as T
		}

		// Add items after splice point
		newOrder.push(...this._order.slice(actualStart + actualDeleteCount))

		// Update the order array
		this._order = newOrder.filter(() => true) // Compact array

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
			for (const [key, signal] of this.signals)
				this.addOwnWatcher(key, signal)
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
	const instance = new List(initialValue, keyConfig)

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
			const staticKeys = Reflect.ownKeys(target)
			return [...new Set([...target.order, ...staticKeys])]
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
	}) as List<T> & {
		[n: number]: Signal<T>
	}
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
	List,
	TYPE_LIST,
	type ArrayToRecord,
	type KeyConfig,
}
