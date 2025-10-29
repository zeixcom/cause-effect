import { describe, expect, mock, test } from 'bun:test'
import { computed, effect, state, UNSET } from '../'

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
		effect({
			signals: { a, b },
			ok: ({ a: aValue, b: bValue }) => {
				result = aValue + bValue
				count++
			},
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

	test('should handle errors in effects', () => {
		const a = state(1)
		const b = computed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		effect({
			signals: { b },
			ok: () => {
				// console.log('Normal effect:', value)
				normalCallCount++
			},
			err: errors => {
				// console.log('Error effect:', error)
				errorCallCount++
				expect(errors[0].message).toBe('Value too high')
			},
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

	test('should handle UNSET values in effects', async () => {
		const a = computed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		effect({
			signals: { a },
			ok: values => {
				normalCallCount++
				expect(values.a).toBe(42)
			},
			nil: () => {
				nilCount++
			},
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

			// Check if console.error was called with the error
			expect(mockConsoleError).toHaveBeenCalledWith(expect.any(Error))

			// Check the error message
			const error = (mockConsoleError as ReturnType<typeof mock>).mock
				.calls[0][0] as Error
			expect(error.message).toBe('Value too high')
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

		effect({
			signals: { count },
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

	test('should pass AbortSignal to async callbacks in matcher syntax', async () => {
		const testSignal = state('test')
		let abortSignalsReceived = 0
		let okCalled = false
		let errCalled = false
		let nilCalled = false

		effect({
			signals: { testSignal },
			ok: async ({ testSignal: value }, abort) => {
				expect(abort).toBeInstanceOf(AbortSignal)
				expect(value).toBe('test')
				abortSignalsReceived++
				okCalled = true
				await wait(10)
			},
			err: async (_errors, abort) => {
				expect(abort).toBeInstanceOf(AbortSignal)
				abortSignalsReceived++
				errCalled = true
				await wait(10)
			},
			nil: async abort => {
				expect(abort).toBeInstanceOf(AbortSignal)
				abortSignalsReceived++
				nilCalled = true
				await wait(10)
			},
		})

		await wait(20)
		expect(okCalled).toBe(true)
		expect(errCalled).toBe(false)
		expect(nilCalled).toBe(false)
		expect(abortSignalsReceived).toBe(1)
	})

	test('should not pass AbortSignal to sync callbacks', () => {
		const testSignal = state('test')
		let syncCallbackArgs: unknown[] = []

		effect({
			signals: { testSignal },
			ok: ({ testSignal: value }) => {
				syncCallbackArgs = [value]
			},
		})

		expect(syncCallbackArgs).toEqual(['test'])
		expect(syncCallbackArgs[0]).not.toBeInstanceOf(AbortSignal)
	})

	test('should abort async operations when signal changes', async () => {
		const testSignal = state(1)
		let operationAborted = false
		let operationCompleted = false
		let abortReason = ''

		effect({
			signals: { testSignal },
			ok: async (_values, abort) => {
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
			},
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

	test('should handle AbortError gracefully without calling err handler', async () => {
		const testSignal = state(1)
		let errorHandlerCalled = false
		let abortHandled = false

		effect({
			signals: { testSignal },
			ok: async (_values, abort) => {
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
						abortHandled = true
					} else {
						throw error
					}
				}
			},
			err: () => {
				errorHandlerCalled = true
			},
		})

		await wait(20)
		testSignal.set(2)
		await wait(50)

		expect(abortHandled).toBe(true)
		expect(errorHandlerCalled).toBe(false)
	})

	test('should handle async effects that return cleanup functions', async () => {
		let asyncEffectCompleted = false
		let cleanupRegistered = false
		const testSignal = state('initial')

		const cleanup = effect({
			signals: { testSignal },
			ok: async () => {
				await wait(30)
				asyncEffectCompleted = true
				return () => {
					cleanupRegistered = true
				}
			},
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

		effect({
			signals: { testSignal },
			ok: async (_values, abort) => {
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
			},
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

	test('should handle mix of sync and async callbacks in same effect', async () => {
		const testSignal = state('test')
		let syncCalled = false
		let asyncCalled = false
		let asyncAbortSignal: AbortSignal | null = null

		effect({
			signals: { testSignal },
			ok: ({ testSignal: value }) => {
				syncCalled = true
				expect(value).toBe('test')
			},
			err: async (_errors, abort) => {
				asyncCalled = true
				asyncAbortSignal = abort
				await wait(10)
			},
		})

		expect(syncCalled).toBe(true)
		expect(asyncCalled).toBe(false)
		expect(asyncAbortSignal).toBe(null)
	})

	test('should handle async errors that are not AbortError', async () => {
		const testSignal = state(1)
		let errorReceived: Error | null = null
		let abortSignalInErrorHandler: AbortSignal | null = null

		const errorThrower = computed(() => {
			const value = testSignal.get()
			if (value > 5) throw new Error('Value too high')
			return value
		})

		effect({
			signals: { errorThrower },
			ok: () => {
				// Normal operation
			},
			err: async ([error], abort) => {
				abortSignalInErrorHandler = abort
				errorReceived = error
				await wait(10)
			},
		})

		testSignal.set(10) // This will cause an error
		await wait(20)

		expect(errorReceived).toBeInstanceOf(Error)
		expect((errorReceived as unknown as Error).message).toBe(
			'Value too high',
		)
		expect(abortSignalInErrorHandler).toBeInstanceOf(AbortSignal)
		expect(
			(abortSignalInErrorHandler as unknown as AbortSignal).aborted,
		).toBe(false)
	})

	test('should handle async nil callback with AbortSignal', async () => {
		let nilCalled = false
		let nilAbortSignal: AbortSignal | null = null

		const asyncComputed = computed(async () => {
			await wait(50)
			return 'computed-value'
		})

		effect({
			signals: { asyncComputed },
			ok: () => {
				// Will be called when computed resolves
			},
			nil: async abort => {
				nilCalled = true
				nilAbortSignal = abort
				await wait(10)
			},
		})

		// nil should be called initially while computed is pending
		await wait(20)
		expect(nilCalled).toBe(true)
		expect(nilAbortSignal).toBeInstanceOf(AbortSignal)
	})

	test('should handle promise-based async effects', async () => {
		let promiseResolved = false
		let effectValue = ''
		const testSignal = state('test-value')

		effect({
			signals: { testSignal },
			ok: async ({ testSignal: value }, abort) => {
				// Simulate async work that respects abort signal
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						effectValue = value
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
			},
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
			effect({
				signals: { testSignal },
				ok: () => {
					syncCallCount++
				},
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

		effect({
			signals: { testSignal },
			ok: async (_values, abort) => {
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
			},
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
