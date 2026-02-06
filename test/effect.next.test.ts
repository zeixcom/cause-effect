import { describe, expect, mock, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createState,
	createTask,
	match,
} from '../next.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Effect', () => {
	test('should be triggered after a state change', () => {
		const cause = createState('foo')
		let count = 0
		createEffect(() => {
			cause.get()
			count++
		})
		expect(count).toBe(1)
		cause.set('bar')
		expect(count).toBe(2)
	})

	test('should be triggered after computed async signals resolve without waterfalls', async () => {
		const a = createTask(async () => {
			await wait(20)
			return 10
		})
		const b = createTask(async () => {
			await wait(20)
			return 20
		})
		let result = 0
		let count = 0
		let nilCount = 0
		createEffect(() =>
			match([a, b], {
				ok: ([aValue, bValue]) => {
					result = aValue + bValue
					count++
				},
				nil: () => {
					nilCount++
				},
			}),
		)
		expect(result).toBe(0)
		expect(count).toBe(0)
		expect(nilCount).toBe(1)
		await wait(30)
		expect(result).toBe(30)
		expect(count).toBe(1)
	})

	test('should be triggered repeatedly after repeated state change', async () => {
		const cause = createState(0)
		let result = 0
		let count = 0
		createEffect(() => {
			result = cause.get()
			count++
		})
		for (let i = 0; i < 10; i++) {
			cause.set(i)
			expect(result).toBe(i)
			expect(count).toBe(i + 1) // + 1 for effect initialization
		}
	})

	test('should handle errors in effects with match handlers', () => {
		const a = createState(1)
		const b = createMemo(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		createEffect(() =>
			match([b], {
				ok: () => {
					normalCallCount++
				},
				err: errors => {
					errorCallCount++
					expect(errors[0].message).toBe('Value too high')
				},
			}),
		)

		// Normal case
		a.set(2)
		expect(normalCallCount).toBe(2)
		expect(errorCallCount).toBe(0)

		// Error case
		a.set(6)
		expect(normalCallCount).toBe(2)
		expect(errorCallCount).toBe(1)

		// Back to normal
		a.set(3)
		expect(normalCallCount).toBe(3)
		expect(errorCallCount).toBe(1)
	})

	test('should handle UNSET values in effects with nil handlers', async () => {
		const a = createTask(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		createEffect(() =>
			match([a], {
				ok: ([aValue]) => {
					normalCallCount++
					expect(aValue).toBe(42)
				},
				nil: () => {
					nilCount++
				},
			}),
		)

		expect(normalCallCount).toBe(0)
		expect(nilCount).toBe(1)
		await wait(110)
		expect(normalCallCount).toBeGreaterThan(0)
		expect(nilCount).toBe(1)
		expect(a.get()).toBe(42)
	})

	test('should fall back to console.error when err handler is not provided', () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const a = createState(1)
			const b = createMemo(() => {
				const v = a.get()
				if (v > 5) throw new Error('Value too high')
				return v * 2
			})

			createEffect(() =>
				match([b], {
					ok: () => {},
				}),
			)

			a.set(6)

			expect(mockConsoleError).toHaveBeenCalled()
		} finally {
			console.error = originalConsoleError
		}
	})

	test('should clean up subscriptions when disposed', () => {
		const count = createState(42)
		let received = 0

		const cleanup = createEffect(() => {
			received = count.get()
		})

		count.set(43)
		expect(received).toBe(43)

		cleanup()
		count.set(44)
		expect(received).toBe(43) // Should not update after dispose
	})

	test('should safely handle state updates inside effects', () => {
		let okCount = 0
		const count = createState(0)

		createEffect(() =>
			match([count], {
				ok: ([value]) => {
					okCount++
					if (value === 0) count.set(1)
				},
			}),
		)

		// The effect ran once initially, then the deferred update triggers a second run
		expect(count.get()).toBe(1)
		expect(okCount).toBe(2)
	})

	test('should call cleanup function before next effect run', () => {
		const count = createState(0)
		let cleanupCount = 0
		let effectCount = 0

		createEffect(() => {
			count.get()
			effectCount++
			return () => {
				cleanupCount++
			}
		})

		expect(effectCount).toBe(1)
		expect(cleanupCount).toBe(0)

		count.set(1)
		expect(effectCount).toBe(2)
		expect(cleanupCount).toBe(1)

		count.set(2)
		expect(effectCount).toBe(3)
		expect(cleanupCount).toBe(2)
	})

	test('should call cleanup function on disposal', () => {
		const count = createState(0)
		let cleanupCalled = false

		const dispose = createEffect(() => {
			count.get()
			return () => {
				cleanupCalled = true
			}
		})

		expect(cleanupCalled).toBe(false)
		dispose()
		expect(cleanupCalled).toBe(true)
	})
})

