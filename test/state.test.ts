import { describe, expect, test } from 'bun:test'
import { createEffect, createState, isMemo, isState } from '../next.ts'

/* === Tests === */

describe('State', () => {
	describe('createState', () => {
		test('should return initial value from get()', () => {
			const count = createState(0)
			expect(count.get()).toBe(0)
		})

		test('should work with different value types', () => {
			expect(createState(false).get()).toBe(false)
			expect(createState('foo').get()).toBe('foo')
			expect(createState([1, 2, 3]).get()).toEqual([1, 2, 3])
			expect(createState({ a: 1 }).get()).toEqual({ a: 1 })
		})

		test('should have Symbol.toStringTag of "State"', () => {
			const state = createState(0)
			expect(state[Symbol.toStringTag]).toBe('State')
		})
	})

	describe('isState', () => {
		test('should identify state signals', () => {
			expect(isState(createState(0))).toBe(true)
		})

		test('should return false for non-state values', () => {
			expect(isState(42)).toBe(false)
			expect(isState(null)).toBe(false)
			expect(isState({})).toBe(false)
			expect(isMemo(createState(0))).toBe(false)
		})
	})

	describe('set', () => {
		test('should update value', () => {
			const state = createState(0)
			state.set(42)
			expect(state.get()).toBe(42)
		})

		test('should replace value entirely for objects', () => {
			const state = createState<Record<string, unknown>>({ a: 1 })
			state.set({ b: 2 })
			expect(state.get()).toEqual({ b: 2 })
		})

		test('should replace value entirely for arrays', () => {
			const state = createState([1, 2, 3])
			state.set([4, 5, 6])
			expect(state.get()).toEqual([4, 5, 6])
		})

		test('should skip update when value is equal by reference', () => {
			const obj = { a: 1 }
			const state = createState(obj)
			let effectCount = 0
			createEffect(() => {
				state.get()
				effectCount++
			})
			expect(effectCount).toBe(1)
			state.set(obj) // same reference
			expect(effectCount).toBe(1)
		})
	})

	describe('update', () => {
		test('should update value via callback', () => {
			const state = createState(0)
			state.update(v => v + 1)
			expect(state.get()).toBe(1)
		})

		test('should pass current value to callback', () => {
			const state = createState('hello')
			state.update(v => v.toUpperCase())
			expect(state.get()).toBe('HELLO')
		})

		test('should work with arrays', () => {
			const state = createState([1, 2, 3])
			state.update(arr => [...arr, 4])
			expect(state.get()).toEqual([1, 2, 3, 4])
		})

		test('should work with objects', () => {
			const state = createState({ count: 0 })
			state.update(obj => ({ ...obj, count: obj.count + 1 }))
			expect(state.get()).toEqual({ count: 1 })
		})
	})

	describe('options.equals', () => {
		test('should use custom equality function to skip updates', () => {
			const state = createState(
				{ x: 1 },
				{ equals: (a, b) => a.x === b.x },
			)
			let effectCount = 0
			createEffect(() => {
				state.get()
				effectCount++
			})
			expect(effectCount).toBe(1)

			state.set({ x: 1 }) // structurally equal
			expect(effectCount).toBe(1)

			state.set({ x: 2 }) // different
			expect(effectCount).toBe(2)
		})

		test('should default to reference equality', () => {
			const state = createState({ x: 1 })
			let effectCount = 0
			createEffect(() => {
				state.get()
				effectCount++
			})
			expect(effectCount).toBe(1)

			state.set({ x: 1 }) // new reference, same shape
			expect(effectCount).toBe(2)
		})
	})

	describe('options.guard', () => {
		test('should validate initial value against guard', () => {
			expect(() => {
				createState(0, {
					guard: (v): v is number => typeof v === 'number' && v > 0,
				})
			}).toThrow('[State] Signal value 0 is invalid')
		})

		test('should validate set() values against guard', () => {
			const state = createState(1, {
				guard: (v): v is number => typeof v === 'number' && v > 0,
			})
			expect(() => state.set(0)).toThrow(
				'[State] Signal value 0 is invalid',
			)
			expect(state.get()).toBe(1) // unchanged
		})

		test('should validate update() return values against guard', () => {
			const state = createState(1, {
				guard: (v): v is number => typeof v === 'number' && v > 0,
			})
			expect(() => state.update(() => 0)).toThrow(
				'[State] Signal value 0 is invalid',
			)
			expect(state.get()).toBe(1) // unchanged
		})

		test('should allow values that pass the guard', () => {
			const state = createState(1, {
				guard: (v): v is number => typeof v === 'number' && v > 0,
			})
			state.set(5)
			expect(state.get()).toBe(5)
		})
	})

	describe('Input Validation', () => {
		test('should throw NullishSignalValueError for null or undefined initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createState(null)
			}).toThrow('[State] Signal value cannot be null or undefined')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createState(undefined)
			}).toThrow('[State] Signal value cannot be null or undefined')
		})

		test('should throw NullishSignalValueError for null or undefined in set()', () => {
			const state = createState(42)
			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(null)
			}).toThrow('[State] Signal value cannot be null or undefined')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(undefined)
			}).toThrow('[State] Signal value cannot be null or undefined')
		})

		test('should throw NullishSignalValueError for nullish return from update()', () => {
			const state = createState(42)
			expect(() => {
				// @ts-expect-error - Testing invalid return value
				state.update(() => null)
			}).toThrow('[State] Signal value cannot be null or undefined')

			expect(() => {
				// @ts-expect-error - Testing invalid return value
				state.update(() => undefined)
			}).toThrow('[State] Signal value cannot be null or undefined')

			expect(state.get()).toBe(42) // unchanged
		})

		test('should throw InvalidCallbackError for non-function in update()', () => {
			const state = createState(42)
			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.update(null)
			}).toThrow('[State] Callback null is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.update('not a function')
			}).toThrow('[State] Callback "not a function" is invalid')
		})

		test('should propagate errors thrown by update callback', () => {
			const state = createState(42)
			expect(() => {
				state.update(() => {
					throw new Error('Updater error')
				})
			}).toThrow('Updater error')

			expect(state.get()).toBe(42) // unchanged
		})
	})
})
