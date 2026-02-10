import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createList,
	createMemo,
	isList,
	isMemo,
} from '../next.ts'

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
			expect(isMemo(createList([1]))).toBe(false)
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
	})

	describe('update', () => {
		test('should update via callback', () => {
			const list = createList([1, 2])
			list.update(arr => [...arr, 3])
			expect(list.get()).toEqual([1, 2, 3])
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
			expect(() => list.add({ id: 'a', val: 2 })).toThrow(
				'already exists',
			)
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

		test('keys should return iterator of all keys', () => {
			const list = createList([10, 20, 30])
			const allKeys = [...list.keys()]
			expect(allKeys).toHaveLength(3)
			expect(list.byKey(allKeys[0])?.get()).toBe(10)
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
			expect(signals[0].get()).toBe(10)
			expect(signals[1].get()).toBe(20)
			expect(signals[2].get()).toBe(30)
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
			const sum = createMemo(() =>
				list.get().reduce((acc, n) => acc + n, 0),
			)

			expect(sum.get()).toBe(6)
			list.add(4)
			expect(sum.get()).toBe(10)
			list.remove(0)
			expect(sum.get()).toBe(9)
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
})
