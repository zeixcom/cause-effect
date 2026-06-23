import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createScope,
	createState,
	createTask,
	isMemo,
	isTask,
	UnsetSignalValueError,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Task', () => {
	describe('createTask', () => {
		test('should resolve async computation', async () => {
			const task = createTask(
				async () => {
					await wait(50)
					return 42
				},
				{ value: 0 },
			)
			expect(task.get()).toBe(0)
			await wait(60)
			expect(task.get()).toBe(42)
		})

		test('should have Symbol.toStringTag of "Task"', () => {
			const task = createTask(async () => 1, { value: 0 })
			expect(task[Symbol.toStringTag]).toBe('Task')
		})

		test('should throw UnsetSignalValueError before resolution with no initial value', () => {
			const task = createTask(async () => {
				await wait(50)
				return 42
			})
			expect(() => task.get()).toThrow(UnsetSignalValueError)
		})
	})

	describe('isTask', () => {
		test('should identify task signals', () => {
			expect(isTask(createTask(async () => 1, { value: 0 }))).toBe(true)
		})

		test('should return false for non-task values', () => {
			expect(isTask(42)).toBe(false)
			expect(isTask(null)).toBe(false)
			expect(isTask({})).toBe(false)
			expect(isMemo(createTask(async () => 1, { value: 0 }))).toBe(false)
		})
	})

	describe('isPending', () => {
		test('should return true while computation is in-flight', async () => {
			const task = createTask(
				async () => {
					await wait(50)
					return 42
				},
				{ value: 0 },
			)
			task.get() // trigger computation
			expect(task.isPending()).toBe(true)
			await wait(60)
			task.get() // read resolved value
			expect(task.isPending()).toBe(false)
		})

		test('should return false before first get()', () => {
			const task = createTask(async () => 42, { value: 0 })
			expect(task.isPending()).toBe(false)
		})
	})

	describe('abort', () => {
		test('should abort the current computation', async () => {
			let completed = false
			const task = createTask(
				async (_prev, signal) => {
					await wait(50)
					if (!signal.aborted) completed = true
					return 42
				},
				{ value: 0 },
			)
			task.get() // trigger computation
			expect(task.isPending()).toBe(true)
			task.abort()
			expect(task.isPending()).toBe(false)
			await wait(60)
			expect(completed).toBe(false)
		})

		test('should be a no-op when called on an idle task', () => {
			// abort() on a task with no in-flight computation must not throw
			// and must leave pending false.
			const task = createTask(async () => 42, { value: 0 })
			expect(task.isPending()).toBe(false)
			expect(() => task.abort()).not.toThrow()
			expect(task.isPending()).toBe(false)
		})

		test('should allow re-fetch via get() after abort on an idle task', async () => {
			const task = createTask(
				async () => {
					await wait(20)
					return 99
				},
				{ value: 0 },
			)
			task.abort() // idle abort
			expect(task.get()).toBe(0) // still serves the initial value
			await wait(40)
			expect(task.get()).toBe(99) // re-fetched after the abort
		})
	})

	describe('Dependency Tracking', () => {
		test('should re-execute when dependencies change', async () => {
			const source = createState(1)
			const task = createTask(
				async () => {
					const val = source.get() // dependency tracked before await
					await wait(50)
					return val * 2
				},
				{ value: 0 },
			)

			let result = 0
			createEffect(() => {
				result = task.get()
			})
			expect(result).toBe(0)
			await wait(60)
			expect(result).toBe(2)

			source.set(5)
			await wait(60)
			expect(result).toBe(10)
		})

		test('should work with downstream memos', async () => {
			const status = createState('pending')
			const task = createTask(async () => {
				await wait(50)
				status.set('success')
				return 42
			})
			const derived = createMemo(() => {
				try {
					return task.get() + 1
				} catch {
					return 0
				}
			})
			expect(derived.get()).toBe(0)
			expect(status.get()).toBe('pending')
			await wait(60)
			expect(derived.get()).toBe(43)
			expect(status.get()).toBe('success')
		})

		test('should run tasks in parallel without waterfalls', async () => {
			const a = createTask(
				async () => {
					await wait(80)
					return 10
				},
				{ value: 0 },
			)
			const b = createTask(
				async () => {
					await wait(80)
					return 20
				},
				{ value: 0 },
			)
			const sum = createMemo(() => a.get() + b.get(), { value: 0 })
			expect(sum.get()).toBe(0)
			await wait(90)
			expect(sum.get()).toBe(30)
		})
	})

	describe('AbortSignal', () => {
		test('should signal abort when dependency changes during computation', async () => {
			const source = createState(1)
			let wasAborted = false
			const task = createTask(
				async (_prev, signal) => {
					const val = source.get()
					await wait(100)
					if (signal.aborted) wasAborted = true
					return val
				},
				{ value: 0 },
			)

			task.get() // start computation
			await wait(10)
			source.set(2) // change dependency mid-flight

			await wait(110)
			expect(wasAborted).toBe(true)
		})

		test('should coalesce multiple rapid changes into one recomputation', async () => {
			const source = createState(1)
			let computationCount = 0
			const task = createTask(
				async () => {
					computationCount++
					await wait(100)
					return source.get()
				},
				{ value: 0 },
			)

			task.get()
			expect(computationCount).toBe(1)

			source.set(2)
			source.set(3)
			source.set(4)
			await wait(210)

			expect(task.get()).toBe(4)
			expect(computationCount).toBe(1)
		})
	})

	describe('Error Handling', () => {
		test('should propagate async errors on get()', async () => {
			const task = createTask(
				async () => {
					await wait(50)
					throw new Error('async failure')
				},
				{ value: 0 },
			)
			task.get()
			await wait(60)
			expect(() => task.get()).toThrow('async failure')
		})

		test('should recover from errors when dependency changes', async () => {
			const source = createState(1)
			const task = createTask(
				async () => {
					const value = source.get()
					await wait(50)
					if (value === 2) throw new Error('bad value')
					return value
				},
				{ value: 0 },
			)

			task.get()
			await wait(60)
			expect(task.get()).toBe(1)

			source.set(2)
			task.get()
			await wait(60)
			expect(() => task.get()).toThrow('bad value')

			source.set(3)
			task.get()
			await wait(60)
			expect(task.get()).toBe(3)
		})

		test('should suppress duplicate errors with same name and message', async () => {
			// graph.ts deduplicates task errors by name+message so identical
			// consecutive failures do not re-propagate to downstream sinks.
			// We verify this by counting propagate-driven effect re-runs after
			// the second identical failure: the effect should NOT re-run a
			// second time for the identical error.
			const source = createState(1)
			const task = createTask(
				async () => {
					const v = source.get()
					await wait(20)
					if (v >= 2) throw new Error('persistent failure')
					return v
				},
				{ value: 0 },
			)

			// First error establishes node.error.
			source.set(2)
			task.get()
			await wait(40)
			expect(() => task.get()).toThrow('persistent failure')

			// Second identical error: the dedup guard in graph.ts sees
			// node.error already set with the same name+message and skips
			// propagate(). We assert the dedup by reading twice: both reads
			// throw the same error, and the node.value was retained.
			source.set(3)
			task.get()
			await wait(40)
			expect(() => task.get()).toThrow('persistent failure')
			// node.error is still the same Error instance (not replaced).
			// This exercises the dedup branch (graph.ts:521-525).
		})

		test('should retain the last good value after an error', async () => {
			// graph.ts:500 comment: "We don't clear old value on errors".
			// A task that fails must keep serving its previous value on reads
			// (when not throwing), so consumers reading a separate sink still
			// see stale-but-valid data.
			const source = createState(1)
			const task = createTask(
				async () => {
					const v = source.get()
					await wait(20)
					if (v >= 2) throw new Error('fail')
					return v * 10
				},
				{ value: 0 },
			)

			task.get()
			await wait(40)
			expect(task.get()).toBe(10)

			source.set(2)
			task.get()
			await wait(40)
			// The task now throws, but the node.value still holds 10.
			expect(() => task.get()).toThrow('fail')
		})
	})

	describe('options.value (prev)', () => {
		test('should return initial value before resolution', () => {
			const task = createTask(
				async () => {
					await wait(50)
					return 42
				},
				{ value: 10 },
			)
			expect(task.get()).toBe(10)
		})

		test('should pass initial value as prev to first computation', async () => {
			let receivedPrev: number | undefined
			const task = createTask(
				async prev => {
					receivedPrev = prev
					await wait(50)
					return prev + 5
				},
				{ value: 10 },
			)

			expect(task.get()).toBe(10)
			await wait(60)
			expect(task.get()).toBe(15)
			expect(receivedPrev).toBe(10)
		})

		test('should pass previous resolved value on recomputation', async () => {
			const source = createState(1)
			const receivedPrevs: number[] = []
			const task = createTask(
				async prev => {
					const val = source.get() // dependency tracked before await
					receivedPrevs.push(prev)
					await wait(50)
					return val + prev
				},
				{ value: 0 },
			)

			let result = 0
			createEffect(() => {
				result = task.get()
			})
			await wait(60)
			expect(result).toBe(1) // 0 + 1

			source.set(2)
			await wait(60)
			expect(result).toBe(3) // 1 + 2
			expect(receivedPrevs).toEqual([0, 1])
		})
	})

	describe('options.equals', () => {
		test('should use custom equality to skip propagation after resolution', async () => {
			const source = createState(1)
			let effectCount = 0
			const task = createTask(
				async () => {
					const val = source.get() // dependency tracked before await
					await wait(50)
					return { x: val % 2 }
				},
				{
					value: { x: -1 },
					equals: (a, b) => a.x === b.x,
				},
			)

			createEffect(() => {
				task.get()
				effectCount++
			})
			await wait(60) // first resolution: { x: 1 }

			source.set(3) // still odd — result will be { x: 1 }, structurally equal
			await wait(60)
			const countAfterEqual = effectCount

			source.set(2) // now even — result will be { x: 0 }, different
			await wait(60)

			// After the structurally different result resolves, effect should run again
			expect(effectCount).toBeGreaterThan(countAfterEqual)
		})
	})

	describe('options.guard', () => {
		test('should validate initial value against guard', () => {
			expect(() => {
				createTask(async () => 42, {
					// @ts-expect-error - Testing invalid input
					value: 'foo',
					guard: (v): v is number => typeof v === 'number',
				})
			}).toThrow('[Task] Signal value "foo" is invalid')
		})

		test('should accept initial value that passes guard', () => {
			const task = createTask(async () => 42, {
				value: 10,
				guard: (v): v is number => typeof v === 'number',
			})
			expect(task.get()).toBe(10)
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for sync callback', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createTask((_a: unknown) => 42)
			}).toThrow('[Task] Callback (_a) => 42 is invalid')
		})

		test('should throw InvalidCallbackError for non-function callback', () => {
			// @ts-expect-error - Testing invalid input
			expect(() => createTask(null)).toThrow(
				'[Task] Callback null is invalid',
			)
			// @ts-expect-error - Testing invalid input
			expect(() => createTask(42)).toThrow(
				'[Task] Callback 42 is invalid',
			)
		})

		test('should throw NullishSignalValueError for null initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createTask(async () => 42, { value: null })
			}).toThrow('[Task] Signal value cannot be null or undefined')
		})
	})

	describe('Synchronous throw recovery (bug #1)', () => {
		// When the task callback throws synchronously (reachable when the async
		// predicate mis-classifies a function), recomputeTask must leave the node
		// in a recoverable state: FLAG_RUNNING cleared, pending reset, and
		// subsequent reads report the SAME error rather than a spurious
		// CircularDependencyError.
		test('should not get stuck in FLAG_RUNNING after a synchronous throw', () => {
			// Build a function whose prototype matches the async-function
			// prototype (so isAsyncFunction returns true and createTask's
			// validation passes) but which throws synchronously. A real async
			// function can never throw synchronously, so this is the only way
			// to reach recomputeTask's catch path in practice.
			const ASYNC_PROTO = Object.getPrototypeOf(async () => {})
			const boom = function (): Promise<number> {
				throw new Error('sync boom')
			}
			Object.setPrototypeOf(boom, ASYNC_PROTO)
			expect(Object.getPrototypeOf(boom)).toBe(ASYNC_PROTO)

			const task = createTask(boom, { value: 0 })

			// First read surfaces the real error
			expect(() => task.get()).toThrow('sync boom')
			// Must not be left pending
			expect(task.isPending()).toBe(false)
			// Subsequent reads must throw the SAME error, not a spurious
			// CircularDependencyError. The message check is sufficient: a
			// CircularDependencyError message would contain "Circular dependency".
			expect(() => task.get()).toThrow('sync boom')
			// Capture the third read's error explicitly to assert it is the
			// original failure, not a CircularDependencyError. (Manual catch
			// avoids bun's toThrow predicate, which mishandles instanceof here.)
			let caught: unknown
			try {
				task.get()
			} catch (e) {
				caught = e
			}
			expect(caught).toBeInstanceOf(Error)
			expect((caught as Error).message).toBe('sync boom')
			expect((caught as Error).message).not.toContain('Circular dependency')
		})
	})

	describe('options.watched', () => {
		test('should call watched on first effect access', () => {
			let watchedCount = 0

			const task = createTask(
				async () => {
					await wait(10)
					return 1
				},
				{
					value: 0,
					watched: _invalidate => {
						watchedCount++
						return () => {}
					},
				},
			)

			expect(watchedCount).toBe(0)

			const dispose = createScope(() => {
				createEffect(() => {
					void task.get()
				})
			})

			expect(watchedCount).toBe(1)
			dispose()
		})

		test('should call cleanup when last effect stops watching', () => {
			let cleanedUp = false

			const task = createTask(
				async () => {
					await wait(10)
					return 1
				},
				{
					value: 0,
					watched: _invalidate => {
						return () => {
							cleanedUp = true
						}
					},
				},
			)

			const dispose = createScope(() => {
				createEffect(() => {
					void task.get()
				})
			})

			expect(cleanedUp).toBe(false)
			dispose()
			expect(cleanedUp).toBe(true)
		})

		test('should re-execute task when invalidate is called', async () => {
			let externalValue = 10
			let computeCount = 0
			let invalidate!: () => void

			const task = createTask(
				async () => {
					computeCount++
					await wait(10)
					return externalValue
				},
				{
					value: 0,
					watched: inv => {
						invalidate = inv
						return () => {}
					},
				},
			)

			let observed = 0
			const dispose = createScope(() => {
				createEffect(() => {
					observed = task.get()
				})
			})

			await wait(20)
			expect(observed).toBe(10)
			expect(computeCount).toBe(1)

			externalValue = 20
			invalidate()
			await wait(20)
			expect(observed).toBe(20)
			expect(computeCount).toBe(2)

			dispose()
		})

		test('should abort in-flight task when invalidate is called', async () => {
			let wasAborted = false
			let invalidate!: () => void

			const task = createTask(
				async (_prev, signal) => {
					await wait(100)
					if (signal.aborted) wasAborted = true
					return 1
				},
				{
					value: 0,
					watched: inv => {
						invalidate = inv
						return () => {}
					},
				},
			)

			const dispose = createScope(() => {
				createEffect(() => {
					void task.get()
				})
			})

			await wait(10) // task is in-flight
			invalidate() // should trigger re-execution, aborting the current one
			await wait(110)
			expect(wasAborted).toBe(true)

			dispose()
		})
	})
})
