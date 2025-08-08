import { describe, expect, test } from 'bun:test'
import { isComputed, isState, state } from '../'

/* === Tests === */

describe('State', () => {
	describe('State type guard', () => {
		test('isState identifies state signals', () => {
			const count = state(42)
			expect(isState(count)).toBe(true)
			expect(isComputed(count)).toBe(false)
		})
	})

	describe('Boolean cause', () => {
		test('should be boolean', () => {
			const cause = state(false)
			expect(typeof cause.get()).toBe('boolean')
		})

		test('should set initial value to false', () => {
			const cause = state(false)
			expect(cause.get()).toBe(false)
		})

		test('should set initial value to true', () => {
			const cause = state(true)
			expect(cause.get()).toBe(true)
		})

		test('should set new value with .set(true)', () => {
			const cause = state(false)
			cause.set(true)
			expect(cause.get()).toBe(true)
		})

		test('should toggle initial value with .set(v => !v)', () => {
			const cause = state(false)
			cause.update(v => !v)
			expect(cause.get()).toBe(true)
		})
	})

	describe('Number cause', () => {
		test('should be number', () => {
			const cause = state(0)
			expect(typeof cause.get()).toBe('number')
		})

		test('should set initial value to 0', () => {
			const cause = state(0)
			expect(cause.get()).toBe(0)
		})

		test('should set new value with .set(42)', () => {
			const cause = state(0)
			cause.set(42)
			expect(cause.get()).toBe(42)
		})

		test('should increment value with .set(v => ++v)', () => {
			const cause = state(0)
			cause.update(v => ++v)
			expect(cause.get()).toBe(1)
		})
	})

	describe('String cause', () => {
		test('should be string', () => {
			const cause = state('foo')
			expect(typeof cause.get()).toBe('string')
		})

		test('should set initial value to "foo"', () => {
			const cause = state('foo')
			expect(cause.get()).toBe('foo')
		})

		test('should set new value with .set("bar")', () => {
			const cause = state('foo')
			cause.set('bar')
			expect(cause.get()).toBe('bar')
		})

		test('should upper case value with .set(v => v.toUpperCase())', () => {
			const cause = state('foo')
			cause.update(v => (v ? v.toUpperCase() : ''))
			expect(cause.get()).toBe('FOO')
		})
	})

	describe('Array cause', () => {
		test('should be array', () => {
			const cause = state([1, 2, 3])
			expect(Array.isArray(cause.get())).toBe(true)
		})

		test('should set initial value to [1, 2, 3]', () => {
			const cause = state([1, 2, 3])
			expect(cause.get()).toEqual([1, 2, 3])
		})

		test('should set new value with .set([4, 5, 6])', () => {
			const cause = state([1, 2, 3])
			cause.set([4, 5, 6])
			expect(cause.get()).toEqual([4, 5, 6])
		})

		test('should reflect current value of array after modification', () => {
			const array = [1, 2, 3]
			const cause = state(array)
			array.push(4) // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})

		test('should set new value with .set([...array, 4])', () => {
			const array = [1, 2, 3]
			const cause = state(array)
			cause.set([...array, 4]) // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})
	})

	describe('Object cause', () => {
		test('should be object', () => {
			const cause = state({ a: 'a', b: 1 })
			expect(typeof cause.get()).toBe('object')
		})

		test('should set initial value to { a: "a", b: 1 }', () => {
			const cause = state({ a: 'a', b: 1 })
			expect(cause.get()).toEqual({ a: 'a', b: 1 })
		})

		test('should set new value with .set({ c: true })', () => {
			const cause = state<Record<string, unknown>>({ a: 'a', b: 1 })
			cause.set({ c: true })
			expect(cause.get()).toEqual({ c: true })
		})

		test('should reflect current value of object after modification', () => {
			const obj = { a: 'a', b: 1 }
			const cause = state<Record<string, unknown>>(obj)
			// @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
			obj.c = true // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})

		test('should set new value with .set({...obj, c: true})', () => {
			const obj = { a: 'a', b: 1 }
			const cause = state<Record<string, unknown>>(obj)
			cause.set({ ...obj, c: true }) // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})
	})
})
