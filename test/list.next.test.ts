import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createList,
	createMemo,
	createState,
	createStore,
	isList,
	isStore,
} from '../next.ts'

describe('list', () => {
	describe('creation and basic operations', () => {
		test('creates lists with initial values', () => {
			const numbers = createList([1, 2, 3])
			expect(numbers.at(0)?.get()).toBe(1)
			expect(numbers.at(1)?.get()).toBe(2)
			expect(numbers.at(2)?.get()).toBe(3)
		})

		test('has Symbol.toStringTag of List', () => {
			const list = createList([1, 2])
			expect(list[Symbol.toStringTag]).toBe('List')
		})

		test('isList identifies list instances correctly', () => {
			const store = createStore({ a: 1 })
			const list = createList([1])
			const state = createState(1)
			const computed = createMemo(() => 1)

			expect(isList(list)).toBe(true)
			expect(isStore(store)).toBe(true)
			expect(isList(state)).toBe(false)
			expect(isList(computed)).toBe(false)
			expect(isList({})).toBe(false)
		})

		test('get() returns the complete list value', () => {
			const numbers = createList([1, 2, 3])
			expect(numbers.get()).toEqual([1, 2, 3])

			const participants = createList([
				{ name: 'Alice', tags: ['admin'] },
				{ name: 'Bob', tags: ['user'] },
			])
			expect(participants.get()).toEqual([
				{ name: 'Alice', tags: ['admin'] },
				{ name: 'Bob', tags: ['user'] },
			])
		})
	})

	describe('length property and sizing', () => {
		test('length property works for lists', () => {
			const numbers = createList([1, 2, 3])
			expect(numbers.length).toBe(3)
			expect(typeof numbers.length).toBe('number')
		})

		test('length is reactive and updates with changes', () => {
			const items = createList([1, 2])
			expect(items.length).toBe(2)
			items.add(3)
			expect(items.length).toBe(3)
			items.remove(1)
			expect(items.length).toBe(2)
		})
	})

	describe('data access and modification', () => {
		test('items can be accessed and modified via signals', () => {
			const items = createList(['a', 'b'])
			expect(items.at(0)?.get()).toBe('a')
			expect(items.at(1)?.get()).toBe('b')
			items.at(0)?.set('alpha')
			items.at(1)?.set('beta')
			expect(items.at(0)?.get()).toBe('alpha')
			expect(items.at(1)?.get()).toBe('beta')
		})

		test('returns undefined for non-existent properties', () => {
			const items = createList(['a'])
			expect(items.at(5)).toBeUndefined()
		})
	})

	describe('add() and remove() methods', () => {
		test('add() method appends to end', () => {
			const fruits = createList(['apple', 'banana'])
			fruits.add('cherry')
			expect(fruits.at(2)?.get()).toBe('cherry')
		})

		test('remove() method removes by index', () => {
			const items = createList(['a', 'b', 'c'])
			items.remove(1) // Remove 'b'
			expect(items.get()).toEqual(['a', 'c'])
			expect(items.length).toBe(2)
		})

		test('add method prevents null values', () => {
			const items = createList([1])
			// @ts-expect-error testing null values
			expect(() => items.add(null)).toThrow()
		})

		test('remove method handles non-existent indices gracefully', () => {
			const items = createList(['a'])
			expect(() => items.remove(5)).not.toThrow()
			expect(items.get()).toEqual(['a'])
		})
	})

	describe('sort() method', () => {
		test('sorts lists with different compare functions', () => {
			const numbers = createList([3, 1, 2])

			numbers.sort()
			expect(numbers.get()).toEqual([1, 2, 3])

			numbers.sort((a, b) => b - a)
			expect(numbers.get()).toEqual([3, 2, 1])

			const names = createList(['Charlie', 'Alice', 'Bob'])
			names.sort((a, b) => a.localeCompare(b))
			expect(names.get()).toEqual(['Alice', 'Bob', 'Charlie'])
		})

		test('sort is reactive - watchers are notified', () => {
			const numbers = createList([3, 1, 2])
			let effectCount = 0
			let lastValue: number[] = []
			createEffect(() => {
				lastValue = numbers.get()
				effectCount++
			})

			expect(effectCount).toBe(1)
			expect(lastValue).toEqual([3, 1, 2])

			numbers.sort()
			expect(effectCount).toBe(2)
			expect(lastValue).toEqual([1, 2, 3])
		})
	})

	describe('splice() method', () => {
		test('splice() removes elements without adding new ones', () => {
			const numbers = createList([1, 2, 3, 4])
			const deleted = numbers.splice(1, 2)
			expect(deleted).toEqual([2, 3])
			expect(numbers.get()).toEqual([1, 4])
		})

		test('splice() adds elements without removing any', () => {
			const numbers = createList([1, 3])
			const deleted = numbers.splice(1, 0, 2)
			expect(deleted).toEqual([])
			expect(numbers.get()).toEqual([1, 2, 3])
		})

		test('splice() replaces elements (remove and add)', () => {
			const numbers = createList([1, 2, 3])
			const deleted = numbers.splice(1, 1, 4, 5)
			expect(deleted).toEqual([2])
			expect(numbers.get()).toEqual([1, 4, 5, 3])
		})

		test('splice() handles negative start index', () => {
			const numbers = createList([1, 2, 3])
			const deleted = numbers.splice(-1, 1, 4)
			expect(deleted).toEqual([3])
			expect(numbers.get()).toEqual([1, 2, 4])
		})
	})

	describe('reactivity', () => {
		test('list-level get() is reactive', () => {
			const numbers = createList([1, 2, 3])
			let lastArray: number[] = []
			createEffect(() => {
				lastArray = numbers.get()
			})

			expect(lastArray).toEqual([1, 2, 3])
			numbers.add(4)
			expect(lastArray).toEqual([1, 2, 3, 4])
		})

		test('individual signal reactivity works', () => {
			const items = createList([{ count: 5 }])
			let lastItem = 0
			let itemEffectRuns = 0
			createEffect(() => {
				lastItem = items.at(0)?.get().count ?? 0
				itemEffectRuns++
			})

			expect(lastItem).toBe(5)
			expect(itemEffectRuns).toBe(1)

			items.at(0)?.set({ count: 10 })
			expect(lastItem).toBe(10)
			expect(itemEffectRuns).toBe(2)
		})

		test('updates are reactive', () => {
			const numbers = createList([1, 2])
			let lastArray: number[] = []
			let arrayEffectRuns = 0
			createEffect(() => {
				lastArray = numbers.get()
				arrayEffectRuns++
			})

			expect(lastArray).toEqual([1, 2])
			expect(arrayEffectRuns).toBe(1)

			numbers.update(arr => [...arr, 3])
			expect(lastArray).toEqual([1, 2, 3])
			expect(arrayEffectRuns).toBe(2)
		})
	})

	describe('computed integration', () => {
		test('works with computed signals', () => {
			const numbers = createList([1, 2, 3])
			const sum = createMemo(() =>
				numbers.get().reduce((acc, n) => acc + n, 0),
			)

			expect(sum.get()).toBe(6)
			numbers.add(4)
			expect(sum.get()).toBe(10)
		})

		test('computed handles additions and removals', () => {
			const numbers = createList([1, 2, 3])
			const sum = createMemo(() => {
				const array = numbers.get()
				return array.reduce((total, n) => total + n, 0)
			})

			expect(sum.get()).toBe(6)

			numbers.add(4)
			expect(sum.get()).toBe(10)

			numbers.remove(0)
			const finalArray = numbers.get()
			expect(finalArray).toEqual([2, 3, 4])
			expect(sum.get()).toBe(9)
		})

		test('computed sum using list iteration with length tracking', () => {
			const numbers = createList([1, 2, 3])

			const sum = createMemo(() => {
				// Access length to make it reactive
				const _length = numbers.length
				let total = 0
				for (const signal of numbers) {
					total += signal.get()
				}
				return total
			})

			expect(sum.get()).toBe(6)
			numbers.add(4)
			expect(sum.get()).toBe(10)
		})
	})

	describe('iteration and spreading', () => {
		test('supports for...of iteration', () => {
			const numbers = createList([10, 20, 30])
			const signals = [...numbers]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(10)
			expect(signals[1].get()).toBe(20)
			expect(signals[2].get()).toBe(30)
		})

		test('Symbol.isConcatSpreadable is true', () => {
			const numbers = createList([1, 2, 3])
			expect(numbers[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('edge cases', () => {
		test('handles empty lists correctly', () => {
			const empty = createList<number>([])
			expect(empty.get()).toEqual([])
			expect(empty.length).toBe(0)
		})

		test('handles primitive values', () => {
			const list = createList([42, 'text', true])
			expect(list.at(0)?.get()).toBe(42)
			expect(list.at(1)?.get()).toBe('text')
			expect(list.at(2)?.get()).toBe(true)
		})
	})

	describe('key-based access', () => {
		test('keyAt and indexOfKey work correctly', () => {
			const numbers = createList([10, 20, 30])
			const key0 = numbers.keyAt(0)
			const key1 = numbers.keyAt(1)

			expect(key0).toBeDefined()
			expect(key1).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.indexOfKey(key0!)).toBe(0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.indexOfKey(key1!)).toBe(1)
		})

		test('byKey returns correct signal', () => {
			const numbers = createList([10, 20])
			const key0 = numbers.keyAt(0)

			expect(key0).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.byKey(key0!)?.get()).toBe(10)
		})

		test('custom keyConfig with function', () => {
			const items = createList(
				[
					{ id: 'a', value: 1 },
					{ id: 'b', value: 2 },
				],
				{ keyConfig: (item: { id: string; value: number }) => item.id },
			)

			expect(items.byKey('a')?.get()).toEqual({ id: 'a', value: 1 })
			expect(items.byKey('b')?.get()).toEqual({ id: 'b', value: 2 })
		})

		test('custom keyConfig with prefix string', () => {
			const items = createList([1, 2, 3], { keyConfig: 'item-' })
			expect(items.keyAt(0)).toBe('item-0')
			expect(items.keyAt(1)).toBe('item-1')
			expect(items.keyAt(2)).toBe('item-2')
		})
	})

	describe('watch callbacks', () => {
		test('watched callback is called when effect accesses list.get()', () => {
			let watchedCalled = false
			let unwatchedCalled = false
			const numbers = createList([10, 20, 30], {
				watched: () => {
					watchedCalled = true
					return () => {
						unwatchedCalled = true
					}
				},
			})

			expect(watchedCalled).toBe(false)

			let effectValue: number[] = []
			const cleanup = createEffect(() => {
				effectValue = numbers.get()
			})

			expect(watchedCalled).toBe(true)
			expect(effectValue).toEqual([10, 20, 30])
			expect(unwatchedCalled).toBe(false)

			cleanup()
			expect(unwatchedCalled).toBe(true)
		})

		test('length access triggers watched callback', () => {
			let watchedCalled = false
			let unwatchedCalled = false
			const numbers = createList([1, 2, 3], {
				watched: () => {
					watchedCalled = true
					return () => {
						unwatchedCalled = true
					}
				},
			})

			let effectValue = 0
			const cleanup = createEffect(() => {
				effectValue = numbers.length
			})

			expect(watchedCalled).toBe(true)
			expect(effectValue).toBe(3)
			expect(unwatchedCalled).toBe(false)

			cleanup()
			expect(unwatchedCalled).toBe(true)
		})
	})
})
