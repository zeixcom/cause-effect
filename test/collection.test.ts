import { describe, expect, test } from 'bun:test'
import {
	batch,
	type CollectionChanges,
	createCollection,
	createEffect,
	createList,
	createScope,
	createState,
	isCollection,
	isList,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Collection', () => {
	describe('createCollection', () => {
		test('should create a collection with initial values', () => {
			const col = createCollection(() => () => {}, { value: [1, 2, 3] })

			expect(col.get()).toEqual([1, 2, 3])
			expect(col.length).toBe(3)
			expect(isCollection(col)).toBe(true)
		})

		test('should create an empty collection', () => {
			const col = createCollection<number>(() => () => {})

			expect(col.get()).toEqual([])
			expect(col.length).toBe(0)
		})

		test('should have Symbol.toStringTag of "Collection"', () => {
			const col = createCollection(() => () => {}, { value: [1] })
			expect(col[Symbol.toStringTag]).toBe('Collection')
		})

		test('should have Symbol.isConcatSpreadable set to true', () => {
			const col = createCollection(() => () => {}, { value: [1] })
			expect(col[Symbol.isConcatSpreadable]).toBe(true)
		})

		test('should support at(), byKey(), keyAt(), indexOfKey()', () => {
			const col = createCollection(() => () => {}, {
				value: [
					{ id: 'a', name: 'Alice' },
					{ id: 'b', name: 'Bob' },
				],
				keyConfig: item => item.id,
			})

			expect(col.keyAt(0)).toBe('a')
			expect(col.keyAt(1)).toBe('b')
			expect(col.indexOfKey('b')).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.byKey('a')!.get()).toEqual({ id: 'a', name: 'Alice' })
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.at(1)!.get()).toEqual({ id: 'b', name: 'Bob' })
		})

		test('should support iteration', () => {
			const col = createCollection(() => () => {}, {
				value: [10, 20, 30],
			})

			const values = []
			for (const signal of col) values.push(signal.get())
			expect(values).toEqual([10, 20, 30])
		})

		test('should support custom key config with string prefix', () => {
			const col = createCollection(() => () => {}, {
				value: [10, 20],
				keyConfig: 'item-',
			})

			expect(col.keyAt(0)).toBe('item-0')
			expect(col.keyAt(1)).toBe('item-1')
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.byKey('item-0')!.get()).toBe(10)
		})

		test('should support custom createItem factory', () => {
			let guardCalled = false
			const col = createCollection(() => () => {}, {
				value: [5, 10],
				createItem: (_key, value) =>
					createState(value, {
						guard: (v): v is number => {
							guardCalled = true
							return typeof v === 'number'
						},
					}),
			})

			expect(col.get()).toEqual([5, 10])
			expect(guardCalled).toBe(true)
		})
	})

	describe('isCollection', () => {
		test('should identify collection signals', () => {
			const col = createCollection(() => () => {}, { value: [1] })
			expect(isCollection(col)).toBe(true)
		})

		test('should return false for non-collection values', () => {
			expect(isCollection(42)).toBe(false)
			expect(isCollection(null)).toBe(false)
			expect(isCollection({})).toBe(false)
			expect(
				isList(createCollection(() => () => {}, { value: [1] })),
			).toBe(false)
		})
	})

	describe('Watched Lifecycle', () => {
		test('should call start callback on first effect access', () => {
			let started = false
			let cleaned = false

			const col = createCollection(
				() => {
					started = true
					return () => {
						cleaned = true
					}
				},
				{ value: [1] },
			)

			expect(started).toBe(false)

			const dispose = createScope(() => {
				createEffect(() => {
					void col.length
				})
			})

			expect(started).toBe(true)
			expect(cleaned).toBe(false)

			dispose()
			expect(cleaned).toBe(true)
		})

		test('should activate via keys() access in effect', () => {
			let started = false
			const col = createCollection(
				() => {
					started = true
					return () => {}
				},
				{ value: [1] },
			)

			expect(started).toBe(false)

			const dispose = createScope(() => {
				createEffect(() => {
					void Array.from(col.keys())
				})
			})

			expect(started).toBe(true)

			dispose()
		})
	})

	describe('applyChanges', () => {
		test('should add items', () => {
			let apply:
				| ((changes: CollectionChanges<number>) => void)
				| undefined
			const col = createCollection<number>(applyChanges => {
				apply = applyChanges
				return () => {}
			})

			const values: number[][] = []
			const dispose = createScope(() => {
				createEffect(() => {
					values.push(col.get())
				})
			})

			expect(values).toEqual([[]])

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ add: [1, 2] })

			expect(values.length).toBe(2)
			expect(values[1]).toEqual([1, 2])
			expect(col.length).toBe(2)

			dispose()
		})

		test('should change item values', () => {
			let apply:
				| ((
						changes: CollectionChanges<{ id: string; val: number }>,
				  ) => void)
				| undefined
			const col = createCollection(
				applyChanges => {
					apply = applyChanges
					return () => {}
				},
				{
					value: [{ id: 'x', val: 1 }],
					keyConfig: item => item.id,
				},
			)

			const values: { id: string; val: number }[][] = []
			const dispose = createScope(() => {
				createEffect(() => {
					values.push(col.get())
				})
			})

			expect(values[0]).toEqual([{ id: 'x', val: 1 }])

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ change: [{ id: 'x', val: 42 }] })

			expect(values.length).toBe(2)
			expect(values[1]).toEqual([{ id: 'x', val: 42 }])

			dispose()
		})

		test('should remove items', () => {
			let apply:
				| ((
						changes: CollectionChanges<{ id: string; v: number }>,
				  ) => void)
				| undefined
			const col = createCollection(
				applyChanges => {
					apply = applyChanges
					return () => {}
				},
				{
					value: [
						{ id: 'a', v: 1 },
						{ id: 'b', v: 2 },
						{ id: 'c', v: 3 },
					],
					keyConfig: item => item.id,
				},
			)

			const values: { id: string; v: number }[][] = []
			const dispose = createScope(() => {
				createEffect(() => {
					values.push(col.get())
				})
			})

			expect(values[0]).toEqual([
				{ id: 'a', v: 1 },
				{ id: 'b', v: 2 },
				{ id: 'c', v: 3 },
			])

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ remove: [{ id: 'b', v: 2 }] })

			expect(values.length).toBe(2)
			expect(values[1]).toEqual([
				{ id: 'a', v: 1 },
				{ id: 'c', v: 3 },
			])
			expect(col.length).toBe(2)

			dispose()
		})

		test('should handle mixed add/change/remove', () => {
			let apply:
				| ((
						changes: CollectionChanges<{ id: string; v: number }>,
				  ) => void)
				| undefined
			const col = createCollection(
				applyChanges => {
					apply = applyChanges
					return () => {}
				},
				{
					value: [
						{ id: 'a', v: 1 },
						{ id: 'b', v: 2 },
					],
					keyConfig: item => item.id,
				},
			)

			const values: { id: string; v: number }[][] = []
			const dispose = createScope(() => {
				createEffect(() => {
					values.push(col.get())
				})
			})

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({
				add: [{ id: 'c', v: 3 }],
				change: [{ id: 'a', v: 10 }],
				remove: [{ id: 'b', v: 2 }],
			})

			expect(values.length).toBe(2)
			expect(values[1]).toEqual([
				{ id: 'a', v: 10 },
				{ id: 'c', v: 3 },
			])

			dispose()
		})

		test('should skip when no changes provided', () => {
			let apply:
				| ((changes: CollectionChanges<number>) => void)
				| undefined
			const col = createCollection(
				applyChanges => {
					apply = applyChanges
					return () => {}
				},
				{ value: [1] },
			)

			let callCount = 0
			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
					callCount++
				})
			})

			expect(callCount).toBe(1)

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({})

			expect(callCount).toBe(1)

			dispose()
		})

		test('should trigger effects on structural changes', () => {
			let apply:
				| ((changes: CollectionChanges<string>) => void)
				| undefined
			const col = createCollection<string>(applyChanges => {
				apply = applyChanges
				return () => {}
			})

			let effectCount = 0
			const dispose = createScope(() => {
				createEffect(() => {
					void col.length
					effectCount++
				})
			})

			expect(effectCount).toBe(1)

			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ add: ['hello'] })

			expect(effectCount).toBe(2)
			expect(col.length).toBe(1)

			dispose()
		})

		test('should batch multiple calls', () => {
			let apply:
				| ((changes: CollectionChanges<number>) => void)
				| undefined
			const col = createCollection<number>(applyChanges => {
				apply = applyChanges
				return () => {}
			})

			let effectCount = 0
			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
					effectCount++
				})
			})

			expect(effectCount).toBe(1)

			batch(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({ add: [1] })
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({ add: [2] })
			})

			expect(effectCount).toBe(2)
			expect(col.get()).toEqual([1, 2])

			dispose()
		})
	})

	describe('deriveCollection', () => {
		test('should transform list values with sync callback', () => {
			const numbers = createList([1, 2, 3])
			const doubled = numbers.deriveCollection((v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(doubled.length).toBe(3)
		})

		test('should transform values with async callback', async () => {
			const numbers = createList([1, 2, 3])
			const doubled = numbers.deriveCollection(
				async (v: number, abort: AbortSignal) => {
					await wait(10)
					if (abort.aborted) throw new Error('Aborted')
					return v * 2
				},
			)

			// Trigger computation
			for (let i = 0; i < doubled.length; i++) {
				try {
					doubled.at(i)?.get()
				} catch {
					// UnsetSignalValueError before resolution
				}
			}

			await wait(50)
			expect(doubled.get()).toEqual([2, 4, 6])
		})

		test('should handle empty source list', () => {
			const empty = createList<number>([])
			const doubled = empty.deriveCollection((v: number) => v * 2)

			expect(doubled.get()).toEqual([])
			expect(doubled.length).toBe(0)
		})

		test('should return Signal at index', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)

			expect(doubled.at(0)?.get()).toBe(2)
			expect(doubled.at(1)?.get()).toBe(4)
			expect(doubled.at(2)?.get()).toBe(6)
			expect(doubled.at(5)).toBeUndefined()
		})

		test('should return Signal by source key', () => {
			const list = createList([10, 20])
			const doubled = list.deriveCollection((v: number) => v * 2)

			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key0 = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key1 = list.keyAt(1)!

			expect(doubled.byKey(key0)?.get()).toBe(20)
			expect(doubled.byKey(key1)?.get()).toBe(40)
		})

		test('should support keyAt, indexOfKey, and keys', () => {
			const list = createList([10, 20, 30])
			const col = list.deriveCollection((v: number) => v)

			const key0 = col.keyAt(0)
			expect(key0).toBeDefined()
			expect(typeof key0).toBe('string')
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			expect(col.indexOfKey(key0!)).toBe(0)
			expect([...col.keys()]).toHaveLength(3)
		})

		test('should support for...of via Symbol.iterator', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)

			const signals = [...doubled]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(2)
			expect(signals[1].get()).toBe(4)
			expect(signals[2].get()).toBe(6)
		})

		test('should react to source additions', () => {
			const list = createList([1, 2])
			const doubled = list.deriveCollection((v: number) => v * 2)

			let result: number[] = []
			let effectCount = 0
			createEffect(() => {
				result = doubled.get()
				effectCount++
			})

			expect(result).toEqual([2, 4])
			expect(effectCount).toBe(1)

			list.add(3)
			expect(result).toEqual([2, 4, 6])
			expect(effectCount).toBe(2)
		})

		test('should react to source removals', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			list.remove(1)
			expect(doubled.get()).toEqual([2, 6])
			expect(doubled.length).toBe(2)
		})

		test('should react to item mutations', () => {
			const list = createList([1, 2])
			const doubled = list.deriveCollection((v: number) => v * 2)

			let result: number[] = []
			createEffect(() => {
				result = doubled.get()
			})

			expect(result).toEqual([2, 4])
			list.at(0)?.set(5)
			expect(result).toEqual([10, 4])
		})

		test('async collection should react to changes', async () => {
			const list = createList([1, 2])
			const doubled = list.deriveCollection(
				async (v: number, abort: AbortSignal) => {
					await wait(5)
					if (abort.aborted) throw new Error('Aborted')
					return v * 2
				},
			)

			const values: number[][] = []
			createEffect(() => {
				values.push([...doubled.get()])
			})

			await wait(20)
			expect(values[values.length - 1]).toEqual([2, 4])

			list.add(3)
			await wait(20)
			expect(values[values.length - 1]).toEqual([2, 4, 6])
		})

		test('should chain from collection', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)
			const quadrupled = doubled.deriveCollection((v: number) => v * 2)

			expect(quadrupled.get()).toEqual([4, 8, 12])

			list.add(4)
			expect(quadrupled.get()).toEqual([4, 8, 12, 16])
		})

		test('should chain from createCollection source', () => {
			const col = createCollection(() => () => {}, { value: [1, 2, 3] })
			const doubled = col.deriveCollection((v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(isCollection(doubled)).toBe(true)
		})

		test('should propagate errors from per-item memos', () => {
			const list = createList([1, 2, 3])
			const mapped = list.deriveCollection((v: number) => {
				if (v === 2) throw new Error('bad item')
				return v * 2
			})

			expect(() => mapped.get()).toThrow('bad item')
		})
	})
})
