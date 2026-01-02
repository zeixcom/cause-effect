import type { DiffResult, UnknownRecord } from '../diff'
import { guardMutableSignal } from '../errors'
import type { Signal } from '../signal'
import {
	batchSignalWrites,
	type Cleanup,
	createWatcher,
	emitNotification,
	type Listener,
	type Listeners,
	trackSignalReads,
	type Watcher,
} from '../system'

/* === Types === */

type CompositeListeners = Pick<Listeners, 'add' | 'change' | 'remove'>

/* === Class Definitions === */

class Composite<T extends UnknownRecord, S extends Signal<T[keyof T] & {}>> {
	signals = new Map<string, S>()
	#validate: <K extends keyof T & string>(
		key: K,
		value: unknown,
	) => value is T[K] & {}
	#create: <V extends T[keyof T] & {}>(value: V) => S
	#watchers = new Map<string, Watcher>()
	#listeners: CompositeListeners = {
		add: new Set<Listener<'add'>>(),
		change: new Set<Listener<'change'>>(),
		remove: new Set<Listener<'remove'>>(),
	}
	#batching = false

	constructor(
		values: T,
		validate: <K extends keyof T & string>(
			key: K,
			value: unknown,
		) => value is T[K] & {},
		create: <V extends T[keyof T] & {}>(value: V) => S,
	) {
		this.#validate = validate
		this.#create = create
		this.change(
			{
				add: values,
				change: {},
				remove: {},
				changed: true,
			},
			true,
		)
	}

	#addWatcher(key: string): void {
		const watcher = createWatcher(() => {
			trackSignalReads(watcher, () => {
				this.signals.get(key)?.get() // Subscribe to the signal
				if (!this.#batching)
					emitNotification(this.#listeners.change, [key])
			})
		})
		this.#watchers.set(key, watcher)
		watcher()
	}

	add<K extends keyof T & string>(key: K, value: T[K]): boolean {
		if (!this.#validate(key, value)) return false

		this.signals.set(key, this.#create(value))
		if (this.#listeners.change.size) this.#addWatcher(key)

		if (!this.#batching) emitNotification(this.#listeners.add, [key])
		return true
	}

	remove<K extends keyof T & string>(key: K): boolean {
		const ok = this.signals.delete(key)
		if (!ok) return false

		const watcher = this.#watchers.get(key)
		if (watcher) {
			watcher.stop()
			this.#watchers.delete(key)
		}

		if (!this.#batching) emitNotification(this.#listeners.remove, [key])
		return true
	}

	change(changes: DiffResult, initialRun?: boolean): boolean {
		this.#batching = true

		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				this.add(
					key as Extract<keyof T, string>,
					changes.add[key] as T[Extract<keyof T, string>] & {},
				)

			// Queue initial additions event to allow listeners to be added first
			const notify = () =>
				emitNotification(this.#listeners.add, Object.keys(changes.add))
			if (initialRun) setTimeout(notify, 0)
			else notify()
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batchSignalWrites(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!this.#validate(key as keyof T & string, value))
						continue

					const signal = this.signals.get(key)
					if (guardMutableSignal(`list item "${key}"`, value, signal))
						signal.set(value)
				}
			})
			emitNotification(
				this.#listeners.change,
				Object.keys(changes.change),
			)
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove)
				this.remove(key as keyof T & string)
			emitNotification(
				this.#listeners.remove,
				Object.keys(changes.remove),
			)
		}

		this.#batching = false
		return changes.changed
	}

	clear(): boolean {
		const keys = Array.from(this.signals.keys())
		this.signals.clear()
		this.#watchers.clear()
		emitNotification(this.#listeners.remove, keys)
		return true
	}

	on<K extends keyof CompositeListeners>(
		type: K,
		listener: Listener<K>,
	): Cleanup {
		this.#listeners[type].add(listener)
		if (type === 'change' && !this.#watchers.size) {
			this.#batching = true
			for (const key of this.signals.keys()) this.#addWatcher(key)
			this.#batching = false
		}

		return () => {
			this.#listeners[type].delete(listener)
			if (type === 'change' && !this.#listeners.change.size) {
				if (this.#watchers.size) {
					for (const watcher of this.#watchers.values())
						watcher.stop()
					this.#watchers.clear()
				}
			}
		}
	}
}

export { Composite, type CompositeListeners }
