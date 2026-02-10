import { describe, expect, test } from 'bun:test'
import { Memo, match, resolve, State, Task, UNSET } from '../../index.ts'

/* === Tests === */

describe('Match Function', () => {
	test('should call ok handler for successful resolution', () => {
		const a = new State(10)
		const b = new State('hello')
		let okCalled = false
		let okValues: { a: number; b: string } | null = null

		match(resolve({ a, b }), {
			ok: values => {
				okCalled = true
				okValues = values
			},
			err: () => {
				throw new Error('Should not be called')
			},
			nil: () => {
				throw new Error('Should not be called')
			},
		})

		expect(okCalled).toBe(true)
		expect(okValues).toBeTruthy()
		expect((okValues as unknown as { a: number; b: string }).a).toBe(10)
		expect((okValues as unknown as { a: number; b: string }).b).toBe(
			'hello',
		)
	})

	test('should call nil handler for pending signals', () => {
		const a = new State(10)
		const b = new State(UNSET)
		let nilCalled = false

		match(resolve({ a, b }), {
			ok: () => {
				throw new Error('Should not be called')
			},
			err: () => {
				throw new Error('Should not be called')
			},
			nil: () => {
				nilCalled = true
			},
		})

		expect(nilCalled).toBe(true)
	})

	test('should call error handler for error signals', () => {
		const a = new State(10)
		const b = new Memo(() => {
			throw new Error('Test error')
		})
		let errCalled = false
		let errValue: Error | null = null

		match(resolve({ a, b }), {
			ok: () => {
				throw new Error('Should not be called')
			},
			err: errors => {
				errCalled = true
				errValue = errors[0]
			},
			nil: () => {
				throw new Error('Should not be called')
			},
		})

		expect(errCalled).toBe(true)
		expect(errValue).toBeTruthy()
		expect((errValue as unknown as Error).message).toBe('Test error')
	})

	test('should handle missing optional handlers gracefully', () => {
		const a = new State(10)
		const result = resolve({ a })

		// Should not throw even with only required ok handler (err and nil are optional)
		expect(() => {
			match(result, {
				ok: () => {
					// This handler is required, but err and nil are optional
				},
			})
		}).not.toThrow()
	})

	test('should return void always', () => {
		const a = new State(42)

		const returnValue = match(resolve({ a }), {
			ok: () => {
				// Even if we try to return something, match should return void
				return 'something'
			},
		})

		expect(returnValue).toBeUndefined()
	})

	test('should handle handler errors by calling error handler', () => {
		const a = new State(10)
		let handlerErrorCalled = false
		let handlerError: Error | null = null

		match(resolve({ a }), {
			ok: () => {
				throw new Error('Handler error')
			},
			err: errors => {
				handlerErrorCalled = true
				handlerError = errors[errors.length - 1] // Last error should be the handler error
			},
		})

		expect(handlerErrorCalled).toBe(true)
		expect(handlerError).toBeTruthy()
		expect((handlerError as unknown as Error).message).toBe('Handler error')
	})

	test('should rethrow handler errors if no error handler available', () => {
		const a = new State(10)

		expect(() => {
			match(resolve({ a }), {
				ok: () => {
					throw new Error('Handler error')
				},
			})
		}).toThrow('Handler error')
	})

	test('should combine existing errors with handler errors', () => {
		const a = new Memo(() => {
			throw new Error('Signal error')
		})
		let allErrors: readonly Error[] | null = null

		match(resolve({ a }), {
			ok: () => {
				// This won't be called since there are errors, but it's required
			},
			err: errors => {
				// First call with signal error
				if (errors.length === 1) {
					throw new Error('Handler error')
				}
				// Second call with both errors
				allErrors = errors
			},
		})

		expect(allErrors).toBeTruthy()
		expect((allErrors as unknown as readonly Error[]).length).toBe(2)
		expect((allErrors as unknown as readonly Error[])[0].message).toBe(
			'Signal error',
		)
		expect((allErrors as unknown as readonly Error[])[1].message).toBe(
			'Handler error',
		)
	})

	test('should work with complex type inference', () => {
		const user = new State({ id: 1, name: 'Alice' })
		const posts = new State([{ id: 1, title: 'Hello' }])
		const settings = new State({ theme: 'dark' })

		let typeTestPassed = false

		match(resolve({ user, posts, settings }), {
			ok: values => {
				// TypeScript should infer these types perfectly
				const userId: number = values.user.id
				const userName: string = values.user.name
				const firstPost = values.posts[0]
				const postTitle: string = firstPost.title
				const theme: string = values.settings.theme

				expect(userId).toBe(1)
				expect(userName).toBe('Alice')
				expect(postTitle).toBe('Hello')
				expect(theme).toBe('dark')
				typeTestPassed = true
			},
		})

		expect(typeTestPassed).toBe(true)
	})

	test('should handle side effects only pattern', () => {
		const count = new State(5)
		const name = new State('test')
		let sideEffectExecuted = false
		let capturedData = ''

		match(resolve({ count, name }), {
			ok: values => {
				// Pure side effect - no return value expected
				sideEffectExecuted = true
				capturedData = `${values.name}: ${values.count}`
				// Even if we try to return something, it should be ignored
				return 'ignored'
			},
		})

		expect(sideEffectExecuted).toBe(true)
		expect(capturedData).toBe('test: 5')
	})

	test('should handle multiple error types correctly', () => {
		const error1 = new Memo(() => {
			throw new Error('First error')
		})
		const error2 = new Memo(() => {
			throw new Error('Second error')
		})
		let errorMessages: string[] = []

		match(resolve({ error1, error2 }), {
			ok: () => {
				// This won't be called since there are errors, but it's required
			},
			err: errors => {
				errorMessages = errors.map(e => e.message)
			},
		})

		expect(errorMessages).toHaveLength(2)
		expect(errorMessages).toContain('First error')
		expect(errorMessages).toContain('Second error')
	})

	test('should work with async computed signals', async () => {
		const wait = (ms: number) =>
			new Promise(resolve => setTimeout(resolve, ms))

		const asyncSignal = new Task(async () => {
			await wait(10)
			return 'async result'
		})

		// Initially should be pending
		let pendingCalled = false
		let okCalled = false
		let finalValue = ''

		let result = resolve({ asyncSignal })
		match(result, {
			ok: values => {
				okCalled = true
				finalValue = values.asyncSignal
			},
			nil: () => {
				pendingCalled = true
			},
		})

		expect(pendingCalled).toBe(true)
		expect(okCalled).toBe(false)

		// Wait for resolution
		await wait(20)

		result = resolve({ asyncSignal })
		match(result, {
			ok: values => {
				okCalled = true
				finalValue = values.asyncSignal
			},
		})

		expect(okCalled).toBe(true)
		expect(finalValue).toBe('async result')
	})

	test('should maintain referential transparency', () => {
		const a = new State(42)
		const result = resolve({ a })
		let callCount = 0

		// Calling match multiple times with same result should be consistent
		match(result, {
			ok: () => {
				callCount++
			},
		})

		match(result, {
			ok: () => {
				callCount++
			},
		})

		expect(callCount).toBe(2)
	})
})

