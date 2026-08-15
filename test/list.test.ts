import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createList,
	createMemo,
	createScope,
	createState,
	createStore,
	createTask,
	isList,
	isSignal,
	match,
	NullishSignalValueError,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('List', () => {
	describe('createList', () => {
		test('should return initial values from get()', () => {
			const list = createList([1, 2, 3])
			expect(list.get()).toEqual([1, 2, 3])
		})

		test('should work with object items', () => {
			const list = createList([
				{ name: 'Alice', tags: ['admin'] },
				{ name: 'Bob', tags: ['user'] },
			])
			expect(list.get()).toEqual([
				{ name: 'Alice', tags: ['admin'] },
				{ name: 'Bob', tags: ['user'] },
			])
		})

		test('should handle empty initial array', () => {
			const list = createList<number>([])
			expect(list.get()).toEqual([])
			expect(list.length).toBe(0)
		})

		test('should have Symbol.toStringTag of "List"', () => {
			const list = createList([1])
			expect(list[Symbol.toStringTag]).toBe('List')
		})

		test('should have Symbol.isConcatSpreadable set to true', () => {
			const list = createList([1])
			expect(list[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('isList', () => {
		test('should identify list signals', () => {
			expect(isList(createList([1]))).toBe(true)
		})

		test('should return false for non-list values', () => {
			expect(isList(42)).toBe(false)
			expect(isList(null)).toBe(false)
			expect(isList({})).toBe(false)
			expect(isSignal(createList([1]))).toBe(false)
		})
	})

	describe('at', () => {
		test('should return State signal at index', () => {
			const list = createList(['a', 'b', 'c'])
			expect(list.at(0)?.get()).toBe('a')
			expect(list.at(1)?.get()).toBe('b')
			expect(list.at(2)?.get()).toBe('c')
		})

		test('should return undefined for out-of-bounds index', () => {
			const list = createList(['a'])
			expect(list.at(5)).toBeUndefined()
		})

		test('should allow mutation via returned State signal', () => {
			const list = createList(['a', 'b'])
			list.at(0)?.set('alpha')
			expect(list.at(0)?.get()).toBe('alpha')
		})
	})

	describe('set', () => {
		test('should replace entire array', () => {
			const list = createList([1, 2, 3])
			list.set([4, 5])
			expect(list.get()).toEqual([4, 5])
			expect(list.length).toBe(2)
		})

		test('should diff and update changed items', () => {
			const list = createList([1, 2, 3])
			const signal0 = list.at(0)
			list.set([10, 2, 3])
			// Same signal reference, updated value
			expect(signal0?.get()).toBe(10)
		})

		test('should keep stable keys when reordering with content-based keyConfig', () => {
			type Item = { id: string; val: number }
			const list = createList<Item>(
				[
					{ id: 'a', val: 1 },
					{ id: 'b', val: 2 },
					{ id: 'c', val: 3 },
				],
				{ keyConfig: item => item.id },
			)

			// Grab signal references by key before reorder
			const signalA = list.byKey('a')
			const signalB = list.byKey('b')
			const signalC = list.byKey('c')

			// Reverse order
			list.set([
				{ id: 'c', val: 3 },
				{ id: 'b', val: 2 },
				{ id: 'a', val: 1 },
			])

			// Keys should follow items, not positions
			expect(list.byKey('a')?.get()).toEqual({ id: 'a', val: 1 })
			expect(list.byKey('b')?.get()).toEqual({ id: 'b', val: 2 })
			expect(list.byKey('c')?.get()).toEqual({ id: 'c', val: 3 })

			// Signal references should be preserved (same State objects)
			expect(list.byKey('a')).toBe(signalA)
			expect(list.byKey('b')).toBe(signalB)
			expect(list.byKey('c')).toBe(signalC)

			// Key order should match new array order
			expect([...list.keys()]).toEqual(['c', 'b', 'a'])
		})

		test('should detect duplicates in set() with content-based keyConfig', () => {
			const list = createList([{ id: 'a', val: 1 }], {
				keyConfig: item => item.id,
			})
			expect(() =>
				list.set([
					{ id: 'a', val: 1 },
					{ id: 'a', val: 2 },
				]),
			).toThrow('already exists')
		})
	})

	describe('update', () => {
		test('should update via callback', () => {
			const list = createList([1, 2])
			list.update(arr => [...arr, 3])
			expect(list.get()).toEqual([1, 2, 3])
		})

		test('should throw when callback is null (no InvalidCallbackError — gap vs State)', () => {
			// NOTE: List.update does not validate its callback the way
			// State.update does. A null callback throws a bare TypeError from
			// invoking null(), not an InvalidCallbackError. This test locks in
			// the current behavior; the inconsistency is documented.
			const list = createList([1, 2])
			expect(() => {
				// @ts-expect-error - testing null callback
				list.update(null)
			}).toThrow(TypeError)
		})

		test('should throw when callback is a non-function (gap vs State)', () => {
			const list = createList([1, 2])
			expect(() => {
				// @ts-expect-error - testing non-function
				list.update(42)
			}).toThrow(TypeError)
		})
	})

	describe('add', () => {
		test('should append item and return key', () => {
			const list = createList(['apple', 'banana'])
			const key = list.add('cherry')
			expect(typeof key).toBe('string')
			expect(list.at(2)?.get()).toBe('cherry')
			expect(list.byKey(key)?.get()).toBe('cherry')
		})

		test('should throw for null value', () => {
			const list = createList([1])
			// @ts-expect-error - Testing invalid input
			expect(() => list.add(null)).toThrow()
		})

		test('should throw DuplicateKeyError for duplicate keys', () => {
			const list = createList([{ id: 'a', val: 1 }], {
				keyConfig: item => item.id,
			})
			expect(() => list.add({ id: 'a', val: 2 })).toThrow('already exists')
		})

		test('DuplicateKeyError message includes [List] prefix and key', () => {
			const list = createList([{ id: 'a', val: 1 }], {
				keyConfig: item => item.id,
			})
			expect(() => list.add({ id: 'a', val: 2 })).toThrow(
				'[List] Could not add key "a"',
			)
		})

		test('DuplicateKeyError message includes a falsy value', () => {
			// The constructor used a truthy check on `value`, so falsy-but-defined
			// values like `0` were silently dropped from the message even though
			// a value was passed.
			const list = createList<number>([0], {
				keyConfig: item => String(item),
			})
			expect(() => list.add(0)).toThrow('with value 0')
		})

		test('add with null throws NullishSignalValueError with item-for-key prefix', () => {
			const list = createList<number>([1])
			expect(() => {
				// @ts-expect-error - testing null
				list.add(null)
			}).toThrow(NullishSignalValueError)
		})
	})

	describe('remove', () => {
		test('should remove by index', () => {
			const list = createList(['a', 'b', 'c'])
			list.remove(1)
			expect(list.get()).toEqual(['a', 'c'])
			expect(list.length).toBe(2)
		})

		test('should remove by key', () => {
			const list = createList(
				[
					{ id: 'x', val: 1 },
					{ id: 'y', val: 2 },
				],
				{ keyConfig: item => item.id },
			)
			list.remove('x')
			expect(list.get()).toEqual([{ id: 'y', val: 2 }])
		})

		test('should handle non-existent index gracefully', () => {
			const list = createList(['a'])
			expect(() => list.remove(5)).not.toThrow()
			expect(list.get()).toEqual(['a'])
		})
	})

	describe('replace', () => {
		test('should update the item signal value', () => {
			const list = createList(['a', 'b', 'c'])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(1)!
			list.replace(key, 'B')
			expect(list.byKey(key)?.get()).toBe('B')
		})

		test('structural subscriber via keys() re-runs after replace(); byKey().set() does NOT', () => {
			const list = createList(['x', 'y'])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			let effectCount = 0

			// This effect subscribes structurally via keys() only — no list.get() call
			createEffect(() => {
				void [...list.keys()]
				effectCount++
			})

			expect(effectCount).toBe(1)

			// replace() propagates through node.sinks — structural subscriber re-runs
			list.replace(key, 'X')
			expect(effectCount).toBe(2)

			// byKey().set() does NOT propagate through node.sinks — structural subscriber does NOT re-run
			list.byKey(key)?.set('XX')
			expect(effectCount).toBe(2)
		})

		test('direct subscriber via byKey().get() re-runs after replace()', () => {
			const list = createList(['a', 'b'])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			let lastValue = ''
			let effectCount = 0

			createEffect(() => {
				// biome-ignore lint/style/noNonNullAssertion: key is valid
				lastValue = list.byKey(key)!.get()
				effectCount++
			})

			expect(effectCount).toBe(1)
			expect(lastValue).toBe('a')

			list.replace(key, 'A')
			expect(effectCount).toBe(2)
			expect(lastValue).toBe('A')
		})

		test('no-op on equal value (same reference)', () => {
			const obj = { id: 1 }
			const list = createList([obj])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			let effectCount = 0

			createEffect(() => {
				list.get()
				effectCount++
			})

			expect(effectCount).toBe(1)

			list.replace(key, obj)
			expect(effectCount).toBe(1)
		})

		test('no-op on missing key — does not throw and does not trigger effects', () => {
			const list = createList([1, 2, 3])
			let effectCount = 0

			createEffect(() => {
				list.get()
				effectCount++
			})

			expect(effectCount).toBe(1)
			expect(() => list.replace('nonexistent', 99)).not.toThrow()
			expect(effectCount).toBe(1)
		})

		test('batch compatibility — effects run only once inside batch()', () => {
			const list = createList(['a', 'b', 'c'])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key0 = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key1 = list.keyAt(1)!
			let effectCount = 0

			createEffect(() => {
				list.get()
				effectCount++
			})

			expect(effectCount).toBe(1)

			batch(() => {
				list.replace(key0, 'A')
				list.replace(key1, 'B')
			})

			expect(effectCount).toBe(2)
			expect(list.get()).toEqual(['A', 'B', 'c'])
		})

		test('signal identity preserved — byKey() returns same signal before and after replace()', () => {
			const list = createList([10, 20])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			const signalBefore = list.byKey(key)
			list.replace(key, 99)
			const signalAfter = list.byKey(key)
			expect(signalBefore).toBe(signalAfter)
		})

		test('replace() inside an effect does not cause the effect to re-run', () => {
			const list = createList(['a', 'b', 'c'])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			let effectCount = 0
			createEffect((): undefined => {
				effectCount++
				list.replace(key, 'A')
			})
			expect(effectCount).toBe(1) // ran once on creation
			expect(list.byKey(key)?.get()).toBe('A')
			// replace() must NOT have linked the item signal to this effect
			expect(effectCount).toBe(1)
		})
	})

	describe('sort', () => {
		test('should sort with default string comparison', () => {
			const list = createList([3, 1, 2])
			list.sort()
			expect(list.get()).toEqual([1, 2, 3])
		})

		test('should sort with custom compare function', () => {
			const list = createList([3, 1, 2])
			list.sort((a, b) => b - a)
			expect(list.get()).toEqual([3, 2, 1])
		})

		test('should trigger effects on sort', () => {
			const list = createList([3, 1, 2])
			let effectCount = 0
			let lastValue: number[] = []
			createEffect(() => {
				lastValue = list.get()
				effectCount++
			})

			expect(effectCount).toBe(1)
			list.sort()
			expect(effectCount).toBe(2)
			expect(lastValue).toEqual([1, 2, 3])
		})
	})

	describe('splice', () => {
		test('should remove elements', () => {
			const list = createList([1, 2, 3, 4])
			const deleted = list.splice(1, 2)
			expect(deleted).toEqual([2, 3])
			expect(list.get()).toEqual([1, 4])
		})

		test('should insert elements', () => {
			const list = createList([1, 3])
			const deleted = list.splice(1, 0, 2)
			expect(deleted).toEqual([])
			expect(list.get()).toEqual([1, 2, 3])
		})

		test('should replace elements', () => {
			const list = createList([1, 2, 3])
			const deleted = list.splice(1, 1, 4, 5)
			expect(deleted).toEqual([2])
			expect(list.get()).toEqual([1, 4, 5, 3])
		})

		test('should handle negative start index', () => {
			const list = createList([1, 2, 3])
			const deleted = list.splice(-1, 1, 4)
			expect(deleted).toEqual([3])
			expect(list.get()).toEqual([1, 2, 4])
		})

		test('should throw DuplicateKeyError for duplicate keys on insert', () => {
			const list = createList(
				[
					{ id: 'a', val: 1 },
					{ id: 'b', val: 2 },
				],
				{ keyConfig: item => item.id },
			)
			expect(() => list.splice(1, 0, { id: 'a', val: 3 })).toThrow(
				'already exists',
			)
		})

		test('splice replacing an item with the same key keeps byKey() defined', () => {
			const list = createList(
				[
					{ id: 'x', val: 1 },
					{ id: 'y', val: 2 },
				],
				{ keyConfig: item => item.id },
			)
			// splice out { id: 'x', val: 1 } and insert a new { id: 'x', val: 99 }
			list.splice(0, 1, { id: 'x', val: 99 })
			expect(list.byKey('x')).toBeDefined()
			expect(list.byKey('x')?.get()).toEqual({ id: 'x', val: 99 })
		})
	})

	describe('length', () => {
		test('should return item count', () => {
			const list = createList([1, 2, 3])
			expect(list.length).toBe(3)
		})

		test('should update reactively with add and remove', () => {
			const list = createList([1, 2])
			expect(list.length).toBe(2)
			list.add(3)
			expect(list.length).toBe(3)
			list.remove(0)
			expect(list.length).toBe(2)
		})
	})

	describe('Key-based Access', () => {
		test('keyAt should return key at index', () => {
			const list = createList([10, 20, 30])
			const key0 = list.keyAt(0)
			expect(key0).toBeDefined()
			expect(typeof key0).toBe('string')
		})

		test('indexOfKey should return index for key', () => {
			const list = createList([10, 20])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			expect(list.indexOfKey(key)).toBe(0)
		})

		test('byKey should return State signal for key', () => {
			const list = createList([10, 20])
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = list.keyAt(0)!
			expect(list.byKey(key)?.get()).toBe(10)
		})

		test('byKey allows mutation of item', () => {
			const list = createList([{ id: 'w1', val: 1 }], {
				keyConfig: w => w.id,
			})
			expect(list.byKey('w1')?.get()).toEqual({ id: 'w1', val: 1 })
			list.byKey('w1')?.update(v => ({ ...v, val: 2 }))
			expect(list.byKey('w1')?.get()).toEqual({ id: 'w1', val: 2 })
		})

		test('keys should return iterator of all keys', () => {
			const list = createList([10, 20, 30])
			const allKeys = [...list.keys()]
			expect(allKeys).toHaveLength(3)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(list.byKey(allKeys[0]!)?.get()).toBe(10)
		})
	})

	describe('options.keyConfig', () => {
		test('should use function to generate keys', () => {
			const list = createList(
				[
					{ id: 'a', value: 1 },
					{ id: 'b', value: 2 },
				],
				{ keyConfig: item => item.id },
			)
			expect(list.byKey('a')?.get()).toEqual({ id: 'a', value: 1 })
			expect(list.byKey('b')?.get()).toEqual({ id: 'b', value: 2 })
		})

		test('should use string prefix for auto-generated keys', () => {
			const list = createList([1, 2, 3], { keyConfig: 'item-' })
			expect(list.keyAt(0)).toBe('item-0')
			expect(list.keyAt(1)).toBe('item-1')
			expect(list.keyAt(2)).toBe('item-2')
		})
	})

	describe('Iteration', () => {
		test('should support for...of via Symbol.iterator', () => {
			const list = createList([10, 20, 30])
			const signals = [...list]
			expect(signals).toHaveLength(3)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[0]!.get()).toBe(10)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[1]!.get()).toBe(20)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(signals[2]!.get()).toBe(30)
		})
	})

	describe('Reactivity', () => {
		test('get() should trigger effects on structural changes', () => {
			const list = createList([1, 2, 3])
			let lastArray: number[] = []
			createEffect(() => {
				lastArray = list.get()
			})

			expect(lastArray).toEqual([1, 2, 3])
			list.add(4)
			expect(lastArray).toEqual([1, 2, 3, 4])
		})

		test('individual item signals should trigger effects', () => {
			const list = createList([{ count: 5 }])
			let lastCount = 0
			let effectCount = 0
			createEffect(() => {
				lastCount = list.at(0)?.get().count ?? 0
				effectCount++
			})

			expect(lastCount).toBe(5)
			expect(effectCount).toBe(1)

			list.at(0)?.set({ count: 10 })
			expect(lastCount).toBe(10)
			expect(effectCount).toBe(2)
		})

		test('computed signals should react to list changes', () => {
			const list = createList([1, 2, 3])
			const sum = createMemo(() => list.get().reduce((acc, n) => acc + n, 0))

			expect(sum.get()).toBe(6)
			list.add(4)
			expect(sum.get()).toBe(10)
			list.remove(0)
			expect(sum.get()).toBe(9)
		})

		// Content-based keys so item values map 1:1 to stable string keys —
		// this is the realistic scenario where byKey()/indexOfKey() with a
		// specific key matters. With auto-increment keys the key is positional.
		test('byKey() tracks structural changes (add/remove)', () => {
			type Item = { id: string; v: number }
			const list = createList<Item>(
				[
					{ id: 'a', v: 1 },
					{ id: 'b', v: 2 },
				],
				{ keyConfig: item => item.id },
			)
			let effectCount = 0
			createEffect(() => {
				list.byKey('a')
				effectCount++
			})

			expect(effectCount).toBe(1)
			list.add({ id: 'c', v: 3 })
			expect(effectCount).toBe(2)
			list.remove('a')
			expect(effectCount).toBe(3)
		})

		test('at() tracks structural changes (add/remove)', () => {
			const list = createList(['a'])
			let effectCount = 0
			createEffect(() => {
				list.at(0)
				effectCount++
			})

			expect(effectCount).toBe(1)
			list.add('b')
			expect(effectCount).toBe(2)
			list.remove(0)
			expect(effectCount).toBe(3)
		})

		test('keyAt() tracks structural changes (add/remove)', () => {
			const list = createList(['a'])
			let effectCount = 0
			createEffect(() => {
				list.keyAt(0)
				effectCount++
			})

			expect(effectCount).toBe(1)
			list.add('b')
			expect(effectCount).toBe(2)
			list.remove(0)
			expect(effectCount).toBe(3)
		})

		test('indexOfKey() tracks structural changes (add/remove)', () => {
			type Item = { id: string; v: number }
			const list = createList<Item>([{ id: 'a', v: 1 }], {
				keyConfig: item => item.id,
			})
			let effectCount = 0
			createEffect(() => {
				list.indexOfKey('a')
				effectCount++
			})

			expect(effectCount).toBe(1)
			list.add({ id: 'b', v: 2 })
			expect(effectCount).toBe(2)
			list.remove('a')
			expect(effectCount).toBe(3)
		})

		test('Symbol.iterator tracks structural changes and is reached by replace()', () => {
			type Item = { id: string; v: number }
			const list = createList<Item>([{ id: 'a', v: 1 }], {
				keyConfig: item => item.id,
			})
			let runs = 0
			createEffect(() => {
				for (const _sig of list) {
					// iterate only — no item-level reads
				}
				runs++
			})
			expect(runs).toBe(1)

			// add/remove → structural change reaches iterator subscriber
			list.add({ id: 'b', v: 2 })
			expect(runs).toBe(2)
			list.remove('a')
			expect(runs).toBe(3)

			// replace() now reaches iterator subscribers (previously silent)
			list.add({ id: 'c', v: 3 })
			list.replace('c', { id: 'c', v: 30 })
			expect(runs).toBe(5)
		})

		test('get() reacts to a nested Store field set directly, with no prior List mutation', () => {
			// Regression: List's structural node used to start FLAG_CLEAN, so
			// refresh() on the very first get() skipped recomputeMemo() entirely
			// (it only recomputes when FLAG_DIRTY is set). buildValue() was
			// therefore never invoked tracked, so child item signals were never
			// linked as sources of the list node — a direct set() on a nested
			// Store field never propagated, even though list.get() was read
			// inside an effect. No List mutation method (add/remove/etc.) was
			// ever called, so the explicit invalidation those methods perform
			// could not mask the missing initial edge.
			const list = createList([{ id: 'a', amount: 3 }], {
				keyConfig: (item: { id: string }) => item.id,
				createItem: createStore,
			})

			const seen: number[] = []
			createEffect(() => {
				// biome-ignore lint/style/noNonNullAssertion: single-item list
				seen.push(list.get()[0]!.amount as number)
			})
			expect(seen).toEqual([3])

			// biome-ignore lint/style/noNonNullAssertion: key exists
			list.byKey('a')!.amount.set(10)
			expect(seen).toEqual([3, 10])

			// A fresh, untracked read must also reflect the change.
			// biome-ignore lint/style/noNonNullAssertion: single-item list
			expect(list.get()[0]!.amount).toBe(10)
		})
	})

	describe('options.itemEquals', () => {
		test('should use DEEP_EQUALITY by default for object items', () => {
			const list = createList([{ a: 1 }, { a: 2 }])
			// biome-ignore lint/style/noNonNullAssertion: test
			const item = list.at(0)!
			let count = 0
			createEffect(() => {
				item.get()
				count++
			})
			expect(count).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			list.replace(list.keyAt(0)!, { a: 1 })
			expect(count).toBe(1)
		})
		test('should allow custom itemEquals', () => {
			const list = createList([{ id: 1, val: 'a' }], {
				itemEquals: (a, b) => a.id === b.id,
			})
			// biome-ignore lint/style/noNonNullAssertion: test
			const item = list.at(0)!
			let count = 0
			createEffect(() => {
				item.get()
				count++
			})
			// biome-ignore lint/style/noNonNullAssertion: test
			list.replace(list.keyAt(0)!, { id: 1, val: 'b' })
			expect(count).toBe(1)
			expect(item.get().val).toBe('a')
		})
	})

	describe('options.watched', () => {
		test('should call watched on first subscriber and cleanup on last unsubscribe', () => {
			let watchedCalled = false
			let unwatchedCalled = false
			const list = createList([10, 20], {
				watched: () => {
					watchedCalled = true
					return () => {
						unwatchedCalled = true
					}
				},
			})

			expect(watchedCalled).toBe(false)

			const dispose = createEffect(() => {
				list.get()
			})

			expect(watchedCalled).toBe(true)
			expect(unwatchedCalled).toBe(false)

			dispose()
			expect(unwatchedCalled).toBe(true)
		})

		test('should activate on length access', () => {
			let watchedCalled = false
			const list = createList([1, 2], {
				watched: () => {
					watchedCalled = true
					return () => {}
				},
			})

			const dispose = createEffect(() => {
				void list.length
			})

			expect(watchedCalled).toBe(true)
			dispose()
		})

		test('should activate watched via sync deriveCollection', () => {
			let watchedCalled = false
			let unwatchedCalled = false
			const list = createList([1, 2, 3], {
				watched: () => {
					watchedCalled = true
					return () => {
						unwatchedCalled = true
					}
				},
			})

			const derived = list.deriveCollection((v: number) => v * 2)

			expect(watchedCalled).toBe(false)

			const dispose = createEffect(() => {
				derived.get()
			})

			expect(watchedCalled).toBe(true)
			expect(unwatchedCalled).toBe(false)

			dispose()
			expect(unwatchedCalled).toBe(true)
		})

		test('should activate watched via async deriveCollection', async () => {
			let watchedCalled = false
			let unwatchedCalled = false
			const list = createList([1, 2, 3], {
				watched: () => {
					watchedCalled = true
					return () => {
						unwatchedCalled = true
					}
				},
			})

			const derived = list.deriveCollection(
				async (v: number, _abort: AbortSignal) => v * 2,
			)

			expect(watchedCalled).toBe(false)

			const dispose = createEffect(() => {
				derived.get()
			})

			expect(watchedCalled).toBe(true)

			await wait(10)

			expect(unwatchedCalled).toBe(false)

			dispose()
			expect(unwatchedCalled).toBe(true)
		})

		test('should not tear down watched during list mutation via deriveCollection', () => {
			let activations = 0
			let deactivations = 0
			const list = createList([1, 2], {
				watched: () => {
					activations++
					return () => {
						deactivations++
					}
				},
			})

			const derived = list.deriveCollection((v: number) => v * 2)

			let result: number[] = []
			const dispose = createEffect(() => {
				result = derived.get()
			})

			expect(activations).toBe(1)
			expect(deactivations).toBe(0)
			expect(result).toEqual([2, 4])

			// Add item — should NOT tear down and restart watched
			list.add(3)
			expect(result).toEqual([2, 4, 6])
			expect(activations).toBe(1)
			expect(deactivations).toBe(0)

			// Remove item — should NOT tear down and restart watched
			list.remove(0)
			expect(activations).toBe(1)
			expect(deactivations).toBe(0)

			dispose()
			expect(deactivations).toBe(1)
		})

		test('should delay watched activation for conditional reads', () => {
			let watchedCalled = false
			const list = createList([1, 2], {
				watched: () => {
					watchedCalled = true
					return () => {}
				},
			})

			const show = createState(false)

			const dispose = createScope(() => {
				createEffect(() => {
					if (show.get()) {
						list.get()
					}
				})
			})

			// Conditional read — list not accessed, watched should not fire
			expect(watchedCalled).toBe(false)

			// Flip condition — list is now accessed
			show.set(true)
			expect(watchedCalled).toBe(true)

			dispose()
		})

		test('should activate watched via chained deriveCollection', () => {
			let watchedCalled = false
			const list = createList([1, 2, 3], {
				watched: () => {
					watchedCalled = true
					return () => {}
				},
			})

			const doubled = list.deriveCollection((v: number) => v * 2)
			const quadrupled = doubled.deriveCollection((v: number) => v * 2)

			expect(watchedCalled).toBe(false)

			const dispose = createEffect(() => {
				quadrupled.get()
			})

			expect(watchedCalled).toBe(true)
			dispose()
		})

		test('should activate watched via deriveCollection read inside match()', async () => {
			let watchedCalled = false
			const list = createList([1, 2], {
				watched: () => {
					watchedCalled = true
					return () => {}
				},
			})

			const derived = list.deriveCollection((v: number) => v * 10)

			const task = createTask(async () => {
				await wait(10)
				return 'done'
			})

			const dispose = createScope(() => {
				createEffect(() => {
					// Read derived BEFORE match to ensure subscription
					const values = derived.get()
					match([task], {
						ok: () => {
							void values
						},
						nil: () => {},
					})
				})
			})

			// watched should activate synchronously even though task is pending
			expect(watchedCalled).toBe(true)

			await wait(50)
			dispose()
		})
	})

	describe('Input Validation', () => {
		test('should throw for non-array initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createList('not an array')
			}).toThrow()
		})

		test('should throw for null initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createList(null)
			}).toThrow()
		})
	})

	describe('mutation tracking leak', () => {
		// Mutation methods read child item signals internally (e.g. to diff
		// old vs. new values). Those reads must be untracked — otherwise the
		// caller's effect silently gains edges to every item signal touched,
		// causing over-broad re-runs on unrelated item mutations.
		//
		// The leak has two observable modes:
		//  (a) persistent — leaked edges survive and a later item mutation
		//      re-runs the effect even though it never read the list.
		//  (b) transient — the mutation itself propagates through the just-
		//      leaked edge and re-runs the effect once during setup; after
		//      that re-run trimSources removes the edges.

		test('sort() inside an effect does not leak item-signal edges', () => {
			const list = createList([3, 1, 2])
			const trigger = createState(0)
			let runs = 0
			createEffect((): undefined => {
				trigger.get()
				runs++
				if (runs === 1) list.sort()
			})

			expect(runs).toBe(1)

			// Mutating an item value must NOT re-run the effect — it only
			// ever read `trigger`, not the list. (persistent leak, mode a)
			// biome-ignore lint/style/noNonNullAssertion: default key
			list.byKey('0')!.set(99)
			expect(runs).toBe(1)
		})

		test('splice() inside an effect does not leak item-signal edges', () => {
			const list = createList([1, 2, 3, 4])
			const trigger = createState(0)
			let runs = 0
			createEffect((): undefined => {
				trigger.get()
				runs++
				if (runs === 1) list.splice(1, 2) // reads keys '1','2'
			})

			expect(runs).toBe(1)

			// (persistent leak, mode a) — surviving items must not re-run
			// biome-ignore lint/style/noNonNullAssertion: default key
			list.byKey('0')!.set(99)
			expect(runs).toBe(1)
		})

		test('update() inside an effect does not transiently re-run', () => {
			// list.update calls list.get() (tracked) then list.set(). The
			// tracked get() leaks an effect->list edge; the subsequent set()
			// propagates through it, re-running the effect once during setup
			// (transient leak, mode b).
			const list = createList([1, 2, 3])
			const trigger = createState(0)
			let runs = 0
			createEffect((): undefined => {
				trigger.get()
				runs++
				if (runs === 1) list.update(arr => [...arr, 4])
			})

			// Without the fix, runs is 2 here (transient re-run).
			expect(runs).toBe(1)
		})

		test('set() inside an effect does not leak item-signal edges (dirty node)', () => {
			// A prior add() marks the node DIRTY, so set() takes the
			// buildValue() path — reading each item signal tracked and
			// leaking edges directly into the effect.
			const list = createList([1, 2, 3])
			const trigger = createState(0)
			let runs = 0
			createEffect((): undefined => {
				trigger.get()
				runs++
				if (runs === 1) {
					list.add(4) // marks node DIRTY
					list.set([1, 2, 3, 4])
				}
			})

			expect(runs).toBe(1)

			// (persistent leak, mode a)
			// biome-ignore lint/style/noNonNullAssertion: default key
			list.byKey('0')!.set(99)
			expect(runs).toBe(1)
		})
	})

	describe('Undefined handling', () => {
		// `undefined` elements must be rejected the same way `null` is — otherwise
		// `keys` grows sparse and `length` / `get()` disagree.
		test('should throw NullishSignalValueError for undefined elements on init', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createList([1, undefined, 3])
			}).toThrow(NullishSignalValueError)

			// Compacted arrays should work as expected
			const list = createList([1, undefined, 3].filter(x => x != null))
			expect(list.length).toBe(list.get().length)
		})

		test('should throw NullishSignalValueError for undefined elements on set() with content-based keys', () => {
			// The content-based diff path (diffArrays) skips undefined via
			// `if (val === undefined) continue` — that must throw instead.
			type Item = { id: string; v: number }
			const list = createList<Item>([{ id: 'a', v: 1 }], {
				keyConfig: item => item.id,
			})
			expect(() => {
				// @ts-expect-error - Testing invalid input
				list.set([{ id: 'a', v: 2 }, undefined])
			}).toThrow(NullishSignalValueError)

			// Compacted arrays should work as expected
			list.set([{ id: 'a', v: 2 }, undefined].filter(x => x != null))
			expect(list.length).toBe(list.get().length)
		})

		test('length and get() must agree when there are no undefined holes', () => {
			const list = createList([0, 1, 2, 3])
			expect(list.length).toBe(list.get().length)
		})
	})
})

test('Type Inference for custom createItem', () => {
	// This test primarily checks compilation types but also runtime presence
	type TodoItem = { id: string; text: string; done: boolean }
	const list = createList([], {
		keyConfig: 'todo',
		createItem: createStore<TodoItem>,
	})

	const byKey = list.byKey('todo0')
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
