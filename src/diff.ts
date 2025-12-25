import { CircularDependencyError } from './errors'
import { isRecord, isRecordOrArray, UNSET } from './util'

/* === Types === */

type UnknownRecord = Record<string, unknown & {}>
type UnknownArray = ReadonlyArray<unknown & {}>

type ArrayToRecord<T extends UnknownArray> = {
	[key: string]: T extends Array<infer U extends {}> ? U : never
}

type PartialRecord<T> = T extends UnknownArray
	? Partial<ArrayToRecord<T>>
	: Partial<T>

type DiffResult<T extends UnknownRecord | UnknownArray = UnknownRecord> = {
	changed: boolean
	add: PartialRecord<T>
	change: PartialRecord<T>
	remove: PartialRecord<T>
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

		// For non-records/non-arrays, they are only equal if they are the same reference
		// (which would have been caught by Object.is at the beginning)
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
const diff = <T extends UnknownRecord | UnknownArray>(
	oldObj: T extends UnknownArray ? ArrayToRecord<T> : T,
	newObj: T extends UnknownArray ? ArrayToRecord<T> : T,
): DiffResult<T> => {
	// Guard against non-objects that can't be diffed properly with Object.keys and 'in' operator
	const oldValid = isRecordOrArray(oldObj)
	const newValid = isRecordOrArray(newObj)
	if (!oldValid || !newValid) {
		// For non-objects or non-plain objects, treat as complete change if different
		const changed = !Object.is(oldObj, newObj)
		return {
			changed,
			add: changed && newValid ? newObj : ({} as PartialRecord<T>),
			change: {} as PartialRecord<T>,
			remove: changed && oldValid ? oldObj : ({} as PartialRecord<T>),
		}
	}

	const visited = new WeakSet()

	const add = {} as PartialRecord<T>
	const change = {} as PartialRecord<T>
	const remove = {} as PartialRecord<T>

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

export {
	type ArrayToRecord,
	type DiffResult,
	diff,
	isEqual,
	type UnknownRecord,
	type UnknownArray,
	type PartialRecord,
}
