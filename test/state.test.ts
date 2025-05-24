import { describe, test, expect } from 'bun:test'
import { isComputed, isState, state, UNSET } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('State', function () {
	describe('State type guard', () => {
		test('isState identifies state signals', () => {
			const count = state(42)
			expect(isState(count)).toBe(true)
			expect(isComputed(count)).toBe(false)
		})
	})

	describe('Boolean cause', function () {
		test('should be boolean', function () {
			const cause = state(false)
			expect(typeof cause.get()).toBe('boolean')
		})

		test('should set initial value to false', function () {
			const cause = state(false)
			expect(cause.get()).toBe(false)
		})

		test('should set initial value to true', function () {
			const cause = state(true)
			expect(cause.get()).toBe(true)
		})

		test('should set new value with .set(true)', function () {
			const cause = state(false)
			cause.set(true)
			expect(cause.get()).toBe(true)
		})

		test('should toggle initial value with .set(v => !v)', function () {
			const cause = state(false)
			cause.update(v => !v)
			expect(cause.get()).toBe(true)
		})
	})

	describe('Number cause', function () {
		test('should be number', function () {
			const cause = state(0)
			expect(typeof cause.get()).toBe('number')
		})

		test('should set initial value to 0', function () {
			const cause = state(0)
			expect(cause.get()).toBe(0)
		})

		test('should set new value with .set(42)', function () {
			const cause = state(0)
			cause.set(42)
			expect(cause.get()).toBe(42)
		})

		test('should increment value with .set(v => ++v)', function () {
			const cause = state(0)
			cause.update(v => ++v)
			expect(cause.get()).toBe(1)
		})
	})

	describe('String cause', function () {
		test('should be string', function () {
			const cause = state('foo')
			expect(typeof cause.get()).toBe('string')
		})

		test('should set initial value to "foo"', function () {
			const cause = state('foo')
			expect(cause.get()).toBe('foo')
		})

		test('should set new value with .set("bar")', function () {
			const cause = state('foo')
			cause.set('bar')
			expect(cause.get()).toBe('bar')
		})

		test('should upper case value with .set(v => v.toUpperCase())', function () {
			const cause = state('foo')
			cause.update(v => (v ? v.toUpperCase() : ''))
			expect(cause.get()).toBe('FOO')
		})
	})

	describe('Array cause', function () {
		test('should be array', function () {
			const cause = state([1, 2, 3])
			expect(Array.isArray(cause.get())).toBe(true)
		})

		test('should set initial value to [1, 2, 3]', function () {
			const cause = state([1, 2, 3])
			expect(cause.get()).toEqual([1, 2, 3])
		})

		test('should set new value with .set([4, 5, 6])', function () {
			const cause = state([1, 2, 3])
			cause.set([4, 5, 6])
			expect(cause.get()).toEqual([4, 5, 6])
		})

		test('should reflect current value of array after modification', function () {
			const array = [1, 2, 3]
			const cause = state(array)
			array.push(4) // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})

		test('should set new value with .set([...array, 4])', function () {
			const array = [1, 2, 3]
			const cause = state(array)
			cause.set([...array, 4]) // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})
	})

	describe('Object cause', function () {
		test('should be object', function () {
			const cause = state({ a: 'a', b: 1 })
			expect(typeof cause.get()).toBe('object')
		})

		test('should set initial value to { a: "a", b: 1 }', function () {
			const cause = state({ a: 'a', b: 1 })
			expect(cause.get()).toEqual({ a: 'a', b: 1 })
		})

		test('should set new value with .set({ c: true })', function () {
			const cause = state<Record<string, any>>({ a: 'a', b: 1 })
			cause.set({ c: true })
			expect(cause.get()).toEqual({ c: true })
		})

		test('should reflect current value of object after modification', function () {
			const obj = { a: 'a', b: 1 }
			const cause = state<Record<string, any>>(obj)
			// @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
			obj.c = true // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})

		test('should set new value with .set({...obj, c: true})', function () {
			const obj = { a: 'a', b: 1 }
			const cause = state<Record<string, any>>(obj)
			cause.set({ ...obj, c: true }) // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})
	})

	describe('Map method', function () {
		test('should return a computed signal', function () {
			const cause = state(42)
			const double = cause.map(v => v * 2)
			expect(isComputed(double)).toBe(true)
			expect(double.get()).toBe(84)
		})

		test('should return a computed signal for an async function', async function () {
			const cause = state(42)
			const asyncDouble = cause.map(async value => {
				await wait(100)
				return value * 2
			})
			expect(isComputed(asyncDouble)).toBe(true)
			expect(asyncDouble.get()).toBe(UNSET)
			await wait(110)
			expect(asyncDouble.get()).toBe(84)
		})
	})

	describe('Tap method', function () {
		test('should create an effect that reacts on signal changes', function () {
			const cause = state(42)
			let okCount = 0
			let nilCount = 0
			let result = 0
			cause.tap({
				ok: v => {
					result = v
					okCount++
				},
				nil: () => {
					nilCount++
				},
			})
			cause.set(43)
			expect(okCount).toBe(2) // + 1 for effect initialization
			expect(nilCount).toBe(0)
			expect(result).toBe(43)

			cause.set(UNSET)
			expect(okCount).toBe(2)
			expect(nilCount).toBe(1)
		})
	})
})
