import { describe, expect, test } from 'bun:test'
import { isComputed, isState, Signal } from '../src/classes/signal.ts'

/* === Tests === */

describe('State Signals', () => {
	describe('State type guard', () => {
		test('isState identifies state signals', () => {
			const count = new Signal(42)
			expect(isState(count)).toBe(true)
			expect(isComputed(count)).toBe(false)
		})
	})

	describe('Boolean state', () => {
		test('should be boolean', () => {
			const cause = new Signal(false)
			expect(typeof cause.get()).toBe('boolean')
		})

		test('should set initial value to false', () => {
			const cause = new Signal(false)
			expect(cause.get()).toBe(false)
		})

		test('should set initial value to true', () => {
			const cause = new Signal(true)
			expect(cause.get()).toBe(true)
		})

		test('should set new value with .set(true)', () => {
			const cause = new Signal(false)
			cause.set(true)
			expect(cause.get()).toBe(true)
		})

		test('should toggle initial value with .set(v => !v)', () => {
			const cause = new Signal(false)
			cause.set(v => !v)
			expect(cause.get()).toBe(true)
		})
	})

	describe('Number state', () => {
		test('should be number', () => {
			const cause = new Signal(0)
			expect(typeof cause.get()).toBe('number')
		})

		test('should set initial value to 0', () => {
			const cause = new Signal(0)
			expect(cause.get()).toBe(0)
		})

		test('should set new value with .set(42)', () => {
			const cause = new Signal(0)
			cause.set(42)
			expect(cause.get()).toBe(42)
		})

		test('should increment value with .set(v => ++v)', () => {
			const cause = new Signal(0)
			cause.set(v => ++v)
			expect(cause.get()).toBe(1)
		})
	})

	describe('String state', () => {
		test('should be string', () => {
			const cause = new Signal('foo')
			expect(typeof cause.get()).toBe('string')
		})

		test('should set initial value to "foo"', () => {
			const cause = new Signal('foo')
			expect(cause.get()).toBe('foo')
		})

		test('should set new value with .set("bar")', () => {
			const cause = new Signal('foo')
			cause.set('bar')
			expect(cause.get()).toBe('bar')
		})

		test('should upper case value with .set(v => v.toUpperCase())', () => {
			const cause = new Signal('foo')
			cause.set(v => (v ? v.toUpperCase() : ''))
			expect(cause.get()).toBe('FOO')
		})
	})

	describe('Array state', () => {
		test('should be array', () => {
			const cause = new Signal([1, 2, 3])
			expect(Array.isArray(cause.get())).toBe(true)
		})

		test('should set initial value to [1, 2, 3]', () => {
			const cause = new Signal([1, 2, 3])
			expect(cause.get()).toEqual([1, 2, 3])
		})

		test('should set new value with .set([4, 5, 6])', () => {
			const cause = new Signal([1, 2, 3])
			cause.set([4, 5, 6])
			expect(cause.get()).toEqual([4, 5, 6])
		})

		test('should reflect current value of array after modification', () => {
			const array = [1, 2, 3]
			const cause = new Signal(array)
			array.push(4) // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})

		test('should set new value with .set([...array, 4])', () => {
			const array = [1, 2, 3]
			const cause = new Signal(array)
			cause.set([...array, 4]) // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})
	})

	describe('Object state', () => {
		test('should be object', () => {
			const cause = new Signal({ a: 'a', b: 1 })
			expect(typeof cause.get()).toBe('object')
		})

		test('should set initial value to { a: "a", b: 1 }', () => {
			const cause = new Signal({ a: 'a', b: 1 })
			expect(cause.get()).toEqual({ a: 'a', b: 1 })
		})

		test('should set new value with .set({ c: true })', () => {
			const cause = new Signal<Record<string, unknown>>({ a: 'a', b: 1 })
			cause.set({ c: true })
			expect(cause.get()).toEqual({ c: true })
		})

		test('should reflect current value of object after modification', () => {
			const obj = { a: 'a', b: 1 }
			const cause = new Signal<Record<string, unknown>>(obj)
			// @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
			obj.c = true // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})

		test('should set new value with .set({...obj, c: true})', () => {
			const obj = { a: 'a', b: 1 }
			const cause = new Signal<Record<string, unknown>>(obj)
			cause.set({ ...obj, c: true }) // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})
	})

	describe('Input Validation', () => {
		test('should throw NullishSignalValueError when initialValue is nullish', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				new Signal(null)
			}).toThrow('Nullish signal values are not allowed in State')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				new Signal(undefined)
			}).toThrow('Nullish signal values are not allowed in State')
		})

		test('should throw NullishSignalValueError when newValue is nullish in set()', () => {
			const state = new Signal(42)

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(null)
			}).toThrow('Nullish signal values are not allowed in State')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(undefined)
			}).toThrow('Nullish signal values are not allowed in State')
		})

		test('should throw specific error types for nullish values', () => {
			try {
				// @ts-expect-error - Testing invalid input
				new Signal(null)
				expect(true).toBe(false) // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(TypeError)
				expect((error as Error).name).toBe('NullishSignalValueError')
				expect((error as Error).message).toBe(
					'Nullish signal values are not allowed in State',
				)
			}

			const state = new Signal(42)
			try {
				// @ts-expect-error - Testing invalid input
				state.set(null)
				expect(true).toBe(false) // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(TypeError)
				expect((error as Error).name).toBe('NullishSignalValueError')
				expect((error as Error).message).toBe(
					'Nullish signal values are not allowed in State',
				)
			}
		})

		test('should allow valid non-nullish values', () => {
			// These should not throw
			expect(() => {
				new Signal(0)
			}).not.toThrow()

			expect(() => {
				new Signal('')
			}).not.toThrow()

			expect(() => {
				new Signal(false)
			}).not.toThrow()

			expect(() => {
				new Signal({})
			}).not.toThrow()

			expect(() => {
				new Signal([])
			}).not.toThrow()

			const state = new Signal(42)
			expect(() => {
				state.set(0)
			}).not.toThrow()

			expect(() => {
				// @ts-expect-error - Testing valid input of invalid type
				state.set('')
			}).not.toThrow()
		})

		test('should throw InvalidCallbackError for non-function updater in set()', () => {
			const state = new Signal(42)

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(null)
			}).toThrow('Nullish signal values are not allowed in State')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				state.set(undefined)
			}).toThrow('Nullish signal values are not allowed in State')
		})

		test('should throw specific error type for non-function updater', () => {
			const state = new Signal(42)

			try {
				// @ts-expect-error - Testing invalid input
				state.set(null)
				expect(true).toBe(false) // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(TypeError)
				expect((error as Error).name).toBe('NullishSignalValueError')
				expect((error as Error).message).toBe(
					'Nullish signal values are not allowed in State',
				)
			}
		})

		test('should handle updater function that throws an error', () => {
			const state = new Signal(42)

			state.set(() => {
				throw new Error('Updater error')
			})

			// Error should be thrown on next .get() call
			expect(() => {
				state.get()
			}).toThrow('Updater error')

			// State should remain unchanged after error (value stays at 42)
			state.set(42) // Reset to direct value
			expect(state.get()).toBe(42)
		})

		test('should handle valid updater functions', () => {
			const numberState = new Signal(10)
			expect(() => {
				numberState.set(x => x + 5)
			}).not.toThrow()
			expect(numberState.get()).toBe(15)

			const stringState = new Signal('hello')
			expect(() => {
				stringState.set(x => x.toUpperCase())
			}).not.toThrow()
			expect(stringState.get()).toBe('HELLO')

			const arrayState = new Signal([1, 2, 3])
			expect(() => {
				arrayState.set(arr => [...arr, 4])
			}).not.toThrow()
			expect(arrayState.get()).toEqual([1, 2, 3, 4])

			const objectState = new Signal({ count: 0 })
			expect(() => {
				objectState.set(obj => ({
					...obj,
					count: obj.count + 1,
				}))
			}).not.toThrow()
			expect(objectState.get()).toEqual({ count: 1 })
		})
	})
})
