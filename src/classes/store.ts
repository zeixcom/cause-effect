import { type DiffResult, diff, type UnknownRecord } from '../diff'
import {
	DuplicateKeyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreKeyReadonlyError,
} from '../errors'
import { isMutableSignal, type Signal } from '../signal'
import { isComputed } from '../signals/computed'
import type { List } from '../signals/list'
import {
	batchSignalWrites,
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
import { isFunction, isObjectOfType, isRecord, isSymbol, UNSET } from '../util'
import { createList, isList } from './list'
import { isState, State } from './state'

/* === Types === */

/* === Constants === */

const TYPE_STORE = 'Store' as const

/* === Store Implementation === */

class Store<T extends UnknownRecord> {
	protected watchers = new Set<Watcher>()
	protected listeners: Omit<Listeners, 'sort'> = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
	}
	protected signals = new Map<
		string,
		Signal<T[Extract<keyof T, string>] & {}>
	>()
	protected ownWatchers = new Map<string, Watcher>()

	constructor(initialValue: T) {
		if (initialValue == null) throw new NullishSignalValueError('store')

		// Initialize data
		this.reconcile({} as T, initialValue, true)
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

	protected addOwnWatcher<K extends keyof T & string>(
		key: K,
		signal: Signal<T[K]>,
	) {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				signal.get() // Subscribe to the signal
				emitNotification(this.listeners.change, [key])
			})
		})
		this.ownWatchers.set(key, watcher)
	}

	// Add nested signal and effect
	protected addProperty<K extends keyof T & string>(
		key: K,
		value: T[K] & {},
		single = false,
	): boolean {
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
		// @ts-expect-error non-matching signal types
		if (this.listeners.change.size) this.addOwnWatcher(key, signal)

		if (single) {
			notifyWatchers(this.watchers)
			emitNotification(this.listeners.add, [key])
		}
		return true
	}

	// Remove nested signal and effect
	protected removeProperty<K extends keyof T & string>(
		key: K,
		single = false,
	) {
		// Remove signal for key
		const ok = this.signals.delete(key)
		if (!ok) return

		// Clean up internal states
		const watcher = this.ownWatchers.get(key)
		if (watcher) {
			watcher.stop()
			this.ownWatchers.delete(key)
		}

		if (single) {
			notifyWatchers(this.watchers)
			emitNotification(this.listeners.remove, [key])
		}
	}

	// Commit batched changes and emit notifications
	protected batchChanges(changes: DiffResult, initialRun?: boolean) {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				this.addProperty(
					key,
					changes.add[key] as T[Extract<keyof T, string>],
					false,
				)

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
			emitNotification(this.listeners.remove, Object.keys(changes.remove))
		}

		return changes.changed
	}

	// Reconcile data and dispatch events
	protected reconcile(
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean {
		return this.batchChanges(diff(oldValue, newValue), initialRun)
	}

	// Public methods
	get [Symbol.toStringTag](): 'Store' {
		return TYPE_STORE
	}

	*[Symbol.iterator](): IterableIterator<
		[string, Signal<T[Extract<keyof T, string>]>]
	> {
		for (const [key, signal] of this.signals) yield [key, signal]
	}

	get(): T {
		subscribeActiveWatcher(this.watchers)
		const record = {} as Record<string, unknown>
		for (const [key, signal] of this.signals) record[key] = signal.get()
		return record as T
	}

	set(newValue: T): void {
		if (this.reconcile(this.get(), newValue)) {
			notifyWatchers(this.watchers)
			if (UNSET === newValue) this.watchers.clear()
		}
	}

	keys(): IterableIterator<string> {
		return this.signals.keys()
	}

	byKey(key: string) {
		return this.signals.get(key)
	}

	update(fn: (oldValue: T) => T): void {
		this.set(fn(this.get()))
	}

	add<K extends keyof T & string>(key: K, value: T[K]): K {
		if (this.signals.has(key))
			throw new DuplicateKeyError('store', key, value)

		this.addProperty(key, value ?? UNSET, true)
		return key
	}

	remove(key: string): void {
		if (this.signals.has(key)) this.removeProperty(key, true)
	}

	on<K extends keyof Omit<Listeners, 'sort'>>(
		type: K,
		listener: Listener<K>,
	): Cleanup {
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
}

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - Initial object or array value of the store
 * @returns {Store<T>} - New store with reactive properties that preserves the original type T
 */
const createStore = <T extends UnknownRecord>(initialValue: T): Store<T> => {
	const instance = new Store(initialValue)

	// Return proxy for property access
	return new Proxy(instance, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (!isSymbol(prop)) return target.byKey(prop)
		},
		has(target, prop) {
			if (prop in target) return true
			return target.byKey(String(prop)) !== undefined
		},
		ownKeys(target) {
			return Array.from(target.keys())
		},
		getOwnPropertyDescriptor(target, prop) {
			if (isSymbol(prop)) return undefined

			const signal = target.byKey(prop)
			return signal
				? {
						enumerable: true,
						configurable: true,
						writable: true,
						value: signal,
					}
				: undefined
		},
	}) as Store<T> & {
		[K in keyof T]: T[K] extends readonly (infer U extends {})[]
			? List<U>
			: T extends Record<string, unknown>
				? Store<T[K]>
				: State<T[K]>
	}
}

/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
const isStore = <T extends UnknownRecord>(value: unknown): value is Store<T> =>
	isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export { createStore, isStore, Store, TYPE_STORE }
