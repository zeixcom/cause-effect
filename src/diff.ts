import { CircularDependencyError } from './errors'
import { UNSET } from './system'
import { isNonNullObject, isRecord, isRecordOrArray } from './util'

/* === Types === */

type UnknownRecord = Record<string, unknown>
type UnknownArray = ReadonlyArray<unknown & {}>

type DiffResult = {
	changed: boolean
	add: UnknownRecord
	change: UnknownRecord
	remove: UnknownRecord
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
	if (!isNonNullObject(a) || !isNonNullObject(b)) return false

	// Cycle detection
	if (!visited) visited = new WeakSet()
	if (visited.has(a as object) || visited.has(b as object))
		throw new CircularDependencyError('isEqual')
	visited.add(a)
	visited.add(b)

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
				if (!isEqual(a[key], b[key], visited)) return false
			}
			return true
		}

		// For non-records/non-arrays, they are only equal if they are the same reference
		// (which would have been caught by Object.is at the beginning)
		return false
	} finally {
		visited.delete(a)
		visited.delete(b)
	}
}

/**
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult} The result of the comparison
 */
const diff = <T extends UnknownRecord>(oldObj: T, newObj: T): DiffResult => {
	// Guard against non-objects that can't be diffed properly with Object.keys and 'in' operator
	const oldValid = isRecordOrArray(oldObj)
	const newValid = isRecordOrArray(newObj)
	if (!oldValid || !newValid) {
		// For non-objects or non-plain objects, treat as complete change if different
		const changed = !Object.is(oldObj, newObj)
		return {
			changed,
			add: changed && newValid ? newObj : {},
			change: {},
			remove: changed && oldValid ? oldObj : {},
		}
	}

	const visited = new WeakSet()

	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord

	const oldKeys = Object.keys(oldObj)
	const newKeys = Object.keys(newObj)
	const allKeys = new Set([...oldKeys, ...newKeys])

	for (const key of allKeys) {
		const oldHas = key in oldObj
		const newHas = key in newObj

		if (!oldHas && newHas) {
			add[key] = newObj[key]
			continue
		} else if (oldHas && !newHas) {
			remove[key] = UNSET
			continue
		}

		const oldValue = oldObj[key]
		const newValue = newObj[key]

		if (!isEqual(oldValue, newValue, visited)) change[key] = newValue
	}

	return {
		add,
		change,
		remove,
		changed: !!(
			Object.keys(add).length ||
			Object.keys(change).length ||
			Object.keys(remove).length
		),
	}
}

/* === Exports === */

export { type DiffResult, diff, isEqual, type UnknownRecord, type UnknownArray }
