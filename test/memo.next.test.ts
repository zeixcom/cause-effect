import { describe, expect, test } from 'bun:test'
import { createMemo, createState, isMemo, isState } from '../next.ts'

/* === Tests === */

describe('Memo', () => {
	test('should identify computed signals with isMemo()', () => {
		const count = createState(42)
		const doubled = createMemo(() => count.get() * 2)
		expect(isMemo(doubled)).toBe(true)
		expect(isState(doubled)).toBe(false)
	})

	test('should compute a function', () => {
		const derived = createMemo(() => 1 + 2)
		expect(derived.get()).toBe(3)
	})

	test('should compute function dependent on a signal', () => {
		const cause = createState(42)
		const derived = createMemo(() => cause.get() + 1)
		expect(derived.get()).toBe(43)
	})

	test('should compute function dependent on an updated signal', () => {
		const cause = createState(42)
		const derived = createMemo(() => cause.get() + 1)
		cause.set(24)
		expect(derived.get()).toBe(25)
	})

	test('should compute function dependent on a chain of computed states dependent on a signal', () => {
		const x = createState(42)
		const a = createMemo(() => x.get() + 1)
		const b = createMemo(() => a.get() * 2)
		const c = createMemo(() => b.get() + 1)
		expect(c.get()).toBe(87)
	})

	test('should compute function dependent on a chain of computed states dependent on an updated signal', () => {
		const x = createState(42)
		const a = createMemo(() => x.get() + 1)
		const b = createMemo(() => a.get() * 2)
		const c = createMemo(() => b.get() + 1)
		x.set(24)
		expect(c.get()).toBe(51)
	})

	test('should drop X->B->X updates', () => {
		let count = 0
		const x = createState(2)
		const a = createMemo(() => x.get() - 1)
		const b = createMemo(() => x.get() + a.get())
		const c = createMemo(() => {
			count++
			return `c: ${b.get()}`
		})
		expect(c.get()).toBe('c: 3')
		expect(count).toBe(1)
		x.set(4)
		expect(c.get()).toBe('c: 7')
		expect(count).toBe(2)
	})

	test('should only update every signal once (diamond graph)', () => {
		let count = 0
		const x = createState('a')
		const a = createMemo(() => x.get())
		const b = createMemo(() => x.get())
		const c = createMemo(() => {
			count++
			return `${a.get()} ${b.get()}`
		})
		expect(c.get()).toBe('a a')
		expect(count).toBe(1)
		x.set('aa')
		// flush()
		expect(c.get()).toBe('aa aa')
		expect(count).toBe(2)
	})

	test('should only update every signal once (diamond graph + tail)', () => {
		let count = 0
		const x = createState('a')
		const a = createMemo(() => x.get())
		const b = createMemo(() => x.get())
		const c = createMemo(() => `${a.get()} ${b.get()}`)
		const d = createMemo(() => {
			count++
			return c.get()
		})
		expect(d.get()).toBe('a a')
		expect(count).toBe(1)
		x.set('aa')
		expect(d.get()).toBe('aa aa')
		expect(count).toBe(2)
	})

	test('should update multiple times after multiple state changes', () => {
		const a = createState(3)
		const b = createState(4)
		let count = 0
		const sum = createMemo(() => {
			count++
			return a.get() + b.get()
		})
		expect(sum.get()).toBe(7)
		a.set(6)
		expect(sum.get()).toBe(10)
		b.set(8)
		expect(sum.get()).toBe(14)
		expect(count).toBe(3)
	})

	test('should bail out if result is the same', () => {
		let count = 0
		const x = createState('a')
		const a = createMemo(() => {
			x.get()
			return 'foo'
		})
		const b = createMemo(() => {
			count++
			return a.get()
		})
		expect(b.get()).toBe('foo')
		expect(count).toBe(1)
		x.set('aa')
		x.set('aaa')
		x.set('aaaa')
		expect(b.get()).toBe('foo')
		expect(count).toBe(1)
	})

	test('should block if result remains unchanged', () => {
		let count = 0
		const x = createState(42)
		const a = createMemo(() => x.get() % 2)
		const b = createMemo(() => (a.get() ? 'odd' : 'even'))
		const c = createMemo(() => {
			count++
			return `c: ${b.get()}`
		})
		expect(c.get()).toBe('c: even')
		expect(count).toBe(1)
		x.set(44)
		x.set(46)
		x.set(48)
		expect(c.get()).toBe('c: even')
		expect(count).toBe(1)
	})

	test('should detect and throw error for circular dependencies', () => {
		const a = createState(1)
		const b = createMemo(() => c.get() + 1)
		const c = createMemo((): number => b.get() + a.get())
		expect(() => {
			b.get() // This should trigger the circular dependency
		}).toThrow('[Memo] Circular dependency detected')
		expect(a.get()).toBe(1)
	})

	test('should propagate error if an error occurred', () => {
		let okCount = 0
		let errCount = 0
		const x = createState(0)
		const a = createMemo(() => {
			if (x.get() === 1) throw new Error('Calculation error')
			return 1
		})

		const b = createMemo(() => {
			try {
				a.get() // just check if it works
				return `c: success`
			} catch (_error) {
				errCount++
				return `c: recovered`
			}
		})
		const c = createMemo(() => {
			okCount++
			return b.get()
		})

		expect(a.get()).toBe(1)
		expect(c.get()).toBe('c: success')
		expect(okCount).toBe(1)
		try {
			x.set(1)
			expect(a.get()).toBe(1)
			expect(true).toBe(false) // This line should not be reached
		} catch (error) {
			expect((error as Error).message).toBe('Calculation error')
		} finally {
			expect(c.get()).toBe('c: recovered')
			expect(okCount).toBe(2)
			expect(errCount).toBe(1)
		}
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError when callback is not a function', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(null)
			}).toThrow('[Memo] Callback null is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(undefined)
			}).toThrow('[Memo] Callback undefined is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(42)
			}).toThrow('[Memo] Callback 42 is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo('not a function')
			}).toThrow('[Memo] Callback "not a function" is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo({ not: 'a function' })
			}).toThrow('[Memo] Callback {"not":"a function"} is invalid')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(async (_a: unknown, _b: unknown) => 42)
			}).toThrow('[Memo] Callback async (_a, _b) => 42 is invalid')
		})

		test('should expect type error if null is passed for options.initialValue', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(() => 42, { initialValue: null })
			}).not.toThrow()
		})
	})

	describe('Initial Value and Old Value', () => {
		test('should use initialValue when provided', () => {
			const computed = createMemo((oldValue: number) => oldValue + 1, {
				value: 10,
			})
			expect(computed.get()).toBe(11)
		})

		test('should pass current value as oldValue to callback', () => {
			const state = createState(5)
			let receivedOldValue: number | undefined
			const computed = createMemo(
				(oldValue: number) => {
					receivedOldValue = oldValue
					return state.get() * 2
				},
				{ value: 0 },
			)

			expect(computed.get()).toBe(10)
			expect(receivedOldValue).toBe(0)

			state.set(3)
			expect(computed.get()).toBe(6)
			expect(receivedOldValue).toBe(10)
		})

		test('should work as reducer function with oldValue', () => {
			const increment = createState(0)
			const sum = createMemo(
				(oldValue: number) => {
					const inc = increment.get()
					return inc === 0 ? oldValue : oldValue + inc
				},
				{ value: 0 },
			)

			expect(sum.get()).toBe(0)

			increment.set(5)
			expect(sum.get()).toBe(5)

			increment.set(3)
			expect(sum.get()).toBe(8)

			increment.set(2)
			expect(sum.get()).toBe(10)
		})

		test('should handle array accumulation with oldValue', () => {
			const item = createState('')
			const items = createMemo(
				(oldValue: string[]) => {
					const newItem = item.get()
					return newItem === '' ? oldValue : [...oldValue, newItem]
				},
				{ value: [] as string[] },
			)

			expect(items.get()).toEqual([])

			item.set('first')
			expect(items.get()).toEqual(['first'])

			item.set('second')
			expect(items.get()).toEqual(['first', 'second'])

			item.set('third')
			expect(items.get()).toEqual(['first', 'second', 'third'])
		})

		test('should handle counter with oldValue and multiple dependencies', () => {
			const reset = createState(false)
			const add = createState(0)
			const counter = createMemo(
				(oldValue: number) => {
					if (reset.get()) return 0
					const increment = add.get()
					return increment === 0 ? oldValue : oldValue + increment
				},
				{
					value: 0,
				},
			)

			expect(counter.get()).toBe(0)

			add.set(5)
			expect(counter.get()).toBe(5)

			add.set(3)
			expect(counter.get()).toBe(8)

			reset.set(true)
			expect(counter.get()).toBe(0)

			reset.set(false)
			add.set(2)
			expect(counter.get()).toBe(2)
		})

		test('should pass UNSET as oldValue when no initialValue provided', () => {
			let receivedOldValue: number | undefined
			const state = createState(42)
			const computed = createMemo((oldValue: number) => {
				receivedOldValue = oldValue
				return state.get()
			})

			expect(computed.get()).toBe(42)
			expect(receivedOldValue).toBe(undefined)
		})

		test('should handle object updates with oldValue', () => {
			const key = createState('')
			const value = createState('')
			const obj = createMemo(
				(oldValue: Record<string, string>) => {
					const k = key.get()
					const v = value.get()
					if (k === '' || v === '') return oldValue
					return { ...oldValue, [k]: v }
				},
				{ value: {} as Record<string, string> },
			)

			expect(obj.get()).toEqual({})

			key.set('name')
			value.set('Alice')
			expect(obj.get()).toEqual({ name: 'Alice' })

			key.set('age')
			value.set('30')
			expect(obj.get()).toEqual({ name: 'Alice', age: '30' })
		})

		test('should work with error handling and oldValue', () => {
			const shouldError = createState(false)
			const counter = createState(1)

			const computed = createMemo(
				(prev: number) => {
					if (shouldError.get()) {
						throw new Error('Computation failed')
					}
					return prev + counter.get()
				},
				{
					value: 10,
				},
			)

			expect(computed.get()).toBe(11) // 10 + 1

			counter.set(5)
			expect(computed.get()).toBe(16) // 11 + 5

			// Trigger error
			shouldError.set(true)
			expect(() => computed.get()).toThrow('Computation failed')

			// Recover from error
			shouldError.set(false)
			counter.set(2)

			// After error, prev should be 16 as before error
			expect(computed.get()).toBe(18) // 16 + 2
		})

		test('should work with complex state transitions using oldValue', () => {
			const action = createState<
				'increment' | 'decrement' | 'reset' | 'multiply'
			>('increment')
			const amount = createState(1)

			const calculator = createMemo(
				(oldValue: number) => {
					const act = action.get()
					const amt = amount.get()

					switch (act) {
						case 'increment':
							return oldValue + amt
						case 'decrement':
							return oldValue - amt
						case 'multiply':
							return oldValue * amt
						case 'reset':
							return 0
						default:
							return oldValue
					}
				},
				{
					value: 0,
				},
			)

			expect(calculator.get()).toBe(1) // 0 + 1

			amount.set(5)
			expect(calculator.get()).toBe(6) // 1 + 5

			action.set('multiply')
			amount.set(2)
			expect(calculator.get()).toBe(12) // 6 * 2

			action.set('decrement')
			amount.set(3)
			expect(calculator.get()).toBe(9) // 12 - 3

			action.set('reset')
			expect(calculator.get()).toBe(0)
		})

		test('should handle edge cases with initialValue and oldValue', () => {
			// Test with null/undefined-like values
			const nullishComputed = createMemo(
				oldValue => `${oldValue} updated`,
				{ value: '' },
			)

			expect(nullishComputed.get()).toBe(' updated')

			// Test with complex object initialValue
			interface StateObject {
				count: number
				items: string[]
				meta: { created: Date }
			}

			const now = new Date()
			const objectComputed = createMemo(
				(oldValue: StateObject) => ({
					...oldValue,
					count: oldValue.count + 1,
					items: [...oldValue.items, `item${oldValue.count + 1}`],
				}),
				{
					value: {
						count: 0,
						items: [] as string[],
						meta: { created: now },
					},
				},
			)

			const result = objectComputed.get()
			expect(result.count).toBe(1)
			expect(result.items).toEqual(['item1'])
			expect(result.meta.created).toBe(now)
		})

		test('should preserve initialValue type consistency', () => {
			// Test that oldValue type is consistent with initialValue
			const stringComputed = createMemo(
				(oldValue: string) => {
					expect(typeof oldValue).toBe('string')
					return oldValue.toUpperCase()
				},
				{
					value: 'hello',
				},
			)

			expect(stringComputed.get()).toBe('HELLO')

			const numberComputed = createMemo(
				(oldValue: number) => {
					expect(typeof oldValue).toBe('number')
					expect(Number.isFinite(oldValue)).toBe(true)
					return oldValue * 2
				},
				{
					value: 5,
				},
			)

			expect(numberComputed.get()).toBe(10)
		})

		test('should work with chained computed using oldValue', () => {
			const source = createState(1)

			const first = createMemo(
				(oldValue: number) => oldValue + source.get(),
				{
					value: 10,
				},
			)

			const second = createMemo(
				(oldValue: number) => oldValue + first.get(),
				{
					value: 20,
				},
			)

			expect(first.get()).toBe(11) // 10 + 1
			expect(second.get()).toBe(31) // 20 + 11

			source.set(5)
			expect(first.get()).toBe(16) // 11 + 5
			expect(second.get()).toBe(47) // 31 + 16
		})

		test('should handle frequent updates with oldValue correctly', () => {
			const trigger = createState(0)
			let computationCount = 0

			const accumulator = createMemo(
				(oldValue: number) => {
					computationCount++
					return oldValue + trigger.get()
				},
				{
					value: 100,
				},
			)

			expect(accumulator.get()).toBe(100) // 100 + 0
			expect(computationCount).toBe(1)

			// Make rapid changes
			for (let i = 1; i <= 5; i++) {
				trigger.set(i)
				accumulator.get() // Force evaluation
			}

			expect(computationCount).toBe(6) // Initial + 5 updates
			expect(accumulator.get()).toBe(115) // Final accumulated value
		})
	})
})
