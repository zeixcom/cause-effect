import {
	type ArrayToRecord,
	diff,
	type UnknownArray,
	type UnknownRecord,
	type UnknownRecordOrArray,
} from './diff'
import { effect } from './effect'
import {
	batch,
	type Cleanup,
	notify,
	subscribe,
	type Watcher,
} from './scheduler'
import { isMutableSignal } from './signal'
import { isState, type State, state } from './state'
import {
	isObjectOfType,
	isRecord,
	isSymbol,
	recordToArray,
	UNSET,
} from './util'

/* === Types === */

type ArrayItem<T> = T extends readonly (infer U extends {})[] ? U : never

type StoreEventMap<T extends UnknownRecord | UnknownArray> = {
	'store-add': StoreAddEvent<T>
	'store-change': StoreChangeEvent<T>
	'store-remove': StoreRemoveEvent<T>
}

interface StoreEventTarget<T extends UnknownRecord | UnknownArray>
	extends EventTarget {
	addEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void

	removeEventListener<K extends keyof StoreEventMap<T>>(
		type: K,
		listener: (event: StoreEventMap<T>[K]) => void,
		options?: boolean | EventListenerOptions,
	): void

	dispatchEvent(event: Event): boolean
}

interface BaseStore<T extends UnknownRecord | UnknownArray>
	extends StoreEventTarget<T> {
	readonly [Symbol.toStringTag]: 'Store'
	get(): T
	set(value: T): void
	update(fn: (value: T) => T): void
	readonly size: State<number>
}

type RecordStore<T extends UnknownRecord> = BaseStore<T> & {
	[K in keyof T]: T[K] extends readonly unknown[] | Record<string, unknown>
		? Store<T[K]>
		: T[K] extends unknown
			? State<T[K]>
			: never
} & {
	add<K extends Extract<keyof T, string>>(key: K, value: T[K]): void
	remove<K extends Extract<keyof T, string>>(key: K): void
	[Symbol.iterator](): IterableIterator<
		[
			Extract<keyof T, string>,
			T[Extract<keyof T, string>] extends
				| readonly unknown[]
				| Record<string, unknown>
				? Store<T[Extract<keyof T, string>]>
				: T[Extract<keyof T, string>] extends unknown
					? State<T[Extract<keyof T, string>]>
					: never,
		]
	>
}

type ArrayStore<T extends UnknownArray> = BaseStore<T> & {
	readonly length: number
	[n: number]: ArrayItem<T> extends
		| readonly unknown[]
		| Record<string, unknown>
		? Store<ArrayItem<T>>
		: ArrayItem<T> extends unknown
			? State<ArrayItem<T>>
			: never
	add(value: ArrayItem<T>): void
	remove(index: number): void
	[Symbol.iterator](): IterableIterator<
		ArrayItem<T> extends readonly unknown[] | Record<string, unknown>
			? Store<ArrayItem<T>>
			: ArrayItem<T> extends unknown
				? State<ArrayItem<T>>
				: never
	>
	readonly [Symbol.isConcatSpreadable]: boolean
}

interface StoreAddEvent<T extends UnknownRecord | UnknownArray>
	extends CustomEvent {
	type: 'store-add'
	detail: Partial<T>
}

interface StoreChangeEvent<T extends UnknownRecord | UnknownArray>
	extends CustomEvent {
	type: 'store-change'
	detail: Partial<T>
}

interface StoreRemoveEvent<T extends UnknownRecord | UnknownArray>
	extends CustomEvent {
	type: 'store-remove'
	detail: Partial<T>
}

type Store<T> = T extends UnknownRecord
	? RecordStore<T>
	: T extends UnknownArray
		? ArrayStore<T>
		: never

/* === Constants === */

const TYPE_STORE = 'Store'

const STORE_EVENT_ADD = 'store-add'
const STORE_EVENT_CHANGE = 'store-change'
const STORE_EVENT_REMOVE = 'store-remove'

/* === Functions === */

