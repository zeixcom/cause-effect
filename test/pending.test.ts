import { describe, expect, test } from 'bun:test'
import {
	abort,
	createEffect,
	createMemo,
	createScope,
	createState,
	createTask,
	deriveList,
	deriveStore,
	isPending,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('isPending', () => {
	test('reports false for a signal with no async origin', () => {
		expect(isPending(createState(1))).toBe(false)
		expect(isPending(createMemo(() => 1))).toBe(false)
		expect(isPending(deriveList(() => [1, 2]))).toBe(false)
		expect(isPending(deriveStore(() => ({ a: 1 })))).toBe(false)
	})

	test('reports false for a non-signal', () => {
		expect(isPending(undefined)).toBe(false)
		expect(isPending(null)).toBe(false)
		expect(isPending(42)).toBe(false)
		expect(isPending({})).toBe(false)
	})

	test('reflects an asynchronous derivation while it is in flight', async () => {
		const task = createTask(async () => {
			await wait(10)
			return 1
		})
		const dispose = createScope(() => {
			createEffect(() => {
				try {
					task.get()
				} catch {
					// unset until resolved
				}
			})
		})
		expect(isPending(task)).toBe(true)

		await wait(30)
		expect(isPending(task)).toBe(false)
		dispose()
	})

	test('resolves through the internal Task of an async derived list', async () => {
		const items = deriveList(
			async () => {
				await wait(10)
				return [1, 2, 3]
			},
			{ initial: [] as number[] },
		)
		const dispose = createScope(() => {
			createEffect(() => {
				items.get()
			})
		})
		// This is inexpressible in v1.x without the utility — a Collection has
		// no isPending() method of its own.
		expect(isPending(items)).toBe(true)
		expect(items.get()).toEqual([])

		await wait(30)
		expect(isPending(items)).toBe(false)
		expect(items.get()).toEqual([1, 2, 3])
		dispose()
	})

	test('resolves through the internal Task of an async derived store', async () => {
		const store = deriveStore(
			async () => {
				await wait(10)
				return { name: 'Alice' }
			},
			{ initial: { name: '' } },
		)
		const dispose = createScope(() => {
			createEffect(() => {
				store.get()
			})
		})
		expect(isPending(store)).toBe(true)

		await wait(30)
		expect(isPending(store)).toBe(false)
		expect(store.get()).toEqual({ name: 'Alice' })
		dispose()
	})

	test('is reactive inside an effect', async () => {
		const task = createTask(async () => {
			await wait(10)
			return 1
		})
		const seen: boolean[] = []
		const dispose = createScope(() => {
			createEffect(() => {
				// The task must be read to start it: isPending() subscribes to the
				// pending state but does not itself trigger the computation.
				try {
					task.get()
				} catch {
					// unset until resolved
				}
				seen.push(isPending(task))
			})
		})
		await wait(30)
		expect(seen[0]).toBe(true)
		expect(seen.at(-1)).toBe(false)
		dispose()
	})
})

describe('abort', () => {
	test('is a no-op for a signal with no async origin', () => {
		expect(() => {
			abort(createState(1))
			abort(createMemo(() => 1))
			abort(deriveList(() => [1]))
			abort(undefined)
		}).not.toThrow()
	})

	test('cancels an in-flight Task', async () => {
		const task = createTask(async () => {
			await wait(20)
			return 1
		})
		const dispose = createScope(() => {
			createEffect(() => {
				try {
					task.get()
				} catch {
					// unset until resolved
				}
			})
		})
		expect(isPending(task)).toBe(true)

		abort(task)
		expect(isPending(task)).toBe(false)
		dispose()
	})

	test('cancels the internal Task of an async derived list', async () => {
		const items = deriveList(
			async () => {
				await wait(20)
				return [1]
			},
			{ initial: [] as number[] },
		)
		const dispose = createScope(() => {
			createEffect(() => {
				items.get()
			})
		})
		expect(isPending(items)).toBe(true)

		abort(items)
		expect(isPending(items)).toBe(false)
		dispose()
	})
})
