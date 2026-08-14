import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createScope,
	createState,
	deriveStore,
	isStore,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type User = { name: string; email: string }

/* === Tests === */

describe('deriveStore', () => {
	describe('synchronous derivation', () => {
		test('derives a record from a computation', () => {
			const first = createState('Alice')
			const store = deriveStore(() => ({
				name: first.get(),
				email: `${first.get().toLowerCase()}@example.com`,
			}))
			expect(store.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
			expect(isStore(store)).toBe(true)
		})

		test('exposes no mutators', () => {
			const store = deriveStore(() => ({ a: 1 }))
			expect('set' in store).toBe(false)
			expect('update' in store).toBe(false)
			expect('add' in store).toBe(false)
			expect('remove' in store).toBe(false)
		})

		test('rejects a proxy write', () => {
			const store = deriveStore(() => ({ a: 1 }))
			expect(() => {
				;(store as unknown as { a: number }).a = 2
			}).toThrow()
		})

		test('recomputes when a dependency changes', () => {
			const n = createState(1)
			const store = deriveStore(() => ({ double: n.get() * 2 }))
			expect(store.get()).toEqual({ double: 2 })

			n.set(5)
			expect(store.get()).toEqual({ double: 10 })
		})

		test('keeps per-property granularity', () => {
			const name = createState('Alice')
			const age = createState(30)
			const store = deriveStore(() => ({ name: name.get(), age: age.get() }))

			const nameRuns: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					nameRuns.push(store.name?.get() as string)
				})
			})
			expect(nameRuns).toEqual(['Alice'])

			// Changing an unrelated property must not re-run the name effect.
			age.set(31)
			expect(nameRuns).toEqual(['Alice'])

			name.set('Bob')
			expect(nameRuns).toEqual(['Alice', 'Bob'])
			dispose()
		})

		test('reaches properties through byKey and the proxy alike', () => {
			const store = deriveStore(() => ({ a: 1, b: 2 }))
			expect(store.byKey('a')?.get()).toBe(1)
			expect(store.a?.get()).toBe(1)
			expect(Array.from(store.keys())).toEqual(['a', 'b'])
		})

		test('tracks a structural change in the key set', () => {
			const wide = createState(false)
			const store = deriveStore(() =>
				wide.get() ? { a: 1, b: 2 } : ({ a: 1 } as { a: number; b?: number }),
			)
			expect(Array.from(store.keys())).toEqual(['a'])

			wide.set(true)
			expect(store.get()).toEqual({ a: 1, b: 2 })
			expect(Array.from(store.keys())).toEqual(['a', 'b'])
			expect(store.byKey('b')?.get()).toBe(2)
		})

		test('iterates key-signal pairs', () => {
			const store = deriveStore(() => ({ a: 1, b: 2 }))
			const entries = Array.from(store).map(([k, s]) => [k, s.get()])
			expect(entries).toEqual([
				['a', 1],
				['b', 2],
			])
		})
	})

	describe('asynchronous derivation', () => {
		test('is readable before the first resolution', async () => {
			const store = deriveStore(
				async () => {
					await wait(10)
					return { name: 'Alice', email: 'alice@example.com' }
				},
				{ initial: { name: '', email: '' } as User },
			)
			// Never unset: the seed is readable immediately.
			expect(store.get()).toEqual({ name: '', email: '' })

			const dispose = createScope(() => {
				createEffect(() => {
					store.get()
				})
			})
			await wait(30)
			expect(store.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
			dispose()
		})

		test('re-derives when a dependency changes', async () => {
			const id = createState(1)
			const store = deriveStore(
				async () => {
					const current = id.get()
					await wait(10)
					return { id: current, label: `user-${current}` }
				},
				{ initial: { id: 0, label: '' } },
			)
			const dispose = createScope(() => {
				createEffect(() => {
					store.get()
				})
			})
			await wait(30)
			expect(store.get()).toEqual({ id: 1, label: 'user-1' })

			id.set(2)
			await wait(30)
			expect(store.get()).toEqual({ id: 2, label: 'user-2' })
			dispose()
		})

		test('this replaces the write-to-state-from-effect pattern', async () => {
			// Previously this pipeline had no derivation path: a Task could only
			// reach a Store through createEffect(() => store.set(task.get())).
			const id = createState(1)
			const user = deriveStore(
				async () => {
					const current = id.get()
					await wait(10)
					return { name: `User ${current}`, email: `u${current}@example.com` }
				},
				{ initial: { name: '', email: '' } as User },
			)

			const seen: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push(user.name?.get() as string)
				})
			})
			await wait(30)
			expect(seen.at(-1)).toBe('User 1')

			id.set(2)
			await wait(30)
			expect(seen.at(-1)).toBe('User 2')
			dispose()
		})
	})

	describe('external push', () => {
		test('drives a record from a watched callback', () => {
			let push: ((patch: Partial<User>) => void) | undefined
			const store = deriveStore(
				{ name: 'Alice', email: 'alice@example.com' } as User,
				{
					watched: emit => {
						push = emit
						return () => {
							push = undefined
						}
					},
				},
			)

			const dispose = createScope(() => {
				createEffect(() => {
					store.get()
				})
			})
			expect(store.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
			expect(push).toBeDefined()

			push?.({ name: 'Bob' })
			expect(store.get()).toEqual({ name: 'Bob', email: 'alice@example.com' })
			dispose()
		})

		test('runs the cleanup when no longer watched', () => {
			let active = false
			const store = deriveStore(
				{ a: 1 },
				{
					watched: () => {
						active = true
						return () => {
							active = false
						}
					},
				},
			)

			const dispose = createScope(() => {
				createEffect(() => {
					store.get()
				})
			})
			expect(active).toBe(true)
			dispose()
			expect(active).toBe(false)
		})
	})
})
