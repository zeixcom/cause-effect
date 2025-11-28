import { describe, expect, mock, test } from 'bun:test'
import {
	createComputed,
	createEffect,
	createState,
	isAbortError,
	match,
	resolve,
	UNSET,
} from '../'

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
		const a = createComputed(async () => {
			await wait(100)
			return 10
		})
		const b = createComputed(async () => {
			await wait(100)
			return 20
		})
		let result = 0
		let count = 0
		createEffect(() => {
			const resolved = resolve({ a, b })
			match(resolved, {
				ok: ({ a: aValue, b: bValue }) => {
					result = aValue + bValue
					count++
				},
			})
		})
		expect(result).toBe(0)
		expect(count).toBe(0)
		await wait(110)
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

	test('should handle errors in effects with resolve handlers', () => {
		const a = createState(1)
		const b = createComputed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		createEffect(() => {
			const resolved = resolve({ b })
			match(resolved, {
				ok: () => {
					normalCallCount++
				},
				err: errors => {
					errorCallCount++
					expect(errors[0].message).toBe('Value too high')
				},
			})
		})

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

	test('should handle errors in effects with resolve result', () => {
		const a = createState(1)
		const b = createComputed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		createEffect(() => {
			const result = resolve({ b })
			if (result.ok) {
				normalCallCount++
			} else if (result.errors) {
				errorCallCount++
				expect(result.errors[0].message).toBe('Value too high')
			}
		})

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

	test('should handle UNSET values in effects with resolve handlers', async () => {
		const a = createComputed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		createEffect(() => {
			const resolved = resolve({ a })
			match(resolved, {
				ok: values => {
					normalCallCount++
					expect(values.a).toBe(42)
				},
				nil: () => {
					nilCount++
				},
			})
		})

		expect(normalCallCount).toBe(0)
		expect(nilCount).toBe(1)
		expect(a.get()).toBe(UNSET)
		await wait(110)
		expect(normalCallCount).toBeGreaterThan(0)
		expect(nilCount).toBe(1)
		expect(a.get()).toBe(42)
	})

	test('should handle UNSET values in effects with resolve result', async () => {
		const a = createComputed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		createEffect(() => {
			const result = resolve({ a })
			if (result.ok) {
				normalCallCount++
				expect(result.values.a).toBe(42)
			} else if (result.pending) {
				nilCount++
			}
		})

		expect(normalCallCount).toBe(0)
		expect(nilCount).toBe(1)
		expect(a.get()).toBe(UNSET)
		await wait(110)
		expect(normalCallCount).toBeGreaterThan(0)
		expect(nilCount).toBe(1)
		expect(a.get()).toBe(42)
	})

	test('should log error to console when error is not handled', () => {
		// Mock console.error
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const a = createState(1)
			const b = createComputed(() => {
				const v = a.get()
				if (v > 5) throw new Error('Value too high')
				return v * 2
			})

			// Create an effect without explicit error handling
			createEffect(() => {
				b.get()
			})

			// This should trigger the error
			a.set(6)

			// Check if console.error was called with the error message
			expect(mockConsoleError).toHaveBeenCalledWith(
				'Effect callback error:',
				expect.any(Error),
			)
		} finally {
			// Restore the original console.error
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

	test('should detect and throw error for circular dependencies in effects', () => {
		let okCount = 0
		let errCount = 0
		const count = createState(0)

		createEffect(() => {
			const resolved = resolve({ count })
			match(resolved, {
				ok: () => {
					okCount++
					// This effect updates the signal it depends on, creating a circular dependency
					count.update(v => ++v)
				},
				err: errors => {
					errCount++
					expect(errors[0]).toBeInstanceOf(Error)
					expect(errors[0].message).toBe(
						'Circular dependency detected in effect',
					)
				},
			})
		})

		// Verify that the count was changed only once due to the circular dependency error
		expect(count.get()).toBe(1)
		expect(okCount).toBe(1)
		expect(errCount).toBe(1)
	})
})

describe('Effect - Async with AbortSignal', () => {
	test('should pass AbortSignal to async effect callback', async () => {
		let abortSignalReceived = false
		let effectCompleted = false

		createEffect(async (abort: AbortSignal) => {
			expect(abort).toBeInstanceOf(AbortSignal)
			expect(abort.aborted).toBe(false)
			abortSignalReceived = true

			await wait(50)
			effectCompleted = true
			return () => {}
		})

		expect(abortSignalReceived).toBe(true)
		await wait(60)
		expect(effectCompleted).toBe(true)
	})

	test('should abort async operations when signal changes', async () => {
		const testSignal = createState(1)
		let operationAborted = false
		let operationCompleted = false
		let abortReason: DOMException | undefined

		createEffect(async abort => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			abort.addEventListener('abort', () => {
				operationAborted = true
				abortReason = abort.reason
			})

			try {
				await wait(100)
				operationCompleted = true
			} catch (error) {
				if (
					error instanceof DOMException &&
					error.name === 'AbortError'
				) {
					operationAborted = true
				}
			}
		})

		// Change signal quickly to trigger abort
		await wait(20)
		testSignal.set(2)

		await wait(50)
		expect(operationAborted).toBe(true)
		expect(operationCompleted).toBe(false)
		expect(abortReason instanceof DOMException).toBe(true)
		expect((abortReason as DOMException).name).toBe('AbortError')
	})

	test('should abort async operations on effect cleanup', async () => {
		let operationAborted = false
		let abortReason: DOMException | undefined

		const cleanup = createEffect(async abort => {
			abort.addEventListener('abort', () => {
				operationAborted = true
				abortReason = abort.reason
			})

			await wait(100)
		})

		await wait(20)
		cleanup()

		await wait(30)
		expect(operationAborted).toBe(true)
		expect(abortReason instanceof DOMException).toBe(true)
		expect((abortReason as DOMException).name).toBe('AbortError')
	})

	test('should handle AbortError gracefully without logging to console', async () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const testSignal = createState(1)

			createEffect(async abort => {
				const result = resolve({ testSignal })
				if (!result.ok) return

				try {
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 100)
						abort.addEventListener('abort', () => {
							clearTimeout(timeout)
							reject(new DOMException('Aborted', 'AbortError'))
						})
					})
				} catch (error) {
					if (
						error instanceof DOMException &&
						error.name === 'AbortError'
					) {
						// This is expected, should not be logged
						return
					} else {
						throw error
					}
				}
			})

			await wait(20)
			testSignal.set(2)
			await wait(50)

			// Should not have logged the AbortError
			expect(mockConsoleError).not.toHaveBeenCalledWith(
				'Effect callback error:',
				expect.any(DOMException),
			)
		} finally {
			console.error = originalConsoleError
		}
	})

	test('should handle async effects that return cleanup functions', async () => {
		let asyncEffectCompleted = false
		let cleanupRegistered = false
		const testSignal = createState('initial')

		const cleanup = createEffect(async () => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			await wait(30)
			asyncEffectCompleted = true
			return () => {
				cleanupRegistered = true
			}
		})

		// Wait for async effect to complete
		await wait(50)
		expect(asyncEffectCompleted).toBe(true)

		cleanup()
		expect(cleanupRegistered).toBe(true)
		expect(cleanup).toBeInstanceOf(Function)
	})

	test('should handle rapid signal changes with concurrent async operations', async () => {
		const testSignal = createState(0)
		let completedOperations = 0
		let abortedOperations = 0

		createEffect(async abort => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			try {
				await wait(30)
				if (!abort.aborted) {
					completedOperations++
				}
			} catch (error) {
				if (
					error instanceof DOMException &&
					error.name === 'AbortError'
				) {
					abortedOperations++
				}
			}
		})

		// Rapidly change signal multiple times
		testSignal.set(1)
		await wait(5)
		testSignal.set(2)
		await wait(5)
		testSignal.set(3)
		await wait(5)
		testSignal.set(4)

		// Wait for all operations to complete or abort
		await wait(60)

		// Only the last operation should complete
		expect(completedOperations).toBe(1)
		expect(abortedOperations).toBe(0) // AbortError is handled gracefully, not thrown
	})

	test('should handle async errors that are not AbortError', async () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const testSignal = createState(1)

			const errorThrower = createComputed(() => {
				const value = testSignal.get()
				if (value > 5) throw new Error('Value too high')
				return value
			})

			createEffect(async () => {
				const result = resolve({ errorThrower })
				if (result.ok) {
					// Normal operation
				} else if (result.errors) {
					// Handle errors from resolve
					expect(result.errors[0].message).toBe('Value too high')
					return
				}

				// Simulate an async error that's not an AbortError
				if (result.ok && result.values.errorThrower > 3) {
					throw new Error('Async processing error')
				}
			})

			testSignal.set(4) // This will cause an async error
			await wait(20)

			// Should have logged the async error
			expect(mockConsoleError).toHaveBeenCalledWith(
				'Async effect error:',
				expect.any(Error),
			)
		} finally {
			console.error = originalConsoleError
		}
	})

	test('should handle promise-based async effects', async () => {
		let promiseResolved = false
		let effectValue = ''
		const testSignal = createState('test-value')

		createEffect(async abort => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			// Simulate async work that respects abort signal
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					effectValue = result.values.testSignal
					promiseResolved = true
					resolve()
				}, 40)

				abort.addEventListener('abort', () => {
					clearTimeout(timeout)
					reject(new DOMException('Aborted', 'AbortError'))
				})
			})

			return () => {
				// Cleanup function
			}
		})

		await wait(60)
		expect(promiseResolved).toBe(true)
		expect(effectValue).toBe('test-value')
	})

	test('should not create AbortController for sync functions', () => {
		const testSignal = createState('test')
		let syncCallCount = 0

		// Mock AbortController constructor to detect if it's called
		const originalAbortController = globalThis.AbortController
		let abortControllerCreated = false

		globalThis.AbortController = class extends originalAbortController {
			constructor() {
				super()
				abortControllerCreated = true
			}
		}

		try {
			createEffect(() => {
				const result = resolve({ testSignal })
				if (result.ok) {
					syncCallCount++
				}
			})

			testSignal.set('changed')
			expect(syncCallCount).toBe(2)
			expect(abortControllerCreated).toBe(false)
		} finally {
			globalThis.AbortController = originalAbortController
		}
	})

	test('should handle concurrent async operations with abort', async () => {
		const testSignal = createState(1)
		let operation1Completed = false
		let operation1Aborted = false

		createEffect(async abort => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			try {
				// Create a promise that can be aborted
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						operation1Completed = true
						resolve()
					}, 80)

					abort.addEventListener('abort', () => {
						operation1Aborted = true
						clearTimeout(timeout)
						reject(new DOMException('Aborted', 'AbortError'))
					})
				})
			} catch (error) {
				if (
					error instanceof DOMException &&
					error.name === 'AbortError'
				) {
					// Expected when aborted
					return
				}
				throw error
			}
		})

		// Start first operation
		await wait(20)

		// Trigger second operation before first completes
		testSignal.set(2)

		// Wait a bit for abort to take effect
		await wait(30)

		expect(operation1Aborted).toBe(true)
		expect(operation1Completed).toBe(false)
	})
})

