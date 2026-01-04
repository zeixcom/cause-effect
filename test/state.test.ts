import { describe, expect, test } from 'bun:test'
import { isComputed, isState, State } from '../index.ts'

/* === Tests === */

describe('State', () => {
	describe('State type guard', () => {
		test('isState identifies state signals', () => {
			const count = new State(42)
			expect(isState(count)).toBe(true)
			expect(isComputed(count)).toBe(false)
		})
	})

	describe('Boolean cause', () => {
		test('should be boolean', () => {
			const cause = new State(false)
			expect(typeof cause.get()).toBe('boolean')
		})

		test('should set initial value to false', () => {
			const cause = new State(false)
			expect(cause.get()).toBe(false)
		})

		test('should set initial value to true', () => {
			const cause = new State(true)
			expect(cause.get()).toBe(true)
		})

		test('should set new value with .set(true)', () => {
			const cause = new State(false)
			cause.set(true)
			expect(cause.get()).toBe(true)
		})

		test('should toggle initial value with .set(v => !v)', () => {
			const cause = new State(false)
			cause.update(v => !v)
			expect(cause.get()).toBe(true)
		})
	})

	describe('Number cause', () => {
		test('should be number', () => {
			const cause = new State(0)
			expect(typeof cause.get()).toBe('number')
		})

		test('should set initial value to 0', () => {
			const cause = new State(0)
			expect(cause.get()).toBe(0)
		})

		test('should set new value with .set(42)', () => {
			const cause = new State(0)
			cause.set(42)
			expect(cause.get()).toBe(42)
		})

		test('should increment value with .set(v => ++v)', () => {
			const cause = new State(0)
			cause.update(v => ++v)
			expect(cause.get()).toBe(1)
		})
	})

	describe('String cause', () => {
		test('should be string', () => {
			const cause = new State('foo')
			expect(typeof cause.get()).toBe('string')
		})

		test('should set initial value to "foo"', () => {
			const cause = new State('foo')
			expect(cause.get()).toBe('foo')
		})

		test('should set new value with .set("bar")', () => {
			const cause = new State('foo')
			cause.set('bar')
			expect(cause.get()).toBe('bar')
		})

		test('should upper case value with .set(v => v.toUpperCase())', () => {
			const cause = new State('foo')
			cause.update(v => (v ? v.toUpperCase() : ''))
			expect(cause.get()).toBe('FOO')
		})
	})

	describe('Array cause', () => {
		test('should be array', () => {
			const cause = new State([1, 2, 3])
			expect(Array.isArray(cause.get())).toBe(true)
		})

		test('should set initial value to [1, 2, 3]', () => {
			const cause = new State([1, 2, 3])
			expect(cause.get()).toEqual([1, 2, 3])
		})

		test('should set new value with .set([4, 5, 6])', () => {
			const cause = new State([1, 2, 3])
			cause.set([4, 5, 6])
			expect(cause.get()).toEqual([4, 5, 6])
		})

		test('should reflect current value of array after modification', () => {
			const array = [1, 2, 3]
			const cause = new State(array)
			array.push(4) // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})

		test('should set new value with .set([...array, 4])', () => {
			const array = [1, 2, 3]
			const cause = new State(array)
			cause.set([...array, 4]) // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4])
		})

		describe('Input Validation', () => {
			test('should throw NullishSignalValueError when initialValue is nullish', () => {
				expect(() => {
					// @ts-expect-error - Testing invalid input
					new State(null)
				}).toThrow('Nullish signal values are not allowed in State')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					new State(undefined)
				}).toThrow('Nullish signal values are not allowed in State')
			})

			test('should throw NullishSignalValueError when newValue is nullish in set()', () => {
				const state = new State(42)

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
					new State(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect(error.name).toBe('NullishSignalValueError')
					expect(error.message).toBe(
						'Nullish signal values are not allowed in State',
					)
				}

				const state = new State(42)
				try {
					// @ts-expect-error - Testing invalid input
					state.set(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect(error.name).toBe('NullishSignalValueError')
					expect(error.message).toBe(
						'Nullish signal values are not allowed in State',
					)
				}
			})

			test('should allow valid non-nullish values', () => {
				// These should not throw
				expect(() => {
					new State(0)
				}).not.toThrow()

				expect(() => {
					new State('')
				}).not.toThrow()

				expect(() => {
					new State(false)
				}).not.toThrow()

				expect(() => {
					new State({})
				}).not.toThrow()

				expect(() => {
					new State([])
				}).not.toThrow()

				const state = new State(42)
				expect(() => {
					state.set(0)
				}).not.toThrow()

				expect(() => {
					// @ts-expect-error - Testing valid input of invalid type
					state.set('')
				}).not.toThrow()
			})

			test('should throw InvalidCallbackError for non-function updater in update()', () => {
				const state = new State(42)

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(null)
				}).toThrow('Invalid State update callback null')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(undefined)
				}).toThrow('Invalid State update callback undefined')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update('not a function')
				}).toThrow('Invalid State update callback "not a function"')

				expect(() => {
					// @ts-expect-error - Testing invalid input
					state.update(42)
				}).toThrow('Invalid State update callback 42')
			})

			test('should throw specific error type for non-function updater', () => {
				const state = new State(42)

				try {
					// @ts-expect-error - Testing invalid input
					state.update(null)
					expect(true).toBe(false) // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(TypeError)
					expect(error.name).toBe('InvalidCallbackError')
					expect(error.message).toBe(
						'Invalid State update callback null',
					)
				}
			})

			test('should handle updater function that throws an error', () => {
				const state = new State(42)

				expect(() => {
					state.update(() => {
						throw new Error('Updater error')
					})
				}).toThrow('Updater error')

				// State should remain unchanged after error
				expect(state.get()).toBe(42)
			})

			test('should handle updater function that returns nullish value', () => {
				const state = new State(42)

				expect(() => {
					// @ts-expect-error - Testing invalid return value
					state.update(() => null)
				}).toThrow('Nullish signal values are not allowed in State')

				expect(() => {
					// @ts-expect-error - Testing invalid return value
					state.update(() => undefined)
				}).toThrow('Nullish signal values are not allowed in State')

				// State should remain unchanged after error
				expect(state.get()).toBe(42)
			})

			test('should handle valid updater functions', () => {
				const numberState = new State(10)
				expect(() => {
					numberState.update(x => x + 5)
				}).not.toThrow()
				expect(numberState.get()).toBe(15)

				const stringState = new State('hello')
				expect(() => {
					stringState.update(x => x.toUpperCase())
				}).not.toThrow()
				expect(stringState.get()).toBe('HELLO')

				const arrayState = new State([1, 2, 3])
				expect(() => {
					arrayState.update(arr => [...arr, 4])
				}).not.toThrow()
				expect(arrayState.get()).toEqual([1, 2, 3, 4])

				const objectState = new State({ count: 0 })
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

	describe('Object cause', () => {
		test('should be object', () => {
			const cause = new State({ a: 'a', b: 1 })
			expect(typeof cause.get()).toBe('object')
		})

		test('should set initial value to { a: "a", b: 1 }', () => {
			const cause = new State({ a: 'a', b: 1 })
			expect(cause.get()).toEqual({ a: 'a', b: 1 })
		})

		test('should set new value with .set({ c: true })', () => {
			const cause = new State<Record<string, unknown>>({ a: 'a', b: 1 })
			cause.set({ c: true })
			expect(cause.get()).toEqual({ c: true })
		})

		test('should reflect current value of object after modification', () => {
			const obj = { a: 'a', b: 1 }
			const cause = new State<Record<string, unknown>>(obj)
			// @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
			obj.c = true // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})

		test('should set new value with .set({...obj, c: true})', () => {
			const obj = { a: 'a', b: 1 }
			const cause = new State<Record<string, unknown>>(obj)
			cause.set({ ...obj, c: true }) // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true })
		})
	})
})
