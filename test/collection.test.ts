import { describe, expect, test } from 'bun:test'
import {
	createCollection,
	createEffect,
	createList,
	isCollection,
	isList,
} from '../next.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Collection', () => {
	describe('createCollection', () => {
		test('should transform list values with sync callback', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(numbers, (v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(doubled.length).toBe(3)
		})

		test('should transform values with async callback', async () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
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
			const doubled = createCollection(empty, (v: number) => v * 2)

			expect(doubled.get()).toEqual([])
			expect(doubled.length).toBe(0)
		})

		test('should have Symbol.toStringTag of "Collection"', () => {
			const list = createList([1])
			const col = createCollection(list, (v: number) => v)
			expect(col[Symbol.toStringTag]).toBe('Collection')
		})

		test('should have Symbol.isConcatSpreadable set to true', () => {
			const list = createList([1])
			const col = createCollection(list, (v: number) => v)
			expect(col[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('isCollection', () => {
		test('should identify collection signals', () => {
			const list = createList([1])
			const col = createCollection(list, (v: number) => v)
			expect(isCollection(col)).toBe(true)
		})

		test('should return false for non-collection values', () => {
			expect(isCollection(42)).toBe(false)
			expect(isCollection(null)).toBe(false)
			expect(isCollection({})).toBe(false)
			expect(
				isList(createCollection(createList([1]), (v: number) => v)),
			).toBe(false)
		})
	})

	describe('at', () => {
		test('should return Signal at index', () => {
			const list = createList([1, 2, 3])
			const doubled = createCollection(list, (v: number) => v * 2)

			expect(doubled.at(0)?.get()).toBe(2)
			expect(doubled.at(1)?.get()).toBe(4)
			expect(doubled.at(2)?.get()).toBe(6)
		})

		test('should return undefined for out-of-bounds index', () => {
			const list = createList([1])
			const col = createCollection(list, (v: number) => v)
			expect(col.at(5)).toBeUndefined()
		})
	})

	describe('byKey', () => {
		test('should return Signal by source key', () => {
			const list = createList([10, 20])
			const doubled = createCollection(list, (v: number) => v * 2)

			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key0 = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key1 = list.keyAt(1)!

			expect(doubled.byKey(key0)?.get()).toBe(20)
			expect(doubled.byKey(key1)?.get()).toBe(40)
		})
	})

	describe('Key-based Access', () => {
		test('keyAt should return key at index', () => {
			const list = createList([10, 20, 30])
			const col = createCollection(list, (v: number) => v)
			const key0 = col.keyAt(0)
			expect(key0).toBeDefined()
			expect(typeof key0).toBe('string')
		})

		test('indexOfKey should return index for key', () => {
			const list = createList([10, 20])
			const col = createCollection(list, (v: number) => v)
			// biome-ignore lint/style/noNonNullAssertion: index is within bounds
			const key = col.keyAt(0)!
			expect(col.indexOfKey(key)).toBe(0)
		})

		test('keys should return iterator of all keys', () => {
			const list = createList([10, 20, 30])
			const col = createCollection(list, (v: number) => v)
			const allKeys = [...col.keys()]
			expect(allKeys).toHaveLength(3)
		})
	})

	describe('Iteration', () => {
		test('should support for...of via Symbol.iterator', () => {
			const list = createList([1, 2, 3])
			const doubled = createCollection(list, (v: number) => v * 2)

			const signals = [...doubled]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(2)
			expect(signals[1].get()).toBe(4)
			expect(signals[2].get()).toBe(6)
		})
	})

	describe('Reactivity', () => {
		test('should react to source additions', () => {
			const list = createList([1, 2])
			const doubled = createCollection(list, (v: number) => v * 2)

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
			const doubled = createCollection(list, (v: number) => v * 2)

			expect(doubled.get()).toEqual([2, 4, 6])
			list.remove(1)
			expect(doubled.get()).toEqual([2, 6])
			expect(doubled.length).toBe(2)
		})

		test('should react to item mutations', () => {
			const list = createList([1, 2])
			const doubled = createCollection(list, (v: number) => v * 2)

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
			const doubled = createCollection(
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
	})

	describe('deriveCollection', () => {
		test('should chain from list with sync callback', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)

			expect(isCollection(doubled)).toBe(true)
			expect(doubled.get()).toEqual([2, 4, 6])

			list.add(4)
			expect(doubled.get()).toEqual([2, 4, 6, 8])
		})

		test('should chain from collection with sync callback', () => {
			const list = createList([1, 2, 3])
			const doubled = list.deriveCollection((v: number) => v * 2)
			const quadrupled = doubled.deriveCollection((v: number) => v * 2)

			expect(quadrupled.get()).toEqual([4, 8, 12])

			list.add(4)
			expect(quadrupled.get()).toEqual([4, 8, 12, 16])
		})

		test('should chain with createCollection from collection source', () => {
			const list = createList([1, 2, 3])
			const doubled = createCollection(list, (v: number) => v * 2)
			const quadrupled = createCollection(doubled, (v: number) => v * 2)

			expect(quadrupled.get()).toEqual([4, 8, 12])
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for non-function callback', () => {
			const list = createList([1])
			// @ts-expect-error - Testing invalid input
			expect(() => createCollection(list, null)).toThrow(
				'[Collection] Callback null is invalid',
			)
		})

		test('should throw TypeError for invalid source', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createCollection({}, (v: number) => v)
			}).toThrow('Invalid collection source')
		})
	})
})