describe('Effect + Resolve Integration', () => {
	test('should work with resolve discriminated union', () => {
		const a = createState(10)
		const b = createState('hello')
		let effectRan = false

		createEffect(() => {
			const result = resolve({ a, b })

			if (result.ok) {
				effectRan = true
				expect(result.values.a).toBe(10)
				expect(result.values.b).toBe('hello')
			}
		})

		expect(effectRan).toBe(true)
	})

	test('should work with match function', () => {
		const a = createState(42)
		let matchedValue = 0

		createEffect(() => {
			const result = resolve({ a })
			match(result, {
				ok: values => {
					matchedValue = values.a
				},
			})
		})

		expect(matchedValue).toBe(42)
	})
})

describe('Effect - Race Conditions and Consistency', () => {
	test('should handle race conditions between abort and cleanup properly', async () => {
		// This test explores potential race conditions in effect cleanup
		const testSignal = createState(0)
		let cleanupCallCount = 0
		let abortCallCount = 0
		let operationCount = 0

		createEffect(async abort => {
			testSignal.get()
			++operationCount

			abort.addEventListener('abort', () => {
				abortCallCount++
			})

			try {
				await wait(50)
				// This cleanup should only be registered if the operation wasn't aborted
				return () => {
					cleanupCallCount++
				}
			} catch (error) {
				if (!isAbortError(error)) throw error
			}
		})

		// Rapid signal changes to test race conditions
		testSignal.set(1)
		await wait(10)
		testSignal.set(2)
		await wait(10)
		testSignal.set(3)
		await wait(100) // Let all operations complete

		// Without proper abort handling, we might get multiple cleanups
		expect(cleanupCallCount).toBeLessThanOrEqual(1) // Should be at most 1
		expect(operationCount).toBeGreaterThan(1) // Should have multiple operations
		expect(abortCallCount).toBeGreaterThan(0) // Should have some aborts
	})

	test('should demonstrate difference in abort handling between computed and effect', async () => {
		// This test shows why computed needs an abort listener but effect might not
		const source = createState(1)
		let computedRetries = 0
		let effectRuns = 0

		// Computed with abort listener (current implementation)
		const comp = createComputed(async () => {
			computedRetries++
			await wait(30)
			return source.get() * 2
		})

		// Effect without abort listener (current implementation)
		createEffect(async () => {
			effectRuns++
			// Must access the source to make effect reactive
			source.get()
			await wait(30)
			resolve({ comp })
			// Effect doesn't need to return a value immediately
		})

		// Change source rapidly
		source.set(2)
		await wait(10)
		source.set(3)
		await wait(50)

		// Computed should retry efficiently due to abort listener
		// Effect should handle the changes naturally through dependency tracking
		expect(computedRetries).toBeGreaterThan(0)
		expect(effectRuns).toBeGreaterThan(0)
	})

	test('should prevent stale cleanup registration with generation counter approach', async () => {
		// This test verifies that the currentController check prevents stale cleanups
		const testSignal = createState(0)
		let cleanupCallCount = 0
		let effectRunCount = 0
		let staleCleanupAttempts = 0

		createEffect(async () => {
			effectRunCount++
			const currentRun = effectRunCount
			testSignal.get() // Make reactive

			try {
				await wait(60)
				// This cleanup should only be registered for the latest run
				return () => {
					cleanupCallCount++
					if (currentRun !== effectRunCount) {
						staleCleanupAttempts++
					}
				}
			} catch (error) {
				if (!isAbortError(error)) throw error
				return undefined
			}
		})

		// Trigger multiple rapid changes
		testSignal.set(1)
		await wait(20)
		testSignal.set(2)
		await wait(20)
		testSignal.set(3)
		await wait(80) // Let final operation complete

		// Should have multiple runs but only one cleanup (from the last successful run)
		expect(effectRunCount).toBeGreaterThan(1)
		expect(cleanupCallCount).toBeLessThanOrEqual(1)
		expect(staleCleanupAttempts).toBe(0) // No stale cleanups should be registered
	})

	test('should demonstrate why computed needs immediate retry via abort listener', async () => {
		// This test shows the performance benefit of immediate retry in computed
		const source = createState(1)
		let computeAttempts = 0
		let finalValue: number = 0

		const comp = createComputed(async () => {
			computeAttempts++
			await wait(30)
			return source.get() * 2
		})

		// Start computation
		expect(comp.get()).toBe(UNSET)

		// Change source during computation - this should trigger immediate retry
		await wait(10)
		source.set(5)

		// Wait for computation to complete
		await wait(50)
		finalValue = comp.get()

		// The abort listener allows immediate retry, so we should get the latest value
		expect(finalValue).toBe(10) // 5 * 2
		// Note: The number of attempts can vary due to timing, but should get correct result
		expect(computeAttempts).toBeGreaterThanOrEqual(1)
	})
})
