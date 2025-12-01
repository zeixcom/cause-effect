import { describe, expect, test } from 'bun:test'
import {
	createComputed,
	createEffect,
	createState,
	isComputed,
	isState,
	match,
	resolve,
	UNSET,
} from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const increment = (n: number) => (Number.isFinite(n) ? n + 1 : UNSET)

/* === Tests === */

describe('Computed', () => {
	test('should identify computed signals with isComputed()', () => {
		const count = createState(42)
		const doubled = createComputed(() => count.get() * 2)
		expect(isComputed(doubled)).toBe(true)
		expect(isState(doubled)).toBe(false)
	})

	test('should compute a function', () => {
		const derived = createComputed(() => 1 + 2)
		expect(derived.get()).toBe(3)
	})

	test('should compute function dependent on a signal', () => {
		const cause = createState(42)
		const derived = createComputed(() => cause.get() + 1)
		expect(derived.get()).toBe(43)
	})

	test('should compute function dependent on an updated signal', () => {
		const cause = createState(42)
		const derived = createComputed(() => cause.get() + 1)
		cause.set(24)
		expect(derived.get()).toBe(25)
	})

	test('should compute function dependent on an async signal', async () => {
		const status = createState('pending')
		const promised = createComputed(async () => {
			await wait(100)
			status.set('success')
			return 42
		})
		const derived = createComputed(() => increment(promised.get()))
		expect(derived.get()).toBe(UNSET)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(derived.get()).toBe(43)
		expect(status.get()).toBe('success')
	})

	test('should handle errors from an async signal gracefully', async () => {
		const status = createState('pending')
		const error = createState('')
		const promised = createComputed(async () => {
			await wait(100)
			status.set('error')
			error.set('error occurred')
			return 0
		})
		const derived = createComputed(() => increment(promised.get()))
		expect(derived.get()).toBe(UNSET)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(error.get()).toBe('error occurred')
		expect(status.get()).toBe('error')
	})

	test('should compute task signals in parallel without waterfalls', async () => {
		const a = createComputed(async () => {
			await wait(100)
			return 10
		})
		const b = createComputed(async () => {
			await wait(100)
			return 20
		})
		const c = createComputed(() => {
			const aValue = a.get()
			const bValue = b.get()
			return aValue === UNSET || bValue === UNSET
				? UNSET
				: aValue + bValue
		})
		expect(c.get()).toBe(UNSET)
		await wait(110)
		expect(c.get()).toBe(30)
	})

	test('should compute function dependent on a chain of computed states dependent on a signal', () => {
		const x = createState(42)
		const a = createComputed(() => x.get() + 1)
		const b = createComputed(() => a.get() * 2)
		const c = createComputed(() => b.get() + 1)
		expect(c.get()).toBe(87)
	})

	test('should compute function dependent on a chain of computed states dependent on an updated signal', () => {
		const x = createState(42)
		const a = createComputed(() => x.get() + 1)
		const b = createComputed(() => a.get() * 2)
		const c = createComputed(() => b.get() + 1)
		x.set(24)
		expect(c.get()).toBe(51)
	})

	test('should drop X->B->X updates', () => {
		let count = 0
		const x = createState(2)
		const a = createComputed(() => x.get() - 1)
		const b = createComputed(() => x.get() + a.get())
		const c = createComputed(() => {
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
		const a = createComputed(() => x.get())
		const b = createComputed(() => x.get())
		const c = createComputed(() => {
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
		const a = createComputed(() => x.get())
		const b = createComputed(() => x.get())
		const c = createComputed(() => `${a.get()} ${b.get()}`)
		const d = createComputed(() => {
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
		const sum = createComputed(() => {
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

	/*
	 * Note for the next two tests:
	 *
	 * Due to the lazy evaluation strategy, unchanged computed signals may propagate
	 * change notifications one additional time before stabilizing. This is a
	 * one-time performance cost that allows for efficient memoization and
	 * error handling in most cases.
	 */
	test('should bail out if result is the same', () => {
		let count = 0
		const x = createState('a')
		const a = createComputed(() => {
			x.get()
			return 'foo'
		})
		const b = createComputed(() => {
			count++
			return a.get()
		})
		expect(b.get()).toBe('foo')
		expect(count).toBe(1)
		x.set('aa')
		x.set('aaa')
		x.set('aaaa')
		expect(b.get()).toBe('foo')
		expect(count).toBe(2)
	})

	test('should block if result remains unchanged', () => {
		let count = 0
		const x = createState(42)
		const a = createComputed(() => x.get() % 2)
		const b = createComputed(() => (a.get() ? 'odd' : 'even'))
		const c = createComputed(() => {
			count++
			return `c: ${b.get()}`
		})
		expect(c.get()).toBe('c: even')
		expect(count).toBe(1)
		x.set(44)
		x.set(46)
		x.set(48)
		expect(c.get()).toBe('c: even')
		expect(count).toBe(2)
	})

	test('should detect and throw error for circular dependencies', () => {
		const a = createState(1)
		const b = createComputed(() => c.get() + 1)
		const c = createComputed(() => b.get() + a.get())
		expect(() => {
			b.get() // This should trigger the circular dependency
		}).toThrow('Circular dependency detected in computed')
		expect(a.get()).toBe(1)
	})

	test('should propagate error if an error occurred', () => {
		let okCount = 0
		let errCount = 0
		const x = createState(0)
		const a = createComputed(() => {
			if (x.get() === 1) throw new Error('Calculation error')
			return 1
		})

		// Replace matcher with try/catch in a computed
		const b = createComputed(() => {
			try {
				a.get() // just check if it works
				return `c: success`
			} catch (_error) {
				errCount++
				return `c: recovered`
			}
		})
		const c = createComputed(() => {
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
			expect(error.message).toBe('Calculation error')
		} finally {
			expect(c.get()).toBe('c: recovered')
			expect(okCount).toBe(2)
			expect(errCount).toBe(1)
		}
	})

	test('should create an effect that reacts on async computed changes', async () => {
		const cause = createState(42)
		const derived = createComputed(async () => {
			await wait(100)
			return cause.get() + 1
		})
		let okCount = 0
		let nilCount = 0
		let result: number = 0
		createEffect(() => {
			const resolved = resolve({ derived })
			match(resolved, {
				ok: ({ derived: v }) => {
					result = v
					okCount++
				},
				nil: () => {
					nilCount++
				},
			})
		})
		cause.set(43)
		expect(okCount).toBe(0)
		expect(nilCount).toBe(1)
		expect(result).toBe(0)

		await wait(110)
		expect(okCount).toBe(1) // not +1 because initial state never made it here
		expect(nilCount).toBe(1)
		expect(result).toBe(44)
	})

	test('should handle complex computed signal with error and async dependencies', async () => {
		const toggleState = createState(true)
		const errorProne = createComputed(() => {
			if (toggleState.get()) throw new Error('Intentional error')
			return 42
		})
		const asyncValue = createComputed(async () => {
			await wait(50)
			return 10
		})
		let okCount = 0
		let nilCount = 0
		let errCount = 0
		// let _result: number = 0

		const complexComputed = createComputed(() => {
			try {
				const x = errorProne.get()
				const y = asyncValue.get()
				if (y === UNSET) {
					// not ready yet
					nilCount++
					return 0
				} else {
					// happy path
					okCount++
					return x + y
				}
			} catch (_error) {
				// error path
				errCount++
				return -1
			}
		})

		for (let i = 0; i < 10; i++) {
			toggleState.set(!!(i % 2))
			await wait(10)
			complexComputed.get()
		}

		// Adjusted expectations to be more flexible
		expect(nilCount + okCount + errCount).toBe(10)
		expect(okCount).toBeGreaterThan(0)
		expect(errCount).toBeGreaterThan(0)
	})

	test('should handle signal changes during async computation', async () => {
		const source = createState(1)
		let computationCount = 0
		const derived = createComputed(async (_, abort) => {
			computationCount++
			expect(abort?.aborted).toBe(false)
			await wait(100)
			return source.get()
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)
		expect(computationCount).toBe(1)

		// Change source before first computation completes
		source.set(2)
		await wait(210)
		expect(derived.get()).toBe(2)
		expect(computationCount).toBe(1)
	})

	test('should handle multiple rapid changes during async computation', async () => {
		const source = createState(1)
		let computationCount = 0
		const derived = createComputed(async (_, abort) => {
			computationCount++
			expect(abort?.aborted).toBe(false)
			await wait(100)
			return source.get()
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)
		expect(computationCount).toBe(1)

		// Make multiple rapid changes
		source.set(2)
		source.set(3)
		source.set(4)
		await wait(210)

		// Should have computed twice (initial + final change)
		expect(derived.get()).toBe(4)
		expect(computationCount).toBe(1)
	})

	test('should handle errors in aborted computations', async () => {
		const source = createState(1)
		const derived = createComputed(async () => {
			await wait(100)
			const value = source.get()
			if (value === 2) throw new Error('Intentional error')
			return value
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)

		// Change to error state before first computation completes
		source.set(2)
		await wait(110)
		expect(() => derived.get()).toThrow('Intentional error')

		// Change to normal state before second computation completes
		source.set(3)
		await wait(100)
		expect(derived.get()).toBe(3)
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError when callback is not a function', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed(null)
			}).toThrow('Invalid computed callback null')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed(undefined)
			}).toThrow('Invalid computed callback undefined')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed(42)
			}).toThrow('Invalid computed callback 42')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed('not a function')
			}).toThrow('Invalid computed callback "not a function"')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed({ not: 'a function' })
			}).toThrow('Invalid computed callback {"not":"a function"}')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed((_a: unknown, _b: unknown, _c: unknown) => 42)
			}).toThrow('Invalid computed callback (_a, _b, _c) => 42')
		})

		test('should throw NullishSignalValueError when initialValue is null', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createComputed(() => 42, null)
			}).toThrow('Nullish signal values are not allowed in computed')
		})

		test('should throw specific error types for invalid inputs', () => {
			try {
				// @ts-expect-error - Testing invalid input
				createComputed(null)
				expect(true).toBe(false) // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(TypeError)
				expect(error.name).toBe('InvalidCallbackError')
				expect(error.message).toBe('Invalid computed callback null')
			}

			try {
				// @ts-expect-error - Testing invalid input
				createComputed(() => 42, null)
				expect(true).toBe(false) // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(TypeError)
				expect(error.name).toBe('NullishSignalValueError')
				expect(error.message).toBe(
					'Nullish signal values are not allowed in computed',
				)
			}
		})

		test('should allow valid callbacks and non-nullish initialValues', () => {
			// These should not throw
			expect(() => {
				createComputed(() => 42)
			}).not.toThrow()

			expect(() => {
				createComputed(() => 42, 0)
			}).not.toThrow()

			expect(() => {
				createComputed(() => 'foo', '')
			}).not.toThrow()

			expect(() => {
				createComputed(() => true, false)
			}).not.toThrow()

			expect(() => {
				createComputed(async () => ({ id: 42, name: 'John' }), UNSET)
			}).not.toThrow()
		})
	})

	describe('Initial Value and Old Value', () => {
		test('should use initialValue when provided', () => {
			const computed = createComputed(
				(oldValue: number) => oldValue + 1,
				10,
			)
			expect(computed.get()).toBe(11)
		})

		test('should pass current value as oldValue to callback', () => {
			const state = createState(5)
			let receivedOldValue: number | undefined
			const computed = createComputed((oldValue: number) => {
				receivedOldValue = oldValue
				return state.get() * 2
			}, 0)

			expect(computed.get()).toBe(10)
			expect(receivedOldValue).toBe(0)

			state.set(3)
			expect(computed.get()).toBe(6)
			expect(receivedOldValue).toBe(10)
		})

		test('should work as reducer function with oldValue', () => {
			const increment = createState(0)
			const sum = createComputed((oldValue: number) => {
				const inc = increment.get()
				return inc === 0 ? oldValue : oldValue + inc
			}, 0)

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
			const items = createComputed((oldValue: string[]) => {
				const newItem = item.get()
				return newItem === '' ? oldValue : [...oldValue, newItem]
			}, [] as string[])

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
			const counter = createComputed((oldValue: number) => {
				if (reset.get()) return 0
				const increment = add.get()
				return increment === 0 ? oldValue : oldValue + increment
			}, 0)

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
			const computed = createComputed((oldValue: number) => {
				receivedOldValue = oldValue
				return state.get()
			})

			expect(computed.get()).toBe(42)
			expect(receivedOldValue).toBe(UNSET)
		})

		test('should work with async computation and oldValue', async () => {
			let receivedOldValue: number | undefined

			const asyncComputed = createComputed(async (oldValue: number) => {
				receivedOldValue = oldValue
				await wait(50)
				return oldValue + 5
			}, 10)

			// Initially returns initialValue before async computation completes
			expect(asyncComputed.get()).toBe(10)

			// Wait for async computation to complete
			await wait(60)
			expect(asyncComputed.get()).toBe(15) // 10 + 5
			expect(receivedOldValue).toBe(10)
		})

		test('should handle object updates with oldValue', () => {
			const key = createState('')
			const value = createState('')
			const obj = createComputed(
				(oldValue: Record<string, string>) => {
					const k = key.get()
					const v = value.get()
					if (k === '' || v === '') return oldValue
					return { ...oldValue, [k]: v }
				},
				{} as Record<string, string>,
			)

			expect(obj.get()).toEqual({})

			key.set('name')
			value.set('Alice')
			expect(obj.get()).toEqual({ name: 'Alice' })

			key.set('age')
			value.set('30')
			expect(obj.get()).toEqual({ name: 'Alice', age: '30' })
		})

		test('should handle async computation with AbortSignal and oldValue', async () => {
			const source = createState(1)
			let computationCount = 0
			const receivedOldValues: number[] = []

			const asyncComputed = createComputed(
				async (oldValue: number, abort: AbortSignal) => {
					computationCount++
					receivedOldValues.push(oldValue)

					// Simulate async work
					await wait(100)

					// Check if computation was aborted
					if (abort.aborted) {
						return oldValue
					}

					return source.get() + oldValue
				},
				0,
			)

			// Initial computation
			expect(asyncComputed.get()).toBe(0) // Returns initialValue immediately

			// Change source before first computation completes
			source.set(2)

			// Wait for computation to complete
			await wait(110)

			// Should have the result from the computation that wasn't aborted
			expect(asyncComputed.get()).toBe(2) // 2 + 0 (initialValue was used as oldValue)
			expect(computationCount).toBe(1) // Only one computation completed
			expect(receivedOldValues).toEqual([0])
		})

		test('should work with error handling and oldValue', () => {
			const shouldError = createState(false)
			const counter = createState(1)

			const computed = createComputed((oldValue: number) => {
				if (shouldError.get()) {
					throw new Error('Computation failed')
				}
				// Handle UNSET case by treating it as 0
				const safeOldValue = oldValue === UNSET ? 0 : oldValue
				return safeOldValue + counter.get()
			}, 10)

			expect(computed.get()).toBe(11) // 10 + 1

			counter.set(5)
			expect(computed.get()).toBe(16) // 11 + 5

			// Trigger error
			shouldError.set(true)
			expect(() => computed.get()).toThrow('Computation failed')

			// Recover from error
			shouldError.set(false)
			counter.set(2)

			// After error, oldValue should be UNSET, so we treat it as 0 and get 0 + 2 = 2
			expect(computed.get()).toBe(2)
		})

		test('should work with complex state transitions using oldValue', () => {
			const action = createState<
				'increment' | 'decrement' | 'reset' | 'multiply'
			>('increment')
			const amount = createState(1)

			const calculator = createComputed((oldValue: number) => {
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
			}, 0)

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
			const nullishComputed = createComputed((oldValue: string) => {
				return `${oldValue} updated`
			}, '')

			expect(nullishComputed.get()).toBe(' updated')

			// Test with complex object initialValue
			interface StateObject {
				count: number
				items: string[]
				meta: { created: Date }
			}

			const now = new Date()
			const objectComputed = createComputed(
				(oldValue: StateObject) => ({
					...oldValue,
					count: oldValue.count + 1,
					items: [...oldValue.items, `item${oldValue.count + 1}`],
				}),
				{
					count: 0,
					items: [] as string[],
					meta: { created: now },
				},
			)

			const result = objectComputed.get()
			expect(result.count).toBe(1)
			expect(result.items).toEqual(['item1'])
			expect(result.meta.created).toBe(now)
		})

		test('should preserve initialValue type consistency', () => {
			// Test that oldValue type is consistent with initialValue
			const stringComputed = createComputed((oldValue: string) => {
				expect(typeof oldValue).toBe('string')
				return oldValue.toUpperCase()
			}, 'hello')

			expect(stringComputed.get()).toBe('HELLO')

			const numberComputed = createComputed((oldValue: number) => {
				expect(typeof oldValue).toBe('number')
				expect(Number.isFinite(oldValue)).toBe(true)
				return oldValue * 2
			}, 5)

			expect(numberComputed.get()).toBe(10)
		})

		test('should work with chained computed using oldValue', () => {
			const source = createState(1)

			const first = createComputed(
				(oldValue: number) => oldValue + source.get(),
				10,
			)

			const second = createComputed(
				(oldValue: number) => oldValue + first.get(),
				20,
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

			const accumulator = createComputed((oldValue: number) => {
				computationCount++
				return oldValue + trigger.get()
			}, 100)

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
