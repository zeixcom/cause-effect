import { diff, type UnknownRecord } from '../diff'
import { DuplicateKeyError, validateSignalValue } from '../errors'
import { createMutableSignal, type MutableSignal, type Signal } from '../signal'
import {
	notifyOf,
	registerWatchCallbacks,
	type SignalOptions,
	subscribeTo,
	UNSET,
	unsubscribeAllFrom,
} from '../system'
import { isFunction, isObjectOfType, isRecord, isSymbol } from '../util'
import { Composite } from './composite'
import type { List } from './list'
import type { State } from './state'

/* === Types === */

type Store<T extends UnknownRecord> = BaseStore<T> & {
	[K in keyof T]: T[K] extends readonly (infer U extends {})[]
		? List<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: State<T[K] & {}>
}

/* === Constants === */

const TYPE_STORE = 'Store' as const

/* === Store Implementation === */

/**
 * Create a new store with the given initial value.
 *
 * @since 0.17.0
 * @param {T} initialValue - The initial value of the store
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is not an object
 */
class BaseStore<T extends UnknownRecord> {
	#composite: Composite<T, Signal<T[keyof T] & {}>>

	constructor(initialValue: T, options?: SignalOptions<T>) {
		validateSignalValue(
			TYPE_STORE,
			initialValue,
			options?.guard ?? isRecord,
		)

		this.#composite = new Composite<T, Signal<T[keyof T] & {}>>(
			initialValue,
			<K extends keyof T & string>(
				key: K,
				value: unknown,
			): value is T[K] & {} => {
				validateSignalValue(`${TYPE_STORE} for key "${key}"`, value)
				return true
			},
			value => createMutableSignal(value),
		)
		if (options?.watched)
			registerWatchCallbacks(this, options.watched, options.unwatched)
	}

	get #value(): T {
		const record = {} as UnknownRecord
		for (const [key, signal] of this.#composite.signals.entries())
			record[key] = signal.get()
		return record as T
	}

	// Public methods
	get [Symbol.toStringTag](): 'Store' {
		return TYPE_STORE
	}

	get [Symbol.isConcatSpreadable](): boolean {
		return false
	}

	*[Symbol.iterator](): IterableIterator<
		[string, MutableSignal<T[keyof T] & {}>]
	> {
		for (const [key, signal] of this.#composite.signals.entries())
			yield [key, signal as MutableSignal<T[keyof T] & {}>]
	}

	keys(): IterableIterator<string> {
		return this.#composite.signals.keys()
	}

	byKey<K extends keyof T & string>(
		key: K,
	): T[K] extends readonly (infer U extends {})[]
		? List<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: T[K] extends unknown & {}
				? State<T[K] & {}>
				: State<T[K] & {}> | undefined {
		return this.#composite.signals.get(
			key,
		) as T[K] extends readonly (infer U extends {})[]
			? List<U>
			: T[K] extends UnknownRecord
				? Store<T[K]>
				: T[K] extends unknown & {}
					? State<T[K] & {}>
					: State<T[K] & {}> | undefined
	}

	get(): T {
		subscribeTo(this)
		return this.#value
	}

	set(newValue: T): void {
		if (UNSET === newValue) {
			this.#composite.clear()
			notifyOf(this)
			unsubscribeAllFrom(this)
			return
		}

		const oldValue = this.#value
		const changed = this.#composite.change(diff(oldValue, newValue))
		if (changed) notifyOf(this)
	}

	update(fn: (oldValue: T) => T): void {
		this.set(fn(this.get()))
	}

	add<K extends keyof T & string>(key: K, value: T[K]): K {
		if (this.#composite.signals.has(key))
			throw new DuplicateKeyError(TYPE_STORE, key, value)

		const ok = this.#composite.add(key, value)
		if (ok) notifyOf(this)
		return key
	}

	remove(key: string): void {
		const ok = this.#composite.remove(key)
		if (ok) notifyOf(this)
	}
}

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - Initial object or array value of the store
 * @param {SignalOptions<T>} options - Options for the store
 * @returns {Store<T>} - New store with reactive properties that preserves the original type T
 */
const createStore = <T extends UnknownRecord>(
	initialValue: T,
	options?: SignalOptions<T>,
): Store<T> => {
	const instance = new BaseStore(initialValue, options)

	// Return proxy for property access
	return new Proxy(instance, {
		get(target, prop) {
			if (prop in target) {
				const value = Reflect.get(target, prop)
				return isFunction(value) ? value.bind(target) : value
			}
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
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)
			if (isSymbol(prop)) return undefined

			const signal = target.byKey(String(prop))
			return signal
				? {
						enumerable: true,
						configurable: true,
						writable: true,
						value: signal,
					}
				: undefined
		},
	}) as Store<T>
}

/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
const isStore = <T extends UnknownRecord>(
	value: unknown,
): value is BaseStore<T> => isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export { createStore, isStore, BaseStore, TYPE_STORE, type Store }
