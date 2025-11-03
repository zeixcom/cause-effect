import { UNSET } from './signal'
import {
	arrayToRecord,
	CircularDependencyError,
	isPrimitive,
	isRecord,
} from './util'

/* === Types === */

type DiffResult<
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
> = {
	changed: boolean
	add: Partial<T>
	change: Partial<T>
	remove: Partial<T>
}

/* === Functions === */

const diff = <
	T extends Record<string, unknown & {}> = Record<string, unknown & {}>,
>(
	oldObj: T,
	newObj: T,
): DiffResult<T> => {
	const visited = new WeakSet<object>()

	const diffInternal = (
		oldValue: unknown & {},
		newValue: unknown & {},
		path: string = 'root',
	): { changed: boolean; value?: unknown & {} } => {
		if (isPrimitive(oldValue) || isPrimitive(newValue))
			return { changed: !Object.is(oldValue, newValue), value: newValue }
		if (Array.isArray(oldValue) !== Array.isArray(newValue))
			return { changed: true, value: newValue }

		// Cycle detection
		if (visited.has(oldValue))
			throw new CircularDependencyError(`${path} (old value)`)
		if (visited.has(newValue))
			throw new CircularDependencyError(`${path} (new value)`)

		// Add to visited set for cycle detection
		visited.add(oldValue)
		visited.add(newValue)

		try {
			// Array comparison
			if (Array.isArray(oldValue) && Array.isArray(newValue)) {
				if (oldValue.length !== newValue.length)
					return { changed: true, value: newValue }

				const nested = diffRecords(
					arrayToRecord(oldValue),
					arrayToRecord(newValue),
					`${path}[array]`,
				)

				return { changed: nested.changed, value: newValue }
			}

			// Object comparison
			if (isRecord(oldValue) && isRecord(newValue)) {
				const nested = diffRecords(
					oldValue,
					newValue,
					`${path}[object]`,
				)
				return { changed: nested.changed, value: newValue }
			}

			return { changed: !Object.is(oldValue, newValue), value: newValue }
		} finally {
			visited.delete(oldValue)
			visited.delete(newValue)
		}
	}

	const diffRecords = (
		oldRecord: Record<string, unknown>,
		newRecord: Record<string, unknown>,
		path: string,
	): DiffResult<T> => {
		const add: Partial<T> = {}
		const change: Partial<T> = {}
		const remove: Partial<T> = {}

		const oldKeys = Object.keys(oldRecord)
		const newKeys = Object.keys(newRecord)
		const allKeys = new Set([...oldKeys, ...newKeys])

		for (const key of allKeys) {
			const oldHas = key in oldRecord
			const newHas = key in newRecord

			if (!oldHas && newHas) {
				add[key as keyof T] = newRecord[key] as T[keyof T]
				continue
			} else if (oldHas && !newHas) {
				remove[key as keyof T] = UNSET
				continue
			}

			const result = diffInternal(
				oldRecord[key] as T[keyof T],
				newRecord[key] as T[keyof T],
				`${path}.${key}`,
			)

			if (result.changed)
				change[key as keyof T] = result.value as T[keyof T]
		}

		const changed =
			Object.keys(add).length > 0 ||
			Object.keys(change).length > 0 ||
			Object.keys(remove).length > 0

		return {
			changed,
			add,
			change,
			remove,
		}
	}

	// Handle edge cases for the main function inputs
	if (!isRecord(oldObj) || !isRecord(newObj)) {
		throw new Error(
			'diff() requires both arguments to be records (plain objects)',
		)
	}

	return diffRecords(oldObj, newObj, 'root')
}

/* === Exports === */

export { type DiffResult, diff }