/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
const store = <T extends UnknownRecord | UnknownArray>(
	initialValue: T,
): Store<T> => {
	const watchers = new Set<Watcher>()
	const eventTarget = new EventTarget()
	const signals = new Map<
		Extract<keyof T, string>,
		T[Extract<keyof T, string>] extends UnknownRecord | UnknownArray
			? Store<T[Extract<keyof T, string>]>
			: T[Extract<keyof T, string>] extends unknown & {}
				? State<T[Extract<keyof T, string>]>
				: never
	>()
	const cleanups = new Map<Extract<keyof T, string>, Cleanup>()

	// Determine if this is an array-like store at creation time
	const isArrayLike = Array.isArray(initialValue)

	// Internal state
	const size = state(0)

	// Get current record
	const current = () => {
		const record: Record<string, unknown> = {}
		for (const [key, signal] of signals) {
			record[key] = signal.get()
		}
		return record
	}

	// Emit event
	const emit = (type: keyof StoreEventMap<T>, detail: Partial<T>) =>
		eventTarget.dispatchEvent(new CustomEvent(type, { detail }))

	// Get sorted indexes
	const getSortedIndexes = () =>
		Array.from(signals.keys())
			.map(k => Number(k))
			.filter(n => Number.isInteger(n))
			.sort((a, b) => a - b)

	// Add nested signal and effect
	const addProperty = <K extends Extract<keyof T, string>>(
		key: K,
		value: (T[K] & {}) | ArrayItem<T>,
	): boolean => {
		if (isSymbol(key) || value == null) return false
		const signal =
			isState(value) || isStore(value)
				? value
				: isRecord(value)
					? store(value)
					: Array.isArray(value)
						? store(value)
						: state(value)
		// @ts-expect-error non-matching signal type
		signals.set(key, signal)
		const cleanup = effect(() => {
			const currentValue = signal.get()
			if (currentValue != null)
				emit(STORE_EVENT_CHANGE, {
					[key]: currentValue,
				} as unknown as Partial<T>)
		})
		cleanups.set(key, cleanup)
		return true
	}

	// Remove nested signal and effect
	const removeProperty = <K extends Extract<keyof T, string>>(key: K) => {
		const ok = signals.delete(key)
		if (ok) {
			const cleanup = cleanups.get(key)
			if (cleanup) cleanup()
			cleanups.delete(key)
		}
		return ok
	}

	// Reconcile data and dispatch events
	const reconcile = (
		oldValue: T,
		newValue: T,
		initialRun?: boolean,
	): boolean => {
		const changes = diff(
			oldValue as T extends UnknownArray ? ArrayToRecord<T> : T,
			newValue as T extends UnknownArray ? ArrayToRecord<T> : T,
		)

		batch(() => {
			if (Object.keys(changes.add).length) {
				for (const key in changes.add) {
					const value = changes.add[key]
					if (value != null)
						addProperty(
							key as Extract<keyof T, string>,
							value as T[Extract<keyof T, string>] & {},
						)
				}

				// Queue initial additions event to allow listeners to be added first
				if (initialRun) {
					setTimeout(() => {
						emit(STORE_EVENT_ADD, changes.add as Partial<T>)
					}, 0)
				} else {
					emit(STORE_EVENT_ADD, changes.add as Partial<T>)
				}
			}
			if (Object.keys(changes.change).length) {
				for (const key in changes.change) {
					const signal = signals.get(key as Extract<keyof T, string>)
					const value = changes.change[key]
					if (isMutableSignal(signal) && value != null)
						signal.set(value as T[Extract<keyof T, string>] & {})
					else
						console.error(`Invalid change for key ${key}: ${value}`)
				}
				emit(STORE_EVENT_CHANGE, changes.change as Partial<T>)
			}
			if (Object.keys(changes.remove).length) {
				for (const key in changes.remove)
					removeProperty(key as Extract<keyof T, string>)
				emit(STORE_EVENT_REMOVE, changes.remove as Partial<T>)
			}

			size.set(signals.size)
		})

		return changes.changed
	}

	// Initialize data - convert arrays to records for internal storage
	reconcile({} as T, initialValue, true)

	// Methods and Properties
	const s: Record<string, unknown> = {
		add: isArrayLike
			? (v: ArrayItem<T>): void => {
					const nextIndex = signals.size
					const key = String(nextIndex) as Extract<keyof T, string>
					if (v == null) {
						console.error(
							`Invalid value for key ${String(key)}: ${v}`,
						)
						return
					}
					const ok = addProperty(key, v)
					if (ok) {
						size.set(signals.size)
						notify(watchers)
						emit(STORE_EVENT_ADD, {
							[key]: v,
						} as unknown as Partial<T>)
					} else {
						console.error(
							`Failed to add value ${v} to key ${String(key)}`,
						)
					}
				}
			: <K extends Extract<keyof T, string>>(k: K, v: T[K]): void => {
					if (!signals.has(k)) {
						if (v == null) {
							console.error(`Invalid value for key ${k}: ${v}`)
							return
						}
						const ok = addProperty(k, v)
						if (ok) {
							size.set(signals.size)
							notify(watchers)
							emit(STORE_EVENT_ADD, {
								[k]: v,
							} as unknown as Partial<T>)
						} else {
							console.error(
								`Failed to add value ${v} to key ${k}`,
							)
						}
					} else {
						console.error(`Key ${k} already exists`)
					}
				},
		get: (): T => {
			subscribe(watchers)
			return recordToArray(current()) as T
		},
		remove: isArrayLike
			? (index: number): void => {
					const currentArray = recordToArray(current()) as T
					if (
						Array.isArray(currentArray) &&
						index >= 0 &&
						index < currentArray.length
					) {
						const newArray = [...currentArray]
						newArray.splice(index, 1)

						if (reconcile(currentArray, newArray as unknown as T)) {
							notify(watchers)
						}
					}
				}
			: <K extends Extract<keyof T, string>>(k: K): void => {
					if (signals.has(k)) {
						removeProperty(k)
						notify(watchers)
						emit(STORE_EVENT_REMOVE, {
							[k]: UNSET,
						} as Partial<T>)
						size.set(signals.size)
					}
				},
		set: (v: T): void => {
			if (reconcile(current() as T, v)) {
				notify(watchers)
				if (UNSET === v) watchers.clear()
			}
		},
		update: (fn: (v: T) => T): void => {
			const oldValue = current()
			const newValue = fn(recordToArray(oldValue) as T)
			if (reconcile(oldValue as T, newValue)) {
				notify(watchers)
				if (UNSET === newValue) watchers.clear()
			}
		},
		addEventListener: eventTarget.addEventListener.bind(eventTarget),
		removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
		dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
		size,
	}

	// Return proxy directly with integrated signal methods
	return new Proxy({} as Store<T>, {
		get(_target, prop) {
			// Symbols
			if (prop === Symbol.toStringTag) return TYPE_STORE
			if (prop === Symbol.isConcatSpreadable) return isArrayLike
			if (prop === Symbol.iterator)
				return isArrayLike
					? function* () {
							const indexes = getSortedIndexes()
							for (const index of indexes) {
								const signal = signals.get(
									String(index) as Extract<keyof T, string>,
								)
								if (signal) yield signal
							}
						}
					: function* () {
							for (const [key, signal] of signals)
								yield [key, signal]
						}
			if (isSymbol(prop)) return undefined

			// Methods and Properties
			if (prop in s) return s[prop]
			if (prop === 'length' && isArrayLike) {
				subscribe(watchers)
				return size.get()
			}

			// Signals
			return signals.get(prop as Extract<keyof T, string>)
		},
		has(_target, prop) {
			const stringProp = String(prop)
			return (
				(stringProp &&
					signals.has(stringProp as Extract<keyof T, string>)) ||
				Object.keys(s).includes(stringProp) ||
				prop === Symbol.toStringTag ||
				prop === Symbol.iterator ||
				prop === Symbol.isConcatSpreadable ||
				(prop === 'length' && isArrayLike)
			)
		},
		ownKeys() {
			return isArrayLike
				? getSortedIndexes()
						.map(key => String(key))
						.concat(['length'])
				: Array.from(signals.keys()).map(key => String(key))
		},
		getOwnPropertyDescriptor(_target, prop) {
			const nonEnumerable = <T>(value: T) => ({
				enumerable: false,
				configurable: true,
				writable: false,
				value,
			})

			if (prop === 'length' && isArrayLike)
				return {
					enumerable: true,
					configurable: true,
					writable: false,
					value: size.get(),
				}
			if (prop === Symbol.isConcatSpreadable)
				return nonEnumerable(isArrayLike)
			if (prop === Symbol.toStringTag) return nonEnumerable(TYPE_STORE)
			if (isSymbol(prop)) return undefined

			if (Object.keys(s).includes(prop)) return nonEnumerable(s[prop])

			const signal = signals.get(prop as Extract<keyof T, string>)
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

/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a Store instance, false otherwise
 */
const isStore = <T extends UnknownRecordOrArray>(
	value: unknown,
): value is Store<T> => isObjectOfType(value, TYPE_STORE)

/* === Exports === */

export {
	TYPE_STORE,
	isStore,
	store,
	type Store,
	type StoreAddEvent,
	type StoreChangeEvent,
	type StoreRemoveEvent,
	type StoreEventMap,
}
