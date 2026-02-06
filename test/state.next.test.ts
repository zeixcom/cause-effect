import { describe, expect, test } from 'bun:test'
import { createState, isMemo, isState } from '../next.ts'

/* === Tests === */

describe('State', () => {
	describe('State type guard', () => {
		test('isState identifies state signals', () => {
			const count = createState(42)
			expect(isState(count)).toBe(true)
			expect(isMemo(count)).toBe(false)
		})
	})

	describe('Boolean state', () => {
		test('should be boolean', () => {
			const state = createState(false)
			expect(typeof state.get()).toBe('boolean')
		})

		test('should set initial value to false', () => {
			const state = createState(false)
			expect(state.get()).toBe(false)
		})

		test('should set initial value to true', () => {
			const state = createState(true)
			expect(state.get()).toBe(true)
		})

		test('should set new value with .set(true)', () => {
			const state = createState(false)
			state.set(true)
			expect(state.get()).toBe(true)
		})

		test('should toggle initial value with .set(v => !v)', () => {
			const state = createState(false)
			state.update(v => !v)
			expect(state.get()).toBe(true)
		})
	})

	describe('Number state', () => {
		test('should be number', () => {
			const state = createState(0)
			expect(typeof state.get()).toBe('number')
		})

		test('should set initial value to 0', () => {
			const state = createState(0)
			expect(state.get()).toBe(0)
		})

		test('should set new value with .set(42)', () => {
			const state = createState(0)
			state.set(42)
			expect(state.get()).toBe(42)
		})

		test('should increment value with .set(v => ++v)', () => {
			const state = createState(0)
			state.update(v => ++v)
			expect(state.get()).toBe(1)
		})
	})

	describe('String state', () => {
		test('should be string', () => {
			const state = createState('foo')
			expect(typeof state.get()).toBe('string')
		})

		test('should set initial value to "foo"', () => {
			const state = createState('foo')
			expect(state.get()).toBe('foo')
		})

		test('should set new value with .set("bar")', () => {
			const state = createState('foo')
			state.set('bar')
			expect(state.get()).toBe('bar')
		})

		test('should upper case value with .set(v => v.toUpperCase())', () => {
			const state = createState('foo')
			state.update(v => (v ? v.toUpperCase() : ''))
			expect(state.get()).toBe('FOO')
		})
	})

	describe('Array state', () => {
		test('should be array', () => {
			const state = createState([1, 2, 3])
			expect(Array.isArray(state.get())).toBe(true)
		})

		test('should set initial value to [1, 2, 3]', () => {
			const state = createState([1, 2, 3])
			expect(state.get()).toEqual([1, 2, 3])
		})

		test('should set new value with .set([4, 5, 6])', () => {
			const state = createState([1, 2, 3])
			state.set([4, 5, 6])
			expect(state.get()).toEqual([4, 5, 6])
		})

		test('should reflect current value of array after modification', () => {
			const array = [1, 2, 3]
			const state = createState(array)
			array.push(4) // don't do this! the result will be correct, but we can't trigger effects
			expect(state.get()).toEqual([1, 2, 3, 4])
		})

		test('should set new value with .set([...array, 4])', () => {
			const array = [1, 2, 3]
			const state = createState(array)
			state.set([...array, 4]) // use destructuring instead!
			expect(state.get()).toEqual([1, 2, 3, 4])
		})

		describe('Input Validation', () => {
			test('should throw NullishSignalValueError when initialValue is nullish', () => {
				expect(() => {
					// @ts-expect-error - Testing invalid input
					createState(null)
				}).toThrow('[State] Signal value cannot be null or undefined')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					createState(undefined)
				}).toThrow('[State] Signal value cannot be null or undefined')
			})

			test('should throw NullishSignalValueError when newValue is nullish in set()', () => {
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

			test('should throw specific error types for nullish values', () => {
				try {
					// @ts-expect-error - Testing invalid input
					createState(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect((error as Error).name).toBe(
						'NullishSignalValueError',
					)
					expect((error as Error).message).toBe(
						'[State] Signal value cannot be null or undefined',
					)
				}

				const state = createState(42)
				try {
					// @ts-expect-error - Testing invalid input
					state.set(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect((error as Error).name).toBe(
						'NullishSignalValueError',
					)
					expect((error as Error).message).toBe(
						'[State] Signal value cannot be null or undefined',
					)
				}
			})

			test('should allow valid non-nullish values', () => {
				// These should not throw
				expect(() => {
					createState(0)
				}).not.toThrow()

				expect(() => {
					createState('')
				}).not.toThrow()

				expect(() => {
					createState(false)
				}).not.toThrow()

				expect(() => {
					createState({})
				}).not.toThrow()

				expect(() => {
					createState([])
				}).not.toThrow()

				const state = createState(42)
				expect(() => {
					state.set(0)
				}).not.toThrow()

				expect(() => {
					// @ts-expect-error - Testing valid input of invalid type
					state.set('')
				}).not.toThrow()
			})

			test('should throw InvalidCallbackError for non-function updater in update()', () => {
				const state = createState(42)

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(null)
				}).toThrow('[State] Callback null is invalid')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(undefined)
				}).toThrow('[State] Callback undefined is invalid')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update('not a function')
				}).toThrow('[State] Callback "not a function" is invalid')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(42)
				}).toThrow('[State] Callback 42 is invalid')
			})

			test('should throw specific error type for non-function updater', () => {
				const state = createState(42)

				try {
					// @ts-expect-error - Testing invalid input
					state.update(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect((error as Error).name).toBe('InvalidCallbackError')
					expect((error as Error).message).toBe(
						'[State] Callback null is invalid',
					)
				}
			})

			test('should handle updater function that throws an error', () => {
				const state = createState(42)

				expect(() => {
					state.update(() => {
						throw new Error('Updater error')
					})
				}).toThrow('Updater error')

				// State should remain unchanged after error
				expect(state.get()).toBe(42)
			})

			test('should handle updater function that returns nullish value', () => {
				const state = createState(42)

				expect(() => {
					// @ts-expect-error - Testing invalid return value
					state.update(() => null)
				}).toThrow('[State] Signal value cannot be null or undefined')

				expect(() => {
					// @ts-expect-error - Testing invalid return value
					state.update(() => undefined)
				}).toThrow('[State] Signal value cannot be null or undefined')

				// State should remain unchanged after error
				expect(state.get()).toBe(42)
			})

			test('should handle valid updater functions', () => {
				const numberState = createState(10)
				expect(() => {
					numberState.update(x => x + 5)
				}).not.toThrow()
				expect(numberState.get()).toBe(15)

				const stringState = createState('hello')
				expect(() => {
					stringState.update(x => x.toUpperCase())
				}).not.toThrow()
				expect(stringState.get()).toBe('HELLO')

				const arrayState = createState([1, 2, 3])
				expect(() => {
					arrayState.update(arr => [...arr, 4])
				}).not.toThrow()
				expect(arrayState.get()).toEqual([1, 2, 3, 4])

				const objectState = createState({ count: 0 })
				expect(() => {
					objectState.update(obj => ({
						...obj,
						count: obj.count + 1,
					}))
				}).not.toThrow()
				expect(objectState.get()).toEqual({ count: 1 })
			})
		})
	})

	describe('Object state', () => {
		test('should be object', () => {
			const state = createState({ a: 'a', b: 1 })
			expect(typeof state.get()).toBe('object')
		})

		test('should set initial value to { a: "a", b: 1 }', () => {
			const state = createState({ a: 'a', b: 1 })
			expect(state.get()).toEqual({ a: 'a', b: 1 })
		})

		test('should set new value with .set({ c: true })', () => {
			const state = createState<Record<string, unknown>>({ a: 'a', b: 1 })
			state.set({ c: true })
			expect(state.get()).toEqual({ c: true })
		})

		test('should reflect current value of object after modification', () => {
			const obj = { a: 'a', b: 1 }
			const state = createState<Record<string, unknown>>(obj)
			// @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
			obj.c = true // don't do this! the result will be correct, but we can't trigger effects
			expect(state.get()).toEqual({ a: 'a', b: 1, c: true })
		})

		test('should set new value with .set({...obj, c: true})', () => {
			const obj = { a: 'a', b: 1 }
			const state = createState<Record<string, unknown>>(obj)
			state.set({ ...obj, c: true }) // use destructuring instead!
			expect(state.get()).toEqual({ a: 'a', b: 1, c: true })
		})
	})
})
