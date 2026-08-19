import { describe, expect, test } from 'bun:test'
import {
	type CollectionChanges,
	createEffect,
	createList,
	createMemo,
	createScope,
	createState,
	createTask,
	type DerivedList,
	DuplicateKeyError,
	deriveList,
	isCollection,
	type Signal,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type User = { id: string; name: string }

/* === Tests === */

describe('per-item derivation from an unkeyed source', () => {
	test('derives from a Memo<T[]>', () => {
		const source = createState([1, 2, 3])
		const doubled = deriveList(
			createMemo(() => source.get()),
			(v: number) => v * 2,
		)
		expect(doubled.get()).toEqual([2, 4, 6])
		expect(isCollection(doubled)).toBe(true)
	})

	test('derives from a State<T[]> directly', () => {
		const source = createState([1, 2])
		const doubled = deriveList(source, (v: number) => v * 2)
		expect(doubled.get()).toEqual([2, 4])
	})

	test('tracks value changes in the source array', () => {
		const source = createState([1, 2, 3])
		const doubled = deriveList(source, (v: number) => v * 2)
		const seen: number[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				seen.push(doubled.get())
			})
		})
		expect(seen).toEqual([[2, 4, 6]])

		source.set([1, 5, 3])
		expect(seen.at(-1)).toEqual([2, 10, 6])
		dispose()
	})

	test('tracks structural changes in the source array', () => {
		const source = createState([1, 2])
		const doubled = deriveList(source, (v: number) => v * 2)
		const seen: number[] = []
		const dispose = createScope(() => {
			createEffect(() => {
				seen.push(doubled.length)
			})
		})
		expect(seen).toEqual([2])

		source.set([1, 2, 3, 4])
		expect(doubled.get()).toEqual([2, 4, 6, 8])
		expect(seen.at(-1)).toBe(4)
		dispose()
	})

	test('keeps item identity across recomputes with a content-based keyConfig', () => {
		const source = createState<User[]>([
			{ id: 'a', name: 'Alice' },
			{ id: 'b', name: 'Bob' },
		])
		const names = deriveList(source, (u: User) => u.name, {
			keyConfig: (u: User) => u.id,
		})
		expect(Array.from(names.keys())).toEqual(['a', 'b'])

		const before = names.byKey('a')
		// Reorder: 'a' keeps its key and its item signal identity.
		source.set([
			{ id: 'b', name: 'Bob' },
			{ id: 'a', name: 'Alice' },
		])
		expect(Array.from(names.keys())).toEqual(['b', 'a'])
		expect(names.byKey('a')).toBe(before)
		expect(names.get()).toEqual(['Bob', 'Alice'])
	})

	test('drops item signals for keys removed from the source', () => {
		const source = createState<User[]>([
			{ id: 'a', name: 'Alice' },
			{ id: 'b', name: 'Bob' },
		])
		const names = deriveList(source, (u: User) => u.name, {
			keyConfig: (u: User) => u.id,
		})
		expect(names.byKey('b')).toBeDefined()

		source.set([{ id: 'a', name: 'Alice' }])
		expect(names.get()).toEqual(['Alice'])
		expect(names.byKey('b')).toBeUndefined()
	})

	test('reads an unresolved Task source as empty rather than throwing', async () => {
		const source = createTask(async () => {
			await wait(10)
			return [1, 2, 3]
		})
		const doubled = deriveList(source, (v: number) => v * 2)

		// This is the case that previously had no derivation path at all.
		expect(doubled.get()).toEqual([])
		expect(doubled.length).toBe(0)

		const seen: number[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				seen.push(doubled.get())
			})
		})
		await wait(30)
		expect(doubled.get()).toEqual([2, 4, 6])
		expect(seen.at(-1)).toEqual([2, 4, 6])
		dispose()
	})

	describe('cached item signals', () => {
		// The trigger in every case below is caching the item signal OUTSIDE the
		// effect, so the effect's only edge is item-Memo -> source and the
		// collection's own rebuild never runs in the propagation pass.

		test('survives a reorder of the source', () => {
			const source = createState<User[]>([
				{ id: 'a', name: 'Alice' },
				{ id: 'b', name: 'Bob' },
			])
			const names = deriveList(source, (u: User) => u.name, {
				keyConfig: (u: User) => u.id,
			})
			const sigA = names.byKey('a')
			const seen: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push(sigA?.get() as string)
				})
			})
			expect(seen).toEqual(['Alice'])

			source.set([
				{ id: 'b', name: 'Bob' },
				{ id: 'a', name: 'Alice' },
			])
			// 'a' still maps to Alice; only its position moved.
			expect(seen.at(-1)).toBe('Alice')
			dispose()
		})

		test('survives an insertion before the cached key', () => {
			const source = createState<User[]>([{ id: 'b', name: 'Bob' }])
			const names = deriveList(source, (u: User) => u.name, {
				keyConfig: (u: User) => u.id,
			})
			const sigB = names.byKey('b')
			const seen: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push(sigB?.get() as string)
				})
			})
			expect(seen).toEqual(['Bob'])

			source.set([
				{ id: 'a', name: 'Alice' },
				{ id: 'b', name: 'Bob' },
			])
			expect(seen.at(-1)).toBe('Bob')
			dispose()
		})

		test('survives a removal before the cached key', () => {
			const source = createState<User[]>([
				{ id: 'a', name: 'Alice' },
				{ id: 'b', name: 'Bob' },
			])
			const names = deriveList(source, (u: User) => u.name, {
				keyConfig: (u: User) => u.id,
			})
			const sigB = names.byKey('b')
			const seen: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push(sigB?.get() as string)
				})
			})
			expect(seen).toEqual(['Bob'])

			source.set([{ id: 'b', name: 'Bob' }])
			expect(seen.at(-1)).toBe('Bob')
			dispose()
		})

		test('holds for a cached item of a sync deriveList', () => {
			const source = createState<User[]>([
				{ id: 'a', name: 'Alice' },
				{ id: 'b', name: 'Bob' },
			])
			const items = deriveList(() => source.get(), {
				keyConfig: (u: User) => u.id,
			})
			const sigA = items.byKey('a')
			const seen: string[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push((sigA as Signal<User>).get().name)
				})
			})
			expect(seen).toEqual(['Alice'])

			source.set([
				{ id: 'b', name: 'Bob' },
				{ id: 'a', name: 'Alice' },
			])
			expect(seen.at(-1)).toBe('Alice')
			dispose()
		})

		test('holds for a cached item of an async deriveList', async () => {
			const order = createState(0)
			const items = deriveList(
				async () => {
					const flipped = order.get() > 0
					await wait(10)
					return flipped
						? [
								{ id: 'b', name: 'Bob' },
								{ id: 'a', name: 'Alice' },
							]
						: [
								{ id: 'a', name: 'Alice' },
								{ id: 'b', name: 'Bob' },
							]
				},
				{ initial: [] as User[], keyConfig: (u: User) => u.id },
			)
			const dispose = createScope(() => {
				createEffect(() => {
					items.get()
				})
			})
			await wait(30)
			const sigA = items.byKey('a')
			expect((sigA as Signal<User>).get().name).toBe('Alice')

			order.set(1)
			await wait(30)
			expect((sigA as Signal<User>).get().name).toBe('Alice')
			dispose()
		})
	})

	test('a List source still uses its own stable keys', () => {
		const list = createList([1, 2, 3])
		const doubled = deriveList(list, (v: number) => v * 2)
		const keys = Array.from(list.keys())
		expect(Array.from(doubled.keys())).toEqual(keys)
		expect(doubled.get()).toEqual([2, 4, 6])

		list.add(4)
		expect(doubled.get()).toEqual([2, 4, 6, 8])
	})
})

