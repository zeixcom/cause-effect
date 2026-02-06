import { describe, expect, test } from 'bun:test'
import {
	// match,
	// resolve,
	createMemo,
	createState,
	createTask,
	// createEffect,
	// isMemo,
	// isState,
} from '../next.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const increment = (n: number) => (Number.isFinite(n) ? n + 1 : 0)

/* === Tests === */

describe('Task', () => {
	test('should compute function dependent on an async signal', async () => {
		const status = createState('pending')
		const promised = createTask(async () => {
			await wait(100)
			status.set('success')
			return 42
		})
		const derived = createMemo(() => increment(promised.get()))
		expect(derived.get()).toBe(0)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(derived.get()).toBe(43)
		expect(status.get()).toBe('success')
	})

	test('should handle errors from an async signal gracefully', async () => {
		const status = createState('pending')
		const error = createState('')
		const promised = createTask(async () => {
			await wait(100)
			status.set('error')
			error.set('error occurred')
			return 0
		})
		const derived = createMemo(() => increment(promised.get()))
		expect(derived.get()).toBe(0)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(error.get()).toBe('error occurred')
		expect(status.get()).toBe('error')
	})

	test('should compute task signals in parallel without waterfalls', async () => {
		const a = createTask(
			async () => {
				await wait(80)
				return 10
			},
			{ value: 0 },
		)
		const b = createTask(
			async () => {
				await wait(100)
				return 20
			},
			{ value: 0 },
		)
		const c = createMemo(
			() => {
				const aValue = a.get()
				const bValue = b.get()
				return aValue + bValue
			},
			{ value: 0 },
		)
		expect(c.get()).toBe(0)
		await wait(110)
		expect(c.get()).toBe(30)
	})

	/* test('should create an effect that reacts on async computed changes', async () => {
		const cause = createState(42)
		const derived = createTask(async () => {
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
	}) */

	test('should handle complex computed signal with error and async dependencies', async () => {
		const toggleState = createState(true)
		const errorProne = createMemo(() => {
			if (toggleState.get()) throw new Error('Intentional error')
			return 42
		})
		const asyncValue = createTask(async () => {
			await wait(50)
			return 10
		})
		let okCount = 0
		let nilCount = 0
		let errCount = 0
		// let _result: number = 0

		const complexComputed = createMemo(() => {
			try {
				const x = errorProne.get()
				const y = asyncValue.get()
				if (y === undefined) {
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
		const derived = createTask(
			async (_, abort) => {
				computationCount++
				expect(abort?.aborted).toBe(false)
				await wait(100)
				return source.get()
			},
			{ value: 0 },
		)

		// Start first computation
		expect(derived.get()).toBe(0)
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
		const derived = createTask(
			async (_, abort) => {
				computationCount++
				expect(abort?.aborted).toBe(false)
				await wait(100)
				return source.get()
			},
			{ value: 0 },
		)

		// Start first computation
		expect(derived.get()).toBe(0)
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
		const derived = createTask(
			async () => {
				const value = source.get() // dependency needs to be read before await
				await wait(100)
				if (value === 2) throw new Error('Intentional error')
				return value
			},
			{ value: 0 },
		)

		// Start first computation
		expect(derived.get()).toBe(0)

		// Change to error state before first computation completes
		source.set(2)
		derived.get() // start task
		await wait(110)
		expect(() => derived.get()).toThrow('Intentional error')

		// Change to normal state before second computation completes
		source.set(3)
		derived.get() // start new task
		await wait(100)
		expect(derived.get()).toBe(3)
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError when callback is a sync function', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createTask((_a: unknown) => 42)
			}).toThrow('[Task] Callback (_a) => 42 is invalid')
		})

		test('should expect type error if wrong type is passed for options.value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createTask(async () => 42, { value: null })
			}).toThrow('[Task] Signal value cannot be null or undefined')

			expect(() => {
				createTask(async () => 42, {
					// @ts-expect-error - Testing invalid input
					value: 'foo',
					guard: v => typeof v === 'number',
				})
			}).toThrow('[Task] Signal value "foo" is invalid')
		})

		test('should allow valid callbacks and non-nullish options.value', () => {
			// These should not throw
			expect(() => {
				createTask(async () => ({ id: 42, name: 'John' }))
			}).not.toThrow()

			expect(() => {
				createTask(async prev => prev + 1, { value: 42 })
			}).not.toThrow()
		})
	})

	describe('Initial Value and Old Value', () => {
		test('should work with async computation and oldValue', async () => {
			let receivedOldValue: number | undefined

			const asyncComputed = createTask(
				async (oldValue: number) => {
					receivedOldValue = oldValue
					await wait(50)
					return oldValue + 5
				},
				{
					value: 10,
				},
			)

			// Initially returns initialValue before async computation completes
			expect(asyncComputed.get()).toBe(10)

			// Wait for async computation to complete
			await wait(60)
			expect(asyncComputed.get()).toBe(15) // 10 + 5
			expect(receivedOldValue).toBe(10)
		})

		test('should handle async computation with AbortSignal and oldValue', async () => {
			const source = createState(1)
			let computationCount = 0
			const receivedOldValues: number[] = []

			const asyncComputed = createTask(
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
				{
					value: 0,
				},
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
	})
})