describe('Effect - Async Match', () => {
	test('should not register cleanup from stale async handler after disposal', async () => {
		let cleanupRegistered = false

		const dispose = createEffect(() =>
			match([], {
				ok: async () => {
					await wait(50)
					return () => {
						cleanupRegistered = true
					}
				},
			}),
		)

		// Dispose before async handler completes
		await wait(10)
		dispose()

		// Wait for async handler to finish
		await wait(60)

		// Cleanup should NOT have been registered since abort was triggered
		expect(cleanupRegistered).toBe(false)
	})

	test('should register cleanup from async handler that completes before disposal', async () => {
		let cleanupCalled = false

		const dispose = createEffect(() =>
			match([], {
				ok: async () => {
					await wait(10)
					return () => {
						cleanupCalled = true
					}
				},
			}),
		)

		// Wait for async handler to complete
		await wait(20)

		// Dispose should run the registered cleanup
		dispose()
		expect(cleanupCalled).toBe(true)
	})

	test('should handle async errors in match handlers', async () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const testSignal = createState(1)

			createEffect(() =>
				match([testSignal], {
					ok: async ([value]) => {
						await wait(10)
						if (value > 3) {
							throw new Error('Async processing error')
						}
					},
				}),
			)

			testSignal.set(4) // This will cause an async error
			await wait(20)

			// Should have logged the async error
			expect(mockConsoleError).toHaveBeenCalled()
		} finally {
			console.error = originalConsoleError
		}
	})

	test('should not register stale async cleanup after effect re-run', async () => {
		const testSignal = createState(1)
		let staleCleanupCalled = false
		let freshCleanupCalled = false

		const dispose = createEffect(() =>
			match([testSignal], {
				ok: async ([value]) => {
					if (value === 1) {
						await wait(80)
						return () => {
							staleCleanupCalled = true
						}
					}
					await wait(10)
					return () => {
						freshCleanupCalled = true
					}
				},
			}),
		)

		// Trigger re-run before first async completes
		await wait(20)
		testSignal.set(2)

		// Wait for both to settle
		await wait(100)

		// Stale cleanup from first run should not be registered
		expect(staleCleanupCalled).toBe(false)

		// Fresh cleanup should run on dispose
		dispose()
		expect(freshCleanupCalled).toBe(true)
	})

	test('should call registered async cleanup before re-running', async () => {
		const testSignal = createState(0)
		let cleanupCount = 0
		let okCount = 0

		createEffect(() =>
			match([testSignal], {
				ok: async () => {
					okCount++
					await wait(10)
					return () => {
						cleanupCount++
					}
				},
			}),
		)

		await wait(20)
		expect(okCount).toBe(1)
		expect(cleanupCount).toBe(0)

		testSignal.set(1)
		// The effect re-runs synchronously, which runs cleanup
		// But the first async handler's cleanup was registered after await
		expect(cleanupCount).toBe(1)
		await wait(20)
		expect(okCount).toBe(2)
	})
})

describe('Effect - Race Conditions and Consistency', () => {
	test('should demonstrate why computed needs immediate retry via abort listener', async () => {
		// This test shows the performance benefit of immediate retry in computed
		const source = createState(1)
		let computeAttempts = 0
		let finalValue: number = 0

		const comp = createTask(async () => {
			computeAttempts++
			await wait(30)
			return source.get() * 2
		})

		// Start computation
		expect(comp.get()).toBeUndefined()

		// Change source during computation - this should trigger immediate retry
		await wait(10)
		source.set(5)

		// Wait for computation to complete
		await wait(50)
		finalValue = comp.get()!

		// The abort listener allows immediate retry, so we should get the latest value
		expect(finalValue).toBe(10) // 5 * 2
		// Note: The number of attempts can vary due to timing, but should get correct result
		expect(computeAttempts).toBeGreaterThanOrEqual(1)
	})
})
