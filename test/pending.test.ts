import { describe, expect, test } from 'bun:test'
import {
	abort,
	createEffect,
	createMemo,
	createScope,
	createSlot,
	createState,
	createTask,
	deriveList,
	deriveStore,
	isPending,
	match,
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

	test('agrees with Task.isPending()', async () => {
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
		expect(isPending(task)).toBe(task.isPending())
		expect(isPending(task)).toBe(true)

		await wait(30)
		expect(isPending(task)).toBe(false)
		expect(task.isPending()).toBe(false)
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

describe('through a Slot', () => {
	test('isPending resolves to the backing Task', async () => {
		const task = createTask(async () => {
			await wait(10)
			return 1
		})
		const slot = createSlot(task)
		const dispose = createScope(() => {
			createEffect(() => {
				try {
					slot.get()
				} catch {
					// unset until resolved
				}
			})
		})
		expect(isPending(slot)).toBe(true)

		await wait(30)
		expect(isPending(slot)).toBe(false)
		dispose()
	})

	test('isPending resolves through a chain of slots', () => {
		const task = createTask(
			async () => {
				await wait(10)
				return 1
			},
			{ value: 0 },
		)
		const outer = createSlot(createSlot(task))
		const dispose = createScope(() => {
			createEffect(() => {
				outer.get()
			})
		})
		expect(isPending(outer)).toBe(true)
		dispose()
	})

	test('isPending reports false for cyclic slots without hanging', () => {
		const a = createSlot(createState(1))
		const b = createSlot(a)
		a.replace(b)
		expect(isPending(a)).toBe(false)
		expect(isPending(b)).toBe(false)
	})

	test('isPending reports false for a slot backed by a descriptor', () => {
		const slot = createSlot({ get: () => 1 })
		expect(isPending(slot)).toBe(false)
	})

	test('abort cancels the backing Task', () => {
		const task = createTask(async () => {
			await wait(20)
			return 1
		})
		const slot = createSlot(task)
		const dispose = createScope(() => {
			createEffect(() => {
				try {
					slot.get()
				} catch {
					// unset until resolved
				}
			})
		})
		expect(isPending(task)).toBe(true)

		abort(slot)
		expect(isPending(task)).toBe(false)
		dispose()
	})
})

describe('match() stale branch', () => {
	test('runs stale for a slot backed by a Task during a re-fetch', async () => {
		const id = createState(1)
		const task = createTask(
			async () => {
				const v = id.get()
				await wait(10)
				return v * 10
			},
			{ value: 0 },
		)
		const slot = createSlot(task)
		const log: string[] = []
		const dispose = createScope(() => {
			createEffect(() =>
				match(slot, {
					ok: v => {
						log.push(`ok:${v}`)
					},
					stale: () => {
						log.push('stale')
					},
				}),
			)
		})
		expect(log).toEqual(['stale'])

		await wait(30)
		expect(log).toEqual(['stale', 'ok:10'])

		id.set(2)
		expect(log.at(-1)).toBe('stale')

		await wait(30)
		expect(log.at(-1)).toBe('ok:20')
		dispose()
	})

	test('runs stale after replace() swaps in a pending Task', async () => {
		const settled = createState(1)
		const slot = createSlot<number>(settled)
		const log: string[] = []
		const dispose = createScope(() => {
			createEffect(() =>
				match(slot, {
					ok: v => {
						log.push(`ok:${v}`)
					},
					stale: () => {
						log.push('stale')
					},
				}),
			)
		})
		expect(log).toEqual(['ok:1'])

		slot.replace(
			createTask(
				async () => {
					await wait(10)
					return 2
				},
				{ value: 1 },
			),
		)
		expect(log.at(-1)).toBe('stale')

		await wait(30)
		expect(log.at(-1)).toBe('ok:2')
		dispose()
	})

	test('runs stale for an async derived list during a re-fetch', async () => {
		const items = deriveList(
			async () => {
				await wait(10)
				return [1, 2]
			},
			{ initial: [] as number[] },
		)
		const log: string[] = []
		const dispose = createScope(() => {
			createEffect(() =>
				match(items, {
					ok: v => {
						log.push(`ok:${v.length}`)
					},
					stale: () => {
						log.push('stale')
					},
				}),
			)
		})
		expect(log).toEqual(['stale'])

		await wait(30)
		expect(log.at(-1)).toBe('ok:2')
		dispose()
	})

	test('runs stale for an async derived store during a re-fetch', async () => {
		const store = deriveStore(
			async () => {
				await wait(10)
				return { name: 'Alice' }
			},
			{ initial: { name: '' } },
		)
		const log: string[] = []
		const dispose = createScope(() => {
			createEffect(() =>
				match(store, {
					ok: v => {
						log.push(`ok:${v.name}`)
					},
					stale: () => {
						log.push('stale')
					},
				}),
			)
		})
		expect(log).toEqual(['stale'])

		await wait(30)
		expect(log.at(-1)).toBe('ok:Alice')
		dispose()
	})
})