describe('Match Function Integration', () => {
	test('should work seamlessly with resolve', () => {
		const data = new State({ id: 1, value: 'test' })
		let processed = false
		let processedValue = ''

		match(resolve({ data }), {
			ok: values => {
				processed = true
				processedValue = values.data.value
			},
		})

		expect(processed).toBe(true)
		expect(processedValue).toBe('test')
	})

	test('should handle real-world scenario with mixed states', async () => {
		const wait = (ms: number) =>
			new Promise(resolve => setTimeout(resolve, ms))

		const syncData = new State('available')
		const asyncData = new Task(async () => {
			await wait(10)
			return 'loaded'
		})
		const errorData = new Memo(() => {
			throw new Error('Failed to load')
		})

		let pendingCount = 0
		let errorCount = 0
		let successCount = 0

		// Should be pending initially
		let result = resolve({ syncData, asyncData })
		match(result, {
			ok: () => successCount++,
			err: () => errorCount++,
			nil: () => pendingCount++,
		})

		expect(pendingCount).toBe(1)

		// Should have errors when including error signal
		result = resolve({ syncData, asyncData, errorData })
		match(result, {
			ok: () => successCount++,
			err: () => errorCount++,
			nil: () => pendingCount++,
		})

		expect(pendingCount).toBe(2) // Still pending due to async

		// Wait for async to resolve
		await wait(20)

		// Should succeed with just sync and async
		result = resolve({ syncData, asyncData })
		match(result, {
			ok: values => {
				successCount++
				expect(values.syncData).toBe('available')
				expect(values.asyncData).toBe('loaded')
			},
			err: () => errorCount++,
			nil: () => pendingCount++,
		})

		// Should error when including error signal
		result = resolve({ syncData, asyncData, errorData })
		match(result, {
			ok: () => successCount++,
			err: errors => {
				errorCount++
				expect(errors[0].message).toBe('Failed to load')
			},
			nil: () => pendingCount++,
		})

		expect(successCount).toBe(1)
		expect(errorCount).toBe(1)
		expect(pendingCount).toBe(2)
	})
})
