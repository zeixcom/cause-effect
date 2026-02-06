import { describe, expect, test } from 'bun:test'
import {
	createCollection,
	createEffect,
	createList,
	isCollection,
} from '../next.ts'

describe('collection', () => {
	describe('synchronous transformations', () => {
		test('transforms list values with sync callback', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			expect(isCollection(doubled)).toBe(true)
			expect(doubled.length).toBe(3)
			expect(doubled.get()).toEqual([2, 4, 6])
		})

		test('transforms object values with sync callback', () => {
			const users = createList([
				{ name: 'Alice', age: 25 },
				{ name: 'Bob', age: 30 },
			])
			const userInfo = createCollection(users, user => ({
				displayName: user.name.toUpperCase(),
				isAdult: user.age >= 18,
			}))

			expect(userInfo.length).toBe(2)
			expect(userInfo.get()).toEqual([
				{ displayName: 'ALICE', isAdult: true },
				{ displayName: 'BOB', isAdult: true },
			])
		})

		test('transforms string values to different types', () => {
			const words = createList(['hello', 'world', 'test'])
			const wordLengths = createCollection(words, (word: string) => ({
				word,
				length: word.length,
			}))

			expect(wordLengths.get()).toEqual([
				{ word: 'hello', length: 5 },
				{ word: 'world', length: 5 },
				{ word: 'test', length: 4 },
			])
		})

		test('collection reactivity with sync transformations', () => {
			const numbers = createList([1, 2])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			let collectionValue: number[] = []
			let effectRuns = 0
			createEffect(() => {
				collectionValue = doubled.get()
				effectRuns++
			})

			expect(collectionValue).toEqual([2, 4])
			expect(effectRuns).toBe(1)

			// Add new item
			numbers.add(3)
			expect(collectionValue).toEqual([2, 4, 6])
			expect(effectRuns).toBe(2)

			// Modify existing item
			numbers.at(0)?.set(5)
			expect(collectionValue).toEqual([10, 4, 6])
			expect(effectRuns).toBe(3)
		})

		test('collection responds to source removal', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			expect(doubled.get()).toEqual([2, 4, 6])

			numbers.remove(1) // Remove middle item (2)
			expect(doubled.get()).toEqual([2, 6])
			expect(doubled.length).toBe(2)
		})
	})

	describe('asynchronous transformations', () => {
		test('transforms values with async callback', async () => {
			const numbers = createList([1, 2, 3])
			const asyncDoubled = createCollection(
				numbers,
				async (value: number, abort: AbortSignal) => {
					await new Promise(resolve => setTimeout(resolve, 10))
					if (abort.aborted) throw new Error('Aborted')
					return value * 2
				},
			)

			expect(asyncDoubled.length).toBe(3)

			// Access each computed signal to trigger computation
			for (let i = 0; i < asyncDoubled.length; i++) {
				asyncDoubled.at(i)?.get()
			}

			// Allow async operations to complete
			await new Promise(resolve => setTimeout(resolve, 50))

			expect(asyncDoubled.get()).toEqual([2, 4, 6])
		})

		test('async collection reactivity', async () => {
			const numbers = createList([1, 2])
			const asyncDoubled = createCollection(
				numbers,
				async (value: number, abort: AbortSignal) => {
					await new Promise(resolve => setTimeout(resolve, 5))
					if (abort.aborted) throw new Error('Aborted')
					return value * 2
				},
			)

			const effectValues: number[][] = []

			createEffect(() => {
				const currentValue = asyncDoubled.get()
				effectValues.push([...currentValue])
			})

			// Allow initial computation
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(effectValues[effectValues.length - 1]).toEqual([2, 4])

			// Add new item
			numbers.add(3)
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(effectValues[effectValues.length - 1]).toEqual([2, 4, 6])

			// Modify existing item
			numbers.at(0)?.set(5)
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(effectValues[effectValues.length - 1]).toEqual([10, 4, 6])
		})
	})

	describe('derived collection chaining', () => {
		test('chains multiple sync derivations', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)
			const quadrupled = createCollection(
				doubled,
				(value: number) => value * 2,
			)

			expect(quadrupled.get()).toEqual([4, 8, 12])

			numbers.add(4)
			expect(quadrupled.get()).toEqual([4, 8, 12, 16])
		})

		test('chains via deriveCollection on list', () => {
			const numbers = createList([1, 2, 3])
			const doubled = numbers.deriveCollection(
				(value: number) => value * 2,
			)

			expect(isCollection(doubled)).toBe(true)
			expect(doubled.get()).toEqual([2, 4, 6])

			numbers.add(4)
			expect(doubled.get()).toEqual([2, 4, 6, 8])
		})

		test('chains deriveCollection on collection', () => {
			const numbers = createList([1, 2, 3])
			const doubled = numbers.deriveCollection(
				(value: number) => value * 2,
			)
			const quadrupled = doubled.deriveCollection(
				(value: number) => value * 2,
			)

			expect(quadrupled.get()).toEqual([4, 8, 12])

			numbers.add(4)
			expect(quadrupled.get()).toEqual([4, 8, 12, 16])
		})
	})

	describe('collection access methods', () => {
		test('supports index-based access to computed signals', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			expect(doubled.at(0)?.get()).toBe(2)
			expect(doubled.at(1)?.get()).toBe(4)
			expect(doubled.at(2)?.get()).toBe(6)
			expect(doubled.at(3)).toBeUndefined()
		})

		test('supports key-based access', () => {
			const numbers = createList([10, 20])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			const key0 = numbers.keyAt(0)
			const key1 = numbers.keyAt(1)

			expect(key0).toBeDefined()
			expect(key1).toBeDefined()

			if (key0 && key1) {
				expect(doubled.byKey(key0)?.get()).toBe(20)
				expect(doubled.byKey(key1)?.get()).toBe(40)
			}
		})

		test('supports iteration', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			const signals = [...doubled]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(2)
			expect(signals[1].get()).toBe(4)
			expect(signals[2].get()).toBe(6)
		})

		test('keyAt and indexOfKey work correctly', () => {
			const numbers = createList([10, 20, 30])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			const key0 = doubled.keyAt(0)
			expect(key0).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.indexOfKey(key0!)).toBe(0)
		})
	})

	describe('edge cases', () => {
		test('handles empty list derivation', () => {
			const empty = createList<number>([])
			const doubled = createCollection(
				empty,
				(value: number) => value * 2,
			)

			expect(doubled.get()).toEqual([])
			expect(doubled.length).toBe(0)
		})

		test('handles complex object transformations', () => {
			const items = createList([
				{ id: 1, data: { value: 10, active: true } },
				{ id: 2, data: { value: 20, active: false } },
			])

			const transformed = createCollection(items, item => ({
				itemId: item.id,
				processedValue: item.data.value * 2,
				status: item.data.active ? 'enabled' : 'disabled',
			}))

			expect(transformed.get()).toEqual([
				{ itemId: 1, processedValue: 20, status: 'enabled' },
				{ itemId: 2, processedValue: 40, status: 'disabled' },
			])
		})
	})
})