describe('deriveList', () => {
	describe('synchronous derivation', () => {
		test('derives a keyed sequence from a computation', () => {
			const factor = createState(2)
			const items = deriveList(() => [1, 2, 3].map(v => v * factor.get()))
			expect(items.get()).toEqual([2, 4, 6])

			factor.set(3)
			expect(items.get()).toEqual([3, 6, 9])
		})

		test('exposes no mutators', () => {
			const items = deriveList(() => [1, 2])
			expect('set' in items).toBe(false)
			expect('add' in items).toBe(false)
			expect('remove' in items).toBe(false)
		})

		test('re-runs an effect on structural change', () => {
			const n = createState(2)
			const items = deriveList(() =>
				Array.from({ length: n.get() }, (_, i) => i),
			)
			const seen: number[] = []
			const dispose = createScope(() => {
				createEffect(() => {
					seen.push(items.length)
				})
			})
			expect(seen).toEqual([2])

			n.set(4)
			expect(seen.at(-1)).toBe(4)
			dispose()
		})

		test('supports per-item access', () => {
			const items = deriveList(() => [10, 20, 30])
			expect(items.at(1)?.get()).toBe(20)
			expect(items.keyAt(1)).toBe(items.keyAt(1))
			expect(items.indexOfKey(items.keyAt(2) as string)).toBe(2)
		})
	})

	describe('asynchronous derivation', () => {
		test('is readable as empty before the first resolution', async () => {
			const items = deriveList(
				async () => {
					await wait(10)
					return [1, 2, 3]
				},
				{ initial: [] },
			)
			// Never unset: length and iteration are total from the start.
			expect(items.get()).toEqual([])
			expect(items.length).toBe(0)
			expect(Array.from(items)).toEqual([])

			const dispose = createScope(() => {
				createEffect(() => {
					items.get()
				})
			})
			await wait(30)
			expect(items.get()).toEqual([1, 2, 3])
			dispose()
		})

		test('honours a non-empty initial value', () => {
			const items = deriveList(
				async () => {
					await wait(10)
					return [9]
				},
				{ initial: [1, 2] },
			)
			expect(items.get()).toEqual([1, 2])
		})

		test('re-derives when a dependency changes', async () => {
			const query = createState('a')
			const items = deriveList(
				async () => {
					const q = query.get()
					await wait(10)
					return [`${q}1`, `${q}2`]
				},
				{ initial: [] as string[] },
			)
			const dispose = createScope(() => {
				createEffect(() => {
					items.get()
				})
			})
			await wait(30)
			expect(items.get()).toEqual(['a1', 'a2'])

			query.set('b')
			await wait(30)
			expect(items.get()).toEqual(['b1', 'b2'])
			dispose()
		})
	})

	describe('external push', () => {
		test('drives a sequence from a watched callback', async () => {
			let push: ((changes: CollectionChanges<number>) => void) | undefined
			const items = deriveList([1, 2], {
				watched: apply => {
					push = apply
					return () => {
						push = undefined
					}
				},
			})

			const dispose = createScope(() => {
				createEffect(() => {
					items.get()
				})
			})
			expect(items.get()).toEqual([1, 2])
			expect(push).toBeDefined()

			push?.({ add: [3] })
			expect(items.get()).toEqual([1, 2, 3])
			dispose()
		})

		test('rejects duplicate keys in the seed', () => {
			expect(() =>
				deriveList([{ id: 1 }, { id: 1 }], {
					keyConfig: item => `id-${item.id}`,
					watched: () => () => {},
				}),
			).toThrow(DuplicateKeyError)
		})
	})

	describe('per-item derivation', () => {
		test('maps over a List source', () => {
			const list = createList([1, 2, 3])
			const doubled = deriveList(list, (v: number) => v * 2)
			expect(doubled.get()).toEqual([2, 4, 6])
		})

		test('maps over a Task source', async () => {
			const source = createTask(async () => {
				await wait(10)
				return [1, 2]
			})
			const doubled = deriveList(source, (v: number) => v * 2)
			const dispose = createScope(() => {
				createEffect(() => {
					doubled.get()
				})
			})
			await wait(30)
			expect(doubled.get()).toEqual([2, 4])
			dispose()
		})

		test('single-arg async item callback infers the resolved item type, not Promise<T>', () => {
			const list = createList([1, 2, 3])
			const doubled = deriveList(list, async (v: number) => v * 2)
			// If the overload order regresses, `doubled` unifies to `DerivedList<Promise<number>>`
			// and this assignment fails to compile.
			const typedDoubled: DerivedList<number> = doubled
			expect(typedDoubled).toBeDefined()
		})
	})
})
