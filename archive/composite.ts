import type { DiffResult, UnknownRecord } from '../src/diff'
import { guardMutableSignal } from '../src/errors'
import type { Signal } from '../src/signal'
import { batch } from '../src/system'

/* === Class Definitions === */

class Composite<T extends UnknownRecord, S extends Signal<T[keyof T] & {}>> {
	signals = new Map<string, S>()
	#validate: <K extends keyof T & string>(
		key: K,
		value: unknown,
	) => value is T[K] & {}
	#create: <V extends T[keyof T] & {}>(value: V) => S

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
		this.change({
			add: values,
			change: {},
			remove: {},
			changed: true,
		})
	}

	add<K extends keyof T & string>(key: K, value: T[K]): boolean {
		if (!this.#validate(key, value)) return false

		this.signals.set(key, this.#create(value))
		return true
	}

	remove<K extends keyof T & string>(key: K): boolean {
		return this.signals.delete(key)
	}

	change(changes: DiffResult): boolean {
		// Additions
		if (Object.keys(changes.add).length) {
			for (const key in changes.add)
				this.add(
					key as Extract<keyof T, string>,
					changes.add[key] as T[Extract<keyof T, string>] & {},
				)
		}

		// Changes
		if (Object.keys(changes.change).length) {
			batch(() => {
				for (const key in changes.change) {
					const value = changes.change[key]
					if (!this.#validate(key as keyof T & string, value))
						continue

					const signal = this.signals.get(key)
					if (guardMutableSignal(`list item "${key}"`, value, signal))
						signal.set(value)
				}
			})
		}

		// Removals
		if (Object.keys(changes.remove).length) {
			for (const key in changes.remove)
				this.remove(key as keyof T & string)
		}

		return changes.changed
	}

	clear(): boolean {
		this.signals.clear()
		return true
	}
}

export { Composite }
