import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createList,
	createMemo,
	createScope,
	createState,
	createStore,
	deriveList,
	isList,
	type ListChanges,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Collection', () => {
	describe('deriveList external push', () => {
		test('should create a collection with initial values', () => {
			const col = deriveList([1, 2, 3], { watched: () => () => {} })

			expect(col.get()).toEqual([1, 2, 3])
			expect(col.length).toBe(3)
			expect(isList(col)).toBe(true)
		})

		test('should create an empty collection', () => {
			const col = deriveList([], { watched: () => () => {} })

			expect(col.get()).toEqual([])
			expect(col.length).toBe(0)
		})

		test('should have Symbol.toStringTag of "List"', () => {
			const col = deriveList([1], { watched: () => () => {} })
			expect(col[Symbol.toStringTag]).toBe('List')
		})

		test('should have Symbol.isConcatSpreadable set to true', () => {
			const col = deriveList([1], { watched: () => () => {} })
			expect(col[Symbol.isConcatSpreadable]).toBe(true)
		})

		test('should support at(), byKey(), keyAt(), indexOfKey()', () => {
			const col = deriveList(
				[
					{ id: 'a', name: 'Alice' },
					{ id: 'b', name: 'Bob' },
				],
				{ watched: () => () => {}, keyConfig: item => item.id },
			)

			expect(col.keyAt(0)).toBe('a')
			expect(col.keyAt(1)).toBe('b')
			expect(col.indexOfKey('b')).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.byKey('a')!.get()).toEqual({ id: 'a', name: 'Alice' })
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.at(1)!.get()).toEqual({ id: 'b', name: 'Bob' })
		})

		test('should support iteration', () => {
			const col = deriveList([10, 20, 30], { watched: () => () => {} })

			const values = []
			for (const signal of col) values.push(signal.get())
			expect(values).toEqual([10, 20, 30])
		})

		test('should support custom key config with string prefix', () => {
			const col = deriveList([10, 20], {
				watched: () => () => {},
				keyConfig: 'item-',
			})

			expect(col.keyAt(0)).toBe('item-0')
			expect(col.keyAt(1)).toBe('item-1')
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(col.byKey('item-0')!.get()).toBe(10)
		})

		test('should support custom createItem factory', () => {
			let guardCalled = false
			const col = deriveList([5, 10], {
				watched: () => () => {},
				createItem: value =>
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

	describe('isList', () => {
		test('should identify collection signals', () => {
			const col = deriveList([1], { watched: () => () => {} })
			expect(isList(col)).toBe(true)
		})

		test('should return false for non-list values', () => {
			expect(isList(42)).toBe(false)
			expect(isList(null)).toBe(false)
			expect(isList({})).toBe(false)
		})
	})

	describe('Watched Lifecycle', () => {
		test('should call start callback on first effect access', () => {
			let started = false
			let cleaned = false

			const col = deriveList([1], {
				watched: () => {
					started = true
					return () => {
						cleaned = true
					}
				},
			})

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
			const col = deriveList([1], {
				watched: () => {
					started = true
					return () => {}
				},
			})

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
			let apply: ((changes: ListChanges<number>) => void) | undefined
			const col = deriveList<number>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
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
				| ((changes: ListChanges<{ id: string; val: number }>) => void)
				| undefined
			const col = deriveList([{ id: 'x', val: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})

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
				| ((changes: ListChanges<{ id: string; v: number }>) => void)
				| undefined
			const col = deriveList(
				[
					{ id: 'a', v: 1 },
					{ id: 'b', v: 2 },
					{ id: 'c', v: 3 },
				],
				{
					watched: applyChanges => {
						apply = applyChanges
						return () => {}
					},
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
				| ((changes: ListChanges<{ id: string; v: number }>) => void)
				| undefined
			const col = deriveList(
				[
					{ id: 'a', v: 1 },
					{ id: 'b', v: 2 },
				],
				{
					watched: applyChanges => {
						apply = applyChanges
						return () => {}
					},
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
			let apply: ((changes: ListChanges<number>) => void) | undefined
			const col = deriveList([1], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
			})

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
			let apply: ((changes: ListChanges<string>) => void) | undefined
			const col = deriveList<string>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
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
			let apply: ((changes: ListChanges<number>) => void) | undefined
			const col = deriveList<number>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
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

		test('should throw DuplicateKeyError when add produces a duplicate key', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList<Item>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})

			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
				})
			})

			// Two items with the same content-based key must throw,
			// matching List.add and Store.add behavior.
			expect(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({
					add: [
						{ id: 'a', v: 1 },
						{ id: 'a', v: 2 },
					],
				})
			}).toThrow('already exists')

			dispose()
		})

		test('should throw DuplicateKeyError when adding a key that already exists', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})

			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
				})
			})

			expect(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({ add: [{ id: 'a', v: 99 }] })
			}).toThrow('already exists')

			dispose()
		})

		test('leaves no partial state when a later item in the batch collides', () => {
			// Regression: the add-loop used to mutate signals/keys/itemToKey as it
			// iterated, so a duplicate on the *second* item left the first item
			// committed while node.value/flags were never updated — byKey()/keys()
			// disagreed with get(). The whole batch must be validated before any
			// mutation happens.
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList<Item>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})

			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
				})
			})

			expect(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({
					add: [
						{ id: 'a', v: 1 },
						{ id: 'a', v: 2 },
					],
				})
			}).toThrow('already exists')

			// None of the views should show the first item as added.
			expect(col.get()).toEqual([])
			expect(col.byKey('a')).toBeUndefined()
			expect(Array.from(col.keys())).toEqual([])

			dispose()
		})
	})

	describe('external-push lookup methods track structural changes', () => {
		test('byKey() tracks structural changes (add/remove)', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})
			let effectCount = 0
			const dispose = createScope(() => {
				createEffect(() => {
					col.byKey('a')
					effectCount++
				})
			})

			expect(effectCount).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ add: [{ id: 'b', v: 2 }] })
			expect(effectCount).toBe(2)
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ remove: [{ id: 'a', v: 1 }] })
			expect(effectCount).toBe(3)
			dispose()
		})

		test('at(), keyAt(), indexOfKey() track structural changes', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})
			let byAt = 0
			let byKeyAt = 0
			let byIndexOfKey = 0
			const dispose = createScope(() => {
				createEffect(() => {
					col.at(0)
					byAt++
				})
				createEffect(() => {
					col.keyAt(0)
					byKeyAt++
				})
				createEffect(() => {
					col.indexOfKey('a')
					byIndexOfKey++
				})
			})

			expect(byAt).toBe(1)
			expect(byKeyAt).toBe(1)
			expect(byIndexOfKey).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ add: [{ id: 'b', v: 2 }] })
			expect(byAt).toBe(2)
			expect(byKeyAt).toBe(2)
			expect(byIndexOfKey).toBe(2)
			dispose()
		})

		test('Symbol.iterator tracks structural changes', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})
			let runs = 0
			const dispose = createScope(() => {
				createEffect(() => {
					for (const _sig of col) {
						// iterate only — no item-level reads
					}
					runs++
				})
			})

			expect(runs).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ add: [{ id: 'b', v: 2 }] })
			expect(runs).toBe(2)
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ remove: [{ id: 'a', v: 1 }] })
			expect(runs).toBe(3)
			dispose()
		})
	})

	describe('onChanges change-branch tracking leak', () => {
		// The change branch of onChanges reads signal.get() to update the
		// itemToKey reverse map. That read must be untracked — otherwise,
		// when applyChanges is called inside an effect, it leaks an
		// item->effect edge and the subsequent propagate re-runs the effect
		// once during setup (transient leak, mode b).
		test('applyChanges({ change }) inside an effect does not transiently re-run', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})

			// Subscribe to activate the collection (triggers watched -> sets apply)
			const dispose = createScope(() => {
				createEffect(() => {
					col.get()
				})
			})

			const trigger = createState(0)
			let runs = 0
			createEffect((): undefined => {
				trigger.get()
				runs++
				if (runs === 1) {
					// biome-ignore lint/style/noNonNullAssertion: activated above
					apply!({ change: [{ id: 'a', v: 2 }] })
				}
			})

			// Without the fix, runs is 2 here (transient re-run).
			expect(runs).toBe(1)
			expect(col.byKey('a')?.get()).toEqual({ id: 'a', v: 2 })
			dispose()
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for non-function watched', () => {
			expect(() => {
				// @ts-expect-error - testing non-function
				deriveList([], { watched: 42 })
			}).toThrow('Callback 42 is invalid')
		})

		test('should throw InvalidCallbackError for async watched', () => {
			expect(() => {
				// @ts-expect-error - testing async function
				deriveList([], { watched: async () => () => {} })
			}).toThrow('invalid')
		})

		test('applyChanges change for nonexistent key is silently skipped', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList<Item>([], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})
			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
				})
			})

			// Change a key that does not exist — must not throw.
			expect(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({ change: [{ id: 'missing', v: 1 }] })
			}).not.toThrow()
			expect(col.get()).toEqual([])

			dispose()
		})

		test('applyChanges remove for nonexistent key is silently skipped', () => {
			type Item = { id: string; v: number }
			let apply: ((changes: ListChanges<Item>) => void) | undefined
			const col = deriveList([{ id: 'a', v: 1 }], {
				watched: applyChanges => {
					apply = applyChanges
					return () => {}
				},
				keyConfig: item => item.id,
			})
			const dispose = createScope(() => {
				createEffect(() => {
					void col.get()
				})
			})

			// Remove a key that does not exist — must not throw.
			expect(() => {
				// biome-ignore lint/style/noNonNullAssertion: test
				apply!({ remove: [{ id: 'missing', v: 0 }] })
			}).not.toThrow()
			expect(col.get()).toEqual([{ id: 'a', v: 1 }])

			dispose()
		})
	})

	describe('deriveList per-item derivation', () => {
		test('should transform list values with sync callback', () => {
			const numbers = createList([1, 2, 3])
			const doubled = deriveList(numbers, (v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(doubled.length).toBe(3)
		})

		test('should transform values with async callback', async () => {
			const numbers = createList([1, 2, 3])
			const doubled = deriveList(
				numbers,
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
			const doubled = deriveList(empty, (v: number) => v * 2)

			expect(doubled.get()).toEqual([])
			expect(doubled.length).toBe(0)
		})

		test('should return Signal at index', () => {
			const list = createList([1, 2, 3])
			const doubled = deriveList(list, (v: number) => v * 2)

			expect(doubled.at(0)?.get()).toBe(2)
			expect(doubled.at(1)?.get()).toBe(4)
			expect(doubled.at(2)?.get()).toBe(6)
			expect(doubled.at(5)).toBeUndefined()
		})

		test('should return Signal by source key', () => {
			const list = createList([10, 20])
			const doubled = deriveList(list, (v: number) => v * 2)

			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key0 = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key1 = list.keyAt(1)!

			expect(doubled.byKey(key0)?.get()).toBe(20)
			expect(doubled.byKey(key1)?.get()).toBe(40)
		})

		test('should support keyAt, indexOfKey, and keys', () => {
			const list = createList([10, 20, 30])
			const col = deriveList(list, (v: number) => v)

			const key0 = col.keyAt(0)
			expect(key0).toBeDefined()
			expect(typeof key0).toBe('string')
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			expect(col.indexOfKey(key0!)).toBe(0)
			expect([...col.keys()]).toHaveLength(3)
		})

		test('should support for...of via Symbol.iterator', () => {
			const list = createList([1, 2, 3])
			const doubled = deriveList(list, (v: number) => v * 2)

			const signals = [...doubled]
			expect(signals).toHaveLength(3)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[0]!.get()).toBe(2)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[1]!.get()).toBe(4)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[2]!.get()).toBe(6)
		})

		test('should react to source additions', () => {
			const list = createList([1, 2])
			const doubled = deriveList(list, (v: number) => v * 2)

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
			const doubled = deriveList(list, (v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			list.remove(1)
			expect(doubled.get()).toEqual([2, 6])
			expect(doubled.length).toBe(2)
		})

		test('should react to item mutations', () => {
			const list = createList([1, 2])
			const doubled = deriveList(list, (v: number) => v * 2)

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
			const doubled = deriveList(
				list,
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
			const doubled = deriveList(list, (v: number) => v * 2)
			const quadrupled = deriveList(doubled, (v: number) => v * 2)

			expect(quadrupled.get()).toEqual([4, 8, 12])

			list.add(4)
			expect(quadrupled.get()).toEqual([4, 8, 12, 16])
		})

		test('should chain from an external-push source', () => {
			const col = deriveList([1, 2, 3], { watched: () => () => {} })
			const doubled = deriveList(col, (v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(isList(doubled)).toBe(true)
		})

		test('should propagate errors from per-item memos', () => {
			const list = createList([1, 2, 3])
			const mapped = deriveList(list, (v: number) => {
				if (v === 2) throw new Error('bad item')
				return v * 2
			})

			expect(() => mapped.get()).toThrow('bad item')
		})

		test('byKey() tracks structural changes in source list', () => {
			const list = createList([1, 2])
			const doubled = deriveList(list, (v: number) => v * 2)
			let effectCount = 0
			const dispose = createScope(() => {
				createEffect(() => {
					doubled.byKey(list.keyAt(0) as string)
					effectCount++
				})
			})

			expect(effectCount).toBe(1)
			list.add(3)
			expect(effectCount).toBe(2)
			list.remove(0)
			expect(effectCount).toBe(3)
			dispose()
		})

		test('at(), keyAt(), indexOfKey() track structural changes in source', () => {
			const list = createList([1])
			const doubled = deriveList(list, (v: number) => v * 2)
			let byAt = 0
			let byKeyAt = 0
			let byIndexOfKey = 0
			const dispose = createScope(() => {
				createEffect(() => {
					doubled.at(0)
					byAt++
				})
				createEffect(() => {
					doubled.keyAt(0)
					byKeyAt++
				})
				createEffect(() => {
					doubled.indexOfKey(list.keyAt(0) as string)
					byIndexOfKey++
				})
			})

			expect(byAt).toBe(1)
			expect(byKeyAt).toBe(1)
			expect(byIndexOfKey).toBe(1)
			list.add(2)
			expect(byAt).toBe(2)
			expect(byKeyAt).toBe(2)
			expect(byIndexOfKey).toBe(2)
			dispose()
		})

		test('per-item memo does NOT gain a structural edge on the source', () => {
			// Regression guard: byKey() now tracks, so the per-item derivation's
			// internal source.byKey(key).get() must be untracked. Otherwise
			// every per-item memo would recompute on any structural change.
			const list = createList([1, 2, 3])
			let memoRuns = 0
			const doubled = deriveList(list, (v: number) => {
				memoRuns++
				return v * 2
			})
			const dispose = createScope(() => {
				createEffect(() => {
					// read each item's derived value directly
					for (const key of doubled.keys()) {
						doubled.byKey(key)?.get()
					}
				})
			})

			memoRuns = 0
			// Add an item — existing per-item memos should NOT recompute.
			// (Only the new item's memo runs once.)
			const before = memoRuns
			list.add(4)
			expect(memoRuns).toBe(before + 1)
			dispose()
		})

		test('Symbol.iterator tracks structural changes in source', () => {
			const list = createList([1, 2])
			const doubled = deriveList(list, (v: number) => v * 2)
			let runs = 0
			const dispose = createScope(() => {
				createEffect(() => {
					for (const _sig of doubled) {
						// iterate only — no item-level reads
					}
					runs++
				})
			})

			expect(runs).toBe(1)
			list.add(3)
			expect(runs).toBe(2)
			list.remove(0)
			expect(runs).toBe(3)
			dispose()
		})

		describe('Reactivity', () => {
			test('an eager out-of-band byKey() read does not drop the change cascade to a downstream aggregate', () => {
				// Regression: ensureFresh()'s structural-relink branch used to
				// pre-write node.value via an untracked buildValue() call
				// BEFORE calling refresh() (which runs recomputeMemo()).
				// recomputeMemo() diffs its freshly built result against
				// node.value to decide whether to promote downstream
				// FLAG_CHECK sinks to FLAG_DIRTY — with node.value already
				// overwritten to the same result, that diff was always
				// trivially "unchanged". priceTotal is a memo two hops
				// downstream of the list (list -> Collection -> memo), so it
				// only ever gets FLAG_CHECK from propagate() directly and
				// depends entirely on that cascade to be promoted to DIRTY;
				// it got stuck forever. Reproduces via an effect that eagerly
				// touches rowPrices.byKey() for every key ahead of the effect
				// that consumes the aggregate — mirroring reconcile()'s
				// driving effect running before the aggregate consumer.
				const list = createList(
					[{ id: 'item1', amount: 3, pricePerUnit: 12.5 }],
					{ keyConfig: (item: { id: string }) => item.id },
				)
				const rowPrices = deriveList(
					list,
					(item: { amount: number; pricePerUnit: number }) =>
						item.amount * item.pricePerUnit,
				)
				const priceTotal = createMemo(() =>
					rowPrices.get().reduce((sum, v) => sum + v, 0),
				)

				const seen: number[] = []
				createEffect(() => {
					for (const key of list.keys()) rowPrices.byKey(key)
				})
				createEffect(() => {
					seen.push(priceTotal.get())
				})
				expect(seen).toEqual([37.5])

				list.add({ id: 'item2', amount: 5, pricePerUnit: 8 })
				expect(seen).toEqual([37.5, 77.5])
			})
		})
	})
})

test('Type Inference for custom createItem', () => {
	// This test primarily checks compilation types but also runtime presence
	type TodoItem = { id: string; text: string; done: boolean }
	const col = deriveList([] as TodoItem[], {
		watched: () => () => {},
		keyConfig: 'todo',
		createItem: createStore<TodoItem>,
	})

	const byKey = col.byKey('todo0')
	// Runtime check
	expect(byKey).toBeUndefined()

	// Type check
	type Expect<T extends true> = T
	type Equal<X, Y> =
		(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
			? true
			: false
	type _Test = Expect<
		Equal<typeof byKey, ReturnType<typeof createStore<TodoItem>> | undefined>
	>
})
