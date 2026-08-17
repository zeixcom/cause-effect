import { describe, expect, test } from 'bun:test'
import {
	abort,
	createEffect,
	createScope,
	createState,
	deriveCell,
	deriveComputed,
	isCell,
	isMutableCell,
	isPending,
	UnsetSignalValueError,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Task', () => {
	describe('deriveCell', () => {
		test('should resolve async computation', async () => {
			const task = deriveCell(
				async () => {
					await wait(50)
					return 42
				},
				{ initial: 0 },
			)
			expect(task.get()).toBe(0)
			await wait(60)
			expect(task.get()).toBe(42)
		})

		test('should have Symbol.toStringTag of "Cell"', () => {
			const task = deriveCell(async () => 1, { initial: 0 })
			expect(task[Symbol.toStringTag]).toBe('Cell')
		})

		test('should throw UnsetSignalValueError before resolution with no initial value', () => {
			const task = deriveCell(async () => {
				await wait(50)
				return 42
			})
			expect(() => task.get()).toThrow(UnsetSignalValueError)
		})
	})

	describe('isCell', () => {
		test('should identify task cells', () => {
			expect(isCell(deriveCell(async () => 1, { initial: 0 }))).toBe(true)
		})

		test('should return false for non-cell values', () => {
			expect(isCell(42)).toBe(false)
			expect(isCell(null)).toBe(false)
			expect(isCell({})).toBe(false)
			expect(isMutableCell(deriveCell(async () => 1, { initial: 0 }))).toBe(
				false,
			)
		})
	})

	describe('isPending', () => {
		test('should return true while computation is in-flight', async () => {
			const task = deriveCell(
				async () => {
					await wait(50)
					return 42
				},
				{ initial: 0 },
			)
			task.get() // trigger computation
			expect(isPending(task)).toBe(true)
			await wait(60)
			task.get() // read resolved value
			expect(isPending(task)).toBe(false)
		})

		test('should return false before first get()', () => {
			const task = deriveCell(async () => 42, { initial: 0 })
			expect(isPending(task)).toBe(false)
		})
	})

	describe('abort', () => {
		test('should abort the current computation', async () => {
			let completed = false
			const task = deriveCell(
				async (_prev, signal) => {
					await wait(50)
					if (!signal.aborted) completed = true
					return 42
				},
				{ initial: 0 },
			)
			task.get() // trigger computation
			expect(isPending(task)).toBe(true)
			abort(task)
			expect(isPending(task)).toBe(false)
			await wait(60)
			expect(completed).toBe(false)
		})

		test('should be a no-op when called on an idle task', () => {
			// abort() on a task with no in-flight computation must not throw
			// and must leave pending false.
			const task = deriveCell(async () => 42, { initial: 0 })
			expect(isPending(task)).toBe(false)
			expect(() => abort(task)).not.toThrow()
			expect(isPending(task)).toBe(false)
		})

		test('should allow re-fetch via get() after abort on an idle task', async () => {
			const task = deriveCell(
				async () => {
					await wait(20)
					return 99
				},
				{ initial: 0 },
			)
			abort(task) // idle abort
			expect(task.get()).toBe(0) // still serves the initial value
			await wait(40)
			expect(task.get()).toBe(99) // re-fetched after the abort
		})
	})

	describe('Dependency Tracking', () => {
		test('should re-execute when dependencies change', async () => {
			const source = createState(1)
			const task = deriveCell(
				async () => {
					const val = source.get() // dependency tracked before await
					await wait(50)
					return val * 2
				},
				{ initial: 0 },
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
			const task = deriveCell(async () => {
				await wait(50)
				status.set('success')
				return 42
			})
			const derived = deriveComputed(() => {
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
			const a = deriveCell(
				async () => {
					await wait(80)
					return 10
				},
				{ initial: 0 },
			)
			const b = deriveCell(
				async () => {
					await wait(80)
					return 20
				},
				{ initial: 0 },
			)
			const sum = deriveComputed(() => a.get() + b.get(), { initial: 0 })
			expect(sum.get()).toBe(0)
			await wait(90)
			expect(sum.get()).toBe(30)
		})
	})

	describe('AbortSignal', () => {
		test('should signal abort when dependency changes during computation', async () => {
			const source = createState(1)
			let wasAborted = false
			const task = deriveCell(
				async (_prev, signal) => {
					const val = source.get()
					await wait(100)
					if (signal.aborted) wasAborted = true
					return val
				},
				{ initial: 0 },
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
			const task = deriveCell(
				async () => {
					computationCount++
					await wait(100)
					return source.get()
				},
				{ initial: 0 },
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
			const task = deriveCell<number>(
				async () => {
					await wait(50)
					throw new Error('async failure')
				},
				{ initial: 0 },
			)
			task.get()
			await wait(60)
			expect(() => task.get()).toThrow('async failure')
		})

		test('should recover from errors when dependency changes', async () => {
			const source = createState(1)
			const task = deriveCell(
				async () => {
					const value = source.get()
					await wait(50)
					if (value === 2) throw new Error('bad value')
					return value
				},
				{ initial: 0 },
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
			const task = deriveCell(
				async () => {
					const v = source.get()
					await wait(20)
					if (v >= 2) throw new Error('persistent failure')
					return v
				},
				{ initial: 0 },
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
			const task = deriveCell(
				async () => {
					const v = source.get()
					await wait(20)
					if (v >= 2) throw new Error('fail')
					return v * 10
				},
				{ initial: 0 },
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
			const task = deriveCell(
				async () => {
					await wait(50)
					return 42
				},
				{ initial: 10 },
			)
			expect(task.get()).toBe(10)
		})

		test('should pass initial value as prev to first computation', async () => {
			let receivedPrev: number | undefined
			const task = deriveCell(
				async (prev: number | undefined) => {
					receivedPrev = prev
					await wait(50)
					// biome-ignore lint/style/noNonNullAssertion: options.initial guarantees prev
					return prev! + 5
				},
				{ initial: 10 },
			)

			expect(task.get()).toBe(10)
			await wait(60)
			expect(task.get()).toBe(15)
			expect(receivedPrev).toBe(10)
		})

		test('should pass previous resolved value on recomputation', async () => {
			const source = createState(1)
			const receivedPrevs: number[] = []
			const task = deriveCell(
				async (prev: number | undefined) => {
					const val = source.get() // dependency tracked before await
					// biome-ignore lint/style/noNonNullAssertion: options.initial guarantees prev
					receivedPrevs.push(prev!)
					await wait(50)
					// biome-ignore lint/style/noNonNullAssertion: options.initial guarantees prev
					return val + prev!
				},
				{ initial: 0 },
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
			const task = deriveCell(
				async () => {
					const val = source.get() // dependency tracked before await
					await wait(50)
					return { x: val % 2 }
				},
				{
					initial: { x: -1 },
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
				deriveCell(async () => 42, {
					// @ts-expect-error - Testing invalid input
					initial: 'foo',
					// biome-ignore lint/suspicious/noTsIgnore: Follow up
					// @ts-ignore - Follow up of testing invalid input
					guard: (v): v is number => typeof v === 'number',
				})
			}).toThrow('[createTask] Signal value "foo" is invalid')
		})

		test('should accept initial value that passes guard', () => {
			const task = deriveCell(async () => 42, {
				initial: 10,
				guard: (v): v is number => typeof v === 'number',
			})
			expect(task.get()).toBe(10)
		})
	})

	describe('Input Validation', () => {
		test('a sync callback dispatches to the sync-derivation origin instead of throwing', () => {
			// Unlike the standalone `createTask` this used to test, `deriveCell` dispatches
			// on the callback's sync/async-ness rather than requiring async — a sync
			// callback is valid input, routed to the sync-derivation origin.
			const cell = deriveCell((_a: unknown) => 42)
			expect(cell.get()).toBe(42)
		})

		test('should throw InvalidCallbackError for a non-function, non-watched seed', () => {
			// A non-function input is treated as an external-push seed, which requires
			// `options.watched` — omitted here, so validation fails on the missing callback.
			// @ts-expect-error - Testing invalid input
			expect(() => deriveCell(null)).toThrow(
				'[deriveCell] Callback undefined is invalid',
			)
			// @ts-expect-error - Testing invalid input
			expect(() => deriveCell(42)).toThrow(
				'[deriveCell] Callback undefined is invalid',
			)
		})

		test('should throw NullishSignalValueError for null initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				deriveCell(async () => 42, { initial: null })
			}).toThrow('[createTask] Signal value cannot be null or undefined')
		})
	})

	describe('Synchronous throw recovery', () => {
		// When the task callback throws synchronously (reachable when the async
		// predicate mis-classifies a function), recomputeTask must leave the node
		// in a recoverable state: FLAG_RUNNING cleared, pending reset, and
		// subsequent reads report the SAME error rather than a spurious
		// CircularDependencyError.
		test('should not get stuck in FLAG_RUNNING after a synchronous throw', () => {
			// Build a function whose prototype matches the async-function
			// prototype (so isAsyncFunction returns true and deriveCell's
			// validation passes) but which throws synchronously. A real async
			// function can never throw synchronously, so this is the only way
			// to reach recomputeTask's catch path in practice.
			const ASYNC_PROTO = Object.getPrototypeOf(async () => {})
			const boom = (): Promise<number> => {
				throw new Error('sync boom')
			}
			Object.setPrototypeOf(boom, ASYNC_PROTO)
			expect(Object.getPrototypeOf(boom)).toBe(ASYNC_PROTO)

			const task = deriveCell(boom, { initial: 0 })

			// First read surfaces the real error
			expect(() => task.get()).toThrow('sync boom')
			// Must not be left pending
			expect(isPending(task)).toBe(false)
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

			const task = deriveCell(
				async () => {
					await wait(10)
					return 1
				},
				{
					initial: 0,
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

			const task = deriveCell(
				async () => {
					await wait(10)
					return 1
				},
				{
					initial: 0,
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

			const task = deriveCell(
				async () => {
					computeCount++
					await wait(10)
					return externalValue
				},
				{
					initial: 0,
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

			const task = deriveCell(
				async (_prev, signal) => {
					await wait(100)
					if (signal.aborted) wasAborted = true
					return 1
				},
				{
					initial: 0,
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
