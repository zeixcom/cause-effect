import { describe, expect, test } from 'bun:test'
import {
	InvalidCallbackError,
	InvalidSignalValueError,
	valueString,
} from '../index.ts'

/* === Tests === */

describe('util', () => {
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

		test('should not throw on circular references (bug #7)', () => {
			const circular: Record<string, unknown> = { name: 'root' }
			circular.self = circular
			// Must not throw a secondary TypeError about circular structure.
			expect(() => valueString(circular)).not.toThrow()
			// Should fall back to a non-empty string representation.
			expect(typeof valueString(circular)).toBe('string')
		})
	})

	describe('Error constructors with circular values (bug #7)', () => {
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
			expect(err!.message).toContain('Signal value')
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
			expect(err!.message).toContain('Callback')
		})
	})
})
