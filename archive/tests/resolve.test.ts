import { describe, expect, test } from 'bun:test'
import { Memo, resolve, State, Task, UNSET } from '../../index.ts'

/* === Tests === */

describe('Resolve Function', () => {
	test('should return discriminated union for successful resolution', () => {
		const a = new State(10)
		const b = new State('hello')

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
		const a = new State(10)
		const b = new State(UNSET)

		const result = resolve({ a, b })

		expect(result.ok).toBe(false)
		expect(result.pending).toBe(true)
		expect(result.values).toBeUndefined()
		expect(result.errors).toBeUndefined()
	})

	test('should return discriminated union for error signals', () => {
		const a = new State(10)
		const b = new Memo(() => {
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
		const valid = new State('valid')
		const error1 = new Memo(() => {
			throw new Error('Error 1')
		})
		const error2 = new Memo(() => {
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
		const pending = new State(UNSET)
		const error = new Memo(() => {
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
		const user = new State({ name: 'Alice', age: 25 })
		const settings = new State({ theme: 'dark', lang: 'en' })

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

		const asyncSignal = new Task(async () => {
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
		if (result.ok) expect(result.values.asyncSignal).toBe('async result')
	})

	test('should handle async computed signals that error', async () => {
		const wait = (ms: number) =>
			new Promise(resolve => setTimeout(resolve, ms))

		const asyncError = new Task(async () => {
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
