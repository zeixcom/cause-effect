import { describe, expect, test } from 'bun:test'
import { computed, resolve, state, UNSET } from '../'

/* === Tests === */

describe('Resolve Function', () => {
	test('should return discriminated union for successful resolution', () => {
		const a = state(10)
		const b = state('hello')

		const result = resolve({ a, b })

		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.values.a).toBe(10)
			expect(result.values.b).toBe('hello')
			expect(result.errors).toBeUndefined()
			expect(result.pending).toBeUndefined()
		}
	})

	test('should return discriminated union for pending signals', () => {
		const a = state(10)
		const b = state(UNSET)

		const result = resolve({ a, b })

		expect(result.ok).toBe(false)
		expect(result.pending).toBe(true)
		expect(result.values).toBeUndefined()
		expect(result.errors).toBeUndefined()
	})

	test('should return discriminated union for error signals', () => {
		const a = state(10)
		const b = computed(() => {
			throw new Error('Test error')
		})

		const result = resolve({ a, b })

		expect(result.ok).toBe(false)
		expect(result.pending).toBeUndefined()
		expect(result.values).toBeUndefined()
		expect(result.errors).toBeDefined()
		if (result.errors) {
			expect(result.errors[0].message).toBe('Test error')
		}
	})

	test('should handle mixed error and valid signals', () => {
		const valid = state('valid')
		const error1 = computed(() => {
			throw new Error('Error 1')
		})
		const error2 = computed(() => {
			throw new Error('Error 2')
		})

		const result = resolve({ valid, error1, error2 })

		expect(result.ok).toBe(false)
		expect(result.errors).toBeDefined()
		if (result.errors) {
			expect(result.errors).toHaveLength(2)
			expect(result.errors[0].message).toBe('Error 1')
			expect(result.errors[1].message).toBe('Error 2')
		}
	})

	test('should prioritize pending over errors', () => {
		const pending = state(UNSET)
		const error = computed(() => {
			throw new Error('Test error')
		})

		const result = resolve({ pending, error })

		expect(result.ok).toBe(false)
		expect(result.pending).toBe(true)
		expect(result.errors).toBeUndefined()
	})

	test('should handle empty signals object', () => {
		const result = resolve({})

		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.values).toEqual({})
		}
	})

	test('should handle complex nested object signals', () => {
		const user = state({ name: 'Alice', age: 25 })
		const settings = state({ theme: 'dark', lang: 'en' })

		const result = resolve({ user, settings })

		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.values.user.name).toBe('Alice')
			expect(result.values.user.age).toBe(25)
			expect(result.values.settings.theme).toBe('dark')
			expect(result.values.settings.lang).toBe('en')
		}
	})

	test('should handle async computed signals that resolve', async () => {
		const wait = (ms: number) =>
			new Promise(resolve => setTimeout(resolve, ms))

		const asyncSignal = computed(async () => {
			await wait(10)
			return 'async result'
		})

		// Initially should be pending
		let result = resolve({ asyncSignal })
		expect(result.ok).toBe(false)
		expect(result.pending).toBe(true)

		// Wait for resolution
		await wait(20)

		result = resolve({ asyncSignal })
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.values.asyncSignal).toBe('async result')
		}
	})

	test('should handle async computed signals that error', async () => {
		const wait = (ms: number) =>
			new Promise(resolve => setTimeout(resolve, ms))

		const asyncError = computed(async () => {
			await wait(10)
			throw new Error('Async error')
		})

		// Initially should be pending
		let result = resolve({ asyncError })
		expect(result.ok).toBe(false)
		expect(result.pending).toBe(true)

		// Wait for error
		await wait(20)

		result = resolve({ asyncError })
		expect(result.ok).toBe(false)
		expect(result.errors).toBeDefined()
		if (result.errors) {
			expect(result.errors[0].message).toBe('Async error')
		}
	})
})
