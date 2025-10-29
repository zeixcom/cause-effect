import { describe, expect, mock, test } from 'bun:test'
import { computed, effect, match, resolve, state, UNSET } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Effect', () => {
	test('should be triggered after a state change', () => {
		const cause = state('foo')
		let count = 0
		effect(() => {
			cause.get()
			count++
		})
		expect(count).toBe(1)
		cause.set('bar')
		expect(count).toBe(2)
	})

	test('should be triggered after computed async signals resolve without waterfalls', async () => {
		const a = computed(async () => {
			await wait(100)
			return 10
		})
		const b = computed(async () => {
			await wait(100)
			return 20
		})
		let result = 0
		let count = 0
		effect(() => {
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
		const cause = state(0)
		let result = 0
		let count = 0
		effect(() => {
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
		const a = state(1)
		const b = computed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		effect(() => {
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
		const a = state(1)
		const b = computed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		effect(() => {
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
		const a = computed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		effect(() => {
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
		const a = computed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		effect(() => {
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
			const a = state(1)
			const b = computed(() => {
				const v = a.get()
				if (v > 5) throw new Error('Value too high')
				return v * 2
			})

			// Create an effect without explicit error handling
			effect(() => {
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
		const count = state(42)
		let received = 0

		const cleanup = effect(() => {
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
		const count = state(0)

		effect(() => {
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
						'Circular dependency in effect detected',
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

		effect(async (abort: AbortSignal) => {
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
		const testSignal = state(1)
		let operationAborted = false
		let operationCompleted = false
		let abortReason = ''

		effect(async abort => {
			const result = resolve({ testSignal })
			if (!result.ok) return

			abort.addEventListener('abort', () => {
				operationAborted = true
				abortReason = abort.reason || 'No reason'
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
		expect(abortReason).toBe('Aborted because source signal changed')
	})

	test('should abort async operations on effect cleanup', async () => {
		let operationAborted = false
		let abortReason = ''

		const cleanup = effect(async abort => {
			abort.addEventListener('abort', () => {
				operationAborted = true
				abortReason = abort.reason || 'No reason'
			})

			await wait(100)
		})

		await wait(20)
		cleanup()

		await wait(30)
		expect(operationAborted).toBe(true)
		expect(abortReason).toBe('Aborted because cleanup was called')
	})

	test('should handle AbortError gracefully without logging to console', async () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const testSignal = state(1)

			effect(async abort => {
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
		const testSignal = state('initial')

		const cleanup = effect(async () => {
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
		const testSignal = state(0)
		let completedOperations = 0
		let abortedOperations = 0

		effect(async abort => {
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
			const testSignal = state(1)

			const errorThrower = computed(() => {
				const value = testSignal.get()
				if (value > 5) throw new Error('Value too high')
				return value
			})

			effect(async () => {
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
		const testSignal = state('test-value')

		effect(async abort => {
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
		const testSignal = state('test')
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
			effect(() => {
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
		const testSignal = state(1)
		let operation1Completed = false
		let operation1Aborted = false

		effect(async abort => {
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
		const a = state(10)
		const b = state('hello')
		let effectRan = false

		effect(() => {
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
		const a = state(42)
		let matchedValue = 0

		effect(() => {
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
