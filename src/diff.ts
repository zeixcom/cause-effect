import { UNSET } from './signal'
import { CircularDependencyError, isRecord } from './util'

/* === Types === */

type UnknownRecord = Record<string, unknown & {}>

type DiffResult<T extends UnknownRecord = UnknownRecord> = {
	changed: boolean
	add: Partial<T>
	change: Partial<T>
	remove: Partial<T>
}

/* === Functions === */

/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
const isEqual = <T>(a: T, b: T, visited?: WeakSet<object>): boolean => {
	// Fast paths
	if (Object.is(a, b)) return true
	if (typeof a !== typeof b) return false
	if (typeof a !== 'object' || a === null || b === null) return false

	// Cycle detection
	if (!visited) visited = new WeakSet()
	if (visited.has(a as object) || visited.has(b as object))
		throw new CircularDependencyError('isEqual')
	visited.add(a as object)
	visited.add(b as object)

	try {
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false
			for (let i = 0; i < a.length; i++) {
				if (!isEqual(a[i], b[i], visited)) return false
			}
			return true
		}

		if (Array.isArray(a) !== Array.isArray(b)) return false

		if (isRecord(a) && isRecord(b)) {
			const aKeys = Object.keys(a)
			const bKeys = Object.keys(b)

			if (aKeys.length !== bKeys.length) return false
			for (const key of aKeys) {
				if (!(key in b)) return false
				if (
					!isEqual(
						(a as Record<string, unknown>)[key],
						(b as Record<string, unknown>)[key],
						visited,
					)
				)
					return false
			}
			return true
		}

		return false
	} finally {
		visited.delete(a as object)
		visited.delete(b as object)
	}
}

/**
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult<T>} The result of the comparison
 */
const diff = <T extends UnknownRecord>(oldObj: T, newObj: T): DiffResult<T> => {
	const visited = new WeakSet<object>()

	const diffRecords = (
		oldRecord: Record<string, unknown>,
		newRecord: Record<string, unknown>,
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

			const oldValue = oldRecord[key] as T[keyof T]
			const newValue = newRecord[key] as T[keyof T]

			if (!isEqual(oldValue, newValue, visited))
				change[key as keyof T] = newValue
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

	return diffRecords(oldObj, newObj)
}

/* === Exports === */

export { type DiffResult, diff, isEqual, type UnknownRecord }
