import { describe, expect, mock, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createScope,
	createState,
	createTask,
	match,
	RequiredOwnerError,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('createEffect', () => {
	test('should run immediately on creation', () => {
		let ran = false
		createEffect(() => {
			ran = true
		})
		expect(ran).toBe(true)
	})

	test('should re-run when a tracked dependency changes', () => {
		const source = createState('foo')
		let count = 0
		createEffect(() => {
			source.get()
			count++
		})
		expect(count).toBe(1)
		source.set('bar')
		expect(count).toBe(2)
	})

	test('should re-run on each state change', () => {
		const source = createState(0)
		let result = 0
		createEffect(() => {
			result = source.get()
		})
		for (let i = 1; i <= 5; i++) {
			source.set(i)
			expect(result).toBe(i)
		}
	})

	test('should handle state updates inside effects', () => {
		const count = createState(0)
		let effectCount = 0
		createEffect(() => {
			effectCount++
			if (count.get() === 0) count.set(1)
		})
		expect(count.get()).toBe(1)
		expect(effectCount).toBe(2)
	})

	describe('Cleanup', () => {
		test('should call cleanup before next run', () => {
			const source = createState(0)
			let cleanupCount = 0
			let effectCount = 0

			createEffect(() => {
				source.get()
				effectCount++
				return () => {
					cleanupCount++
				}
			})

			expect(effectCount).toBe(1)
			expect(cleanupCount).toBe(0)

			source.set(1)
			expect(effectCount).toBe(2)
			expect(cleanupCount).toBe(1)

			source.set(2)
			expect(effectCount).toBe(3)
			expect(cleanupCount).toBe(2)
		})

		test('should call cleanup on disposal', () => {
			const source = createState(0)
			let cleanupCalled = false

			const dispose = createEffect(() => {
				source.get()
				return () => {
					cleanupCalled = true
				}
			})

			expect(cleanupCalled).toBe(false)
			dispose()
			expect(cleanupCalled).toBe(true)
		})

		test('should stop reacting after disposal', () => {
			const source = createState(42)
			let received = 0

			const dispose = createEffect(() => {
				received = source.get()
			})

			source.set(43)
			expect(received).toBe(43)

			dispose()
			source.set(44)
			expect(received).toBe(43)
		})
	})

	describe('Owner Registration', () => {
		test('should dispose nested effects when parent scope is disposed', () => {
			const source = createState(0)
			let innerRuns = 0

			const dispose = createScope(() => {
				createEffect(() => {
					source.get()
					innerRuns++
				})
			})

			expect(innerRuns).toBe(1)
			source.set(1)
			expect(innerRuns).toBe(2)

			dispose()
			source.set(2)
			expect(innerRuns).toBe(2) // no longer reacting
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for non-function', () => {
			// @ts-expect-error - Testing invalid input
			expect(() => createEffect(null)).toThrow(
				'[Effect] Callback null is invalid',
			)
			// @ts-expect-error - Testing invalid input
			expect(() => createEffect(42)).toThrow(
				'[Effect] Callback 42 is invalid',
			)
		})
	})
})

describe('match', () => {
	test('should call ok handler when all signals have values', () => {
		const a = createState(1)
		const b = createState(2)
		let result = 0
		createEffect(() =>
			match([a, b], {
				ok: ([aVal, bVal]) => {
					result = aVal + bVal
				},
			}),
		)
		expect(result).toBe(3)
	})

	test('should call nil handler when signals are unset', async () => {
		const task = createTask(async () => {
			await wait(50)
			return 42
		})
		let okCount = 0
		let nilCount = 0
		createEffect(() =>
			match([task], {
				ok: ([value]) => {
					okCount++
					expect(value).toBe(42)
				},
				nil: () => {
					nilCount++
				},
			}),
		)

		expect(okCount).toBe(0)
		expect(nilCount).toBe(1)
		await wait(60)
		expect(okCount).toBeGreaterThan(0)
		expect(nilCount).toBe(1)
	})

	test('should call err handler when signals throw', () => {
		const a = createState(1)
		const b = createMemo(() => {
			if (a.get() > 5) throw new Error('Too high')
			return a.get() * 2
		})
		let okCount = 0
		let errCount = 0
		createEffect(() =>
			match([b], {
				ok: () => {
					okCount++
				},
				err: errors => {
					errCount++
					expect(errors[0].message).toBe('Too high')
				},
			}),
		)

		expect(okCount).toBe(1)
		a.set(6)
		expect(errCount).toBe(1)

		a.set(3)
		expect(okCount).toBe(2)
		expect(errCount).toBe(1)
	})

	test('should fall back to console.error when err handler is not provided', () => {
		const originalConsoleError = console.error
		const mockConsoleError = mock(() => {})
		console.error = mockConsoleError

		try {
			const a = createState(1)
			const b = createMemo(() => {
				if (a.get() > 5) throw new Error('Too high')
				return a.get() * 2
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

	test('should preserve tuple types in ok handler', () => {
		const a = createState(1)
		const b = createState('hello')
		createEffect(() =>
			match([a, b], {
				ok: ([aVal, bVal]) => {
					// If tuple types are preserved, aVal is number and bVal is string
					// If widened, both would be string | number
					const num: number = aVal
					const str: string = bVal
					expect(num).toBe(1)
					expect(str).toBe('hello')
				},
			}),
		)
	})

	test('should throw RequiredOwnerError when called outside an owner', () => {
		expect(() => match([], { ok: () => {} })).toThrow(RequiredOwnerError)
	})

	test('should resolve multiple async tasks without waterfalls', async () => {
		const a = createTask(async () => {
			await wait(20)
			return 10
		})
		const b = createTask(async () => {
			await wait(20)
			return 20
		})
		let result = 0
		let nilCount = 0
		createEffect(() =>
			match([a, b], {
				ok: ([aVal, bVal]) => {
					result = aVal + bVal
				},
				nil: () => {
					nilCount++
				},
			}),
		)
		expect(result).toBe(0)
		expect(nilCount).toBe(1)
		await wait(30)
		expect(result).toBe(30)
	})

	describe('Async Handlers', () => {
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

			await wait(10)
			dispose()
			await wait(60)

			expect(cleanupRegistered).toBe(false)
		})

		test('should register and run cleanup from completed async handler', async () => {
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

			await wait(20)
			dispose()
			expect(cleanupCalled).toBe(true)
		})

		test('should route async errors to err handler', async () => {
			const originalConsoleError = console.error
			const mockConsoleError = mock(() => {})
			console.error = mockConsoleError

			try {
				const source = createState(1)

				createEffect(() =>
					match([source], {
						ok: async ([value]) => {
							await wait(10)
							if (value > 3) throw new Error('Async error')
						},
					}),
				)

				source.set(4)
				await wait(20)

				expect(mockConsoleError).toHaveBeenCalled()
			} finally {
				console.error = originalConsoleError
			}
		})

		test('should discard stale async cleanup when effect re-runs', async () => {
			const source = createState(1)
			let staleCleanupCalled = false
			let freshCleanupCalled = false

			const dispose = createEffect(() =>
				match([source], {
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

			await wait(20)
			source.set(2)
			await wait(100)

			expect(staleCleanupCalled).toBe(false)

			dispose()
			expect(freshCleanupCalled).toBe(true)
		})

		test('should call async cleanup before re-running', async () => {
			const source = createState(0)
			let cleanupCount = 0
			let okCount = 0

			createEffect(() =>
				match([source], {
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

			source.set(1)
			expect(cleanupCount).toBe(1)
			await wait(20)
			expect(okCount).toBe(2)
		})
	})
})
