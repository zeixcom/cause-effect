import { describe, expect, test } from 'bun:test'
import {
	InvalidCallbackError,
	InvalidSignalValueError,
	isAsyncFunction,
	isFunction,
	isRecord,
} from '../index.ts'
// isSyncFunction is internal-only (not re-exported from index.ts), so import
// from source to exercise it directly.
import { isSyncFunction, valueString } from '../src/util'

/* === Tests === */

describe('util', () => {
	describe('isFunction', () => {
		test('returns true for functions', () => {
			expect(isFunction(() => {})).toBe(true)
			expect(isFunction(() => {})).toBe(true)
			expect(isFunction(async () => {})).toBe(true)
		})

		test('returns false for non-functions', () => {
			expect(isFunction(null)).toBe(false)
			expect(isFunction(42)).toBe(false)
			expect(isFunction('str')).toBe(false)
			expect(isFunction({})).toBe(false)
		})
	})

	describe('isAsyncFunction', () => {
		test('returns true for async functions', () => {
			expect(isAsyncFunction(async () => {})).toBe(true)
			expect(isAsyncFunction(async () => {})).toBe(true)
		})

		test('returns false for sync functions', () => {
			expect(isAsyncFunction(() => {})).toBe(false)
			expect(isAsyncFunction(() => {})).toBe(false)
		})

		test('returns false for a sync function returning a Promise (footgun, smell #8)', () => {
			// A regular function that returns a Promise is NOT classified as
			// async. This means deriveCell routes it to deriveComputed,
			// caching the Promise itself. Documented behavior — locking it in.
			const promiseReturning = (): Promise<number> => Promise.resolve(42)
			expect(isAsyncFunction(promiseReturning)).toBe(false)
		})

		test('returns false for non-functions', () => {
			expect(isAsyncFunction(null)).toBe(false)
			expect(isAsyncFunction(42)).toBe(false)
		})
	})

	describe('isSyncFunction', () => {
		test('returns true for sync functions', () => {
			expect(isSyncFunction(() => {})).toBe(true)
			expect(isSyncFunction(() => {})).toBe(true)
		})

		test('returns false for async functions', () => {
			expect(isSyncFunction(async () => {})).toBe(false)
		})

		test('returns false for non-functions', () => {
			expect(isSyncFunction(null)).toBe(false)
			expect(isSyncFunction(42)).toBe(false)
		})
	})

	describe('isRecord', () => {
		test('returns true for plain objects', () => {
			expect(isRecord({})).toBe(true)
			expect(isRecord({ a: 1 })).toBe(true)
		})

		test('returns false for null and primitives', () => {
			expect(isRecord(null)).toBe(false)
			expect(isRecord(undefined)).toBe(false)
			expect(isRecord(42)).toBe(false)
			expect(isRecord('str')).toBe(false)
			expect(isRecord(true)).toBe(false)
		})

		test('returns false for arrays', () => {
			expect(isRecord([])).toBe(false)
			expect(isRecord([1, 2, 3])).toBe(false)
		})

		test('returns false for Object.create(null) (null prototype)', () => {
			expect(isRecord(Object.create(null))).toBe(false)
		})

		test('returns false for class instances', () => {
			class Foo {
				x = 1
			}
			expect(isRecord(new Foo())).toBe(false)
		})

		test('returns false for Map, Set, Date, RegExp', () => {
			expect(isRecord(new Map())).toBe(false)
			expect(isRecord(new Set())).toBe(false)
			expect(isRecord(new Date())).toBe(false)
			expect(isRecord(/foo/)).toBe(false)
		})
	})

	describe('valueString', () => {
		test('should format strings in double quotes', () => {
			expect(valueString('hello')).toBe('"hello"')
		})

		test('should format numbers as-is', () => {
			expect(valueString(42)).toBe('42')
		})

		test('should format null and undefined without throwing', () => {
			expect(valueString(null)).toBe('null')
			expect(valueString(undefined)).toBe('undefined')
		})

		test('should format falsy values like 0 and false', () => {
			expect(valueString(0)).toBe('0')
			expect(valueString(false)).toBe('false')
		})

		test('should JSON.stringify plain objects', () => {
			expect(valueString({ a: 1 })).toBe('{"a":1}')
		})

		test('should JSON.stringify arrays', () => {
			expect(valueString([1, 2, 3])).toBe('[1,2,3]')
		})

		test('should not throw on circular references', () => {
			const circular: Record<string, unknown> = { name: 'root' }
			circular.self = circular
			// Must not throw a secondary TypeError about circular structure.
			expect(() => valueString(circular)).not.toThrow()
			// Should fall back to a non-empty string representation.
			expect(typeof valueString(circular)).toBe('string')
		})
	})

	describe('Error constructors with circular values', () => {
		// Constructing these errors must not mask the original validation
		// failure with a "Converting circular structure to JSON" TypeError.
		// (Note: we construct directly rather than via expect().not.toThrow(),
		// because bun's matcher treats Error construction itself as a throw.)
		test('InvalidSignalValueError does not throw on circular value', () => {
			const circular: Record<string, unknown> = { name: 'root' }
			circular.self = circular
			let err: InvalidSignalValueError | undefined
			let secondary: unknown
			try {
				err = new InvalidSignalValueError('State', circular)
			} catch (e) {
				secondary = e
			}
			expect(secondary).toBeUndefined()
			expect(err).toBeInstanceOf(InvalidSignalValueError)
			expect(err?.message).toContain('Signal value')
		})

		test('InvalidCallbackError does not throw on circular value', () => {
			const circular: Record<string, unknown> = { name: 'root' }
			circular.self = circular
			let err: InvalidCallbackError | undefined
			let secondary: unknown
			try {
				err = new InvalidCallbackError('State', circular)
			} catch (e) {
				secondary = e
			}
			expect(secondary).toBeUndefined()
			expect(err).toBeInstanceOf(InvalidCallbackError)
			expect(err?.message).toContain('Callback')
		})
	})
})
