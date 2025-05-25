import { describe, test, expect, mock } from 'bun:test'
import { state, computed, effect, UNSET } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Effect', function () {
	test('should be triggered after a state change', function () {
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

	test('should be triggered after computed async signals resolve without waterfalls', async function () {
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
			signals: [a, b],
			ok: (aValue, bValue) => {
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

	test('should be triggered repeatedly after repeated state change', async function () {
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

	test('should handle errors in effects', function () {
		const a = state(1)
		const b = computed(() => {
			const v = a.get()
			if (v > 5) throw new Error('Value too high')
			return v * 2
		})
		let normalCallCount = 0
		let errorCallCount = 0
		effect({
			signals: [b],
			ok: () => {
				// console.log('Normal effect:', value)
				normalCallCount++
			},
			err: error => {
				// console.log('Error effect:', error)
				errorCallCount++
				expect(error.message).toBe('Value too high')
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

	test('should handle UNSET values in effects', async function () {
		const a = computed(async () => {
			await wait(100)
			return 42
		})
		let normalCallCount = 0
		let nilCount = 0
		effect({
			signals: [a],
			ok: aValue => {
				normalCallCount++
				expect(aValue).toBe(42)
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
			signals: [count],
			ok: () => {
				okCount++
				// This effect updates the signal it depends on, creating a circular dependency
				count.update(v => ++v)
			},
			err: e => {
				errCount++
				expect(e).toBeInstanceOf(Error)
				expect(e.message).toBe('Circular dependency in effect detected')
			},
		})

		// Verify that the count was changed only once due to the circular dependency error
		expect(count.get()).toBe(1)
		expect(okCount).toBe(1)
		expect(errCount).toBe(1)
	})
})
