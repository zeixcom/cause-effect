import { describe, expect, test } from 'bun:test'
import {
	createCollection,
	createEffect,
	createList,
	createStore,
	isCollection,
	UNSET,
} from '../index.ts'

describe('collection', () => {
	describe('creation and basic operations', () => {
		test('creates collection with initial values from list', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			expect(doubled.length).toBe(3)
			expect(doubled[0].get()).toBe(2)
			expect(doubled[1].get()).toBe(4)
			expect(doubled[2].get()).toBe(6)
		})

		test('creates collection from function source', () => {
			const numbers = createList([10, 20, 30])
			const doubled = createCollection(
				() => numbers,
				(value: number) => value * 2,
			)

			expect(doubled.length).toBe(3)
			expect(doubled[0].get()).toBe(20)
			expect(doubled[1].get()).toBe(40)
			expect(doubled[2].get()).toBe(60)
		})

		test('has Symbol.toStringTag of Collection', () => {
			const list = createList([1, 2, 3])
			const collection = createCollection(list, (x: number) => x)
			expect(Object.prototype.toString.call(collection)).toBe(
				'[object Collection]',
			)
		})

		test('isCollection identifies collection instances correctly', () => {
			const store = createStore({ a: 1 })
			const list = createList([1, 2, 3])
			const collection = createCollection(list, (x: number) => x)

			expect(isCollection(collection)).toBe(true)
			expect(isCollection(list)).toBe(false)
			expect(isCollection(store)).toBe(false)
			expect(isCollection({})).toBe(false)
			expect(isCollection(null)).toBe(false)
		})

		test('get() returns the complete collection value', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(
				numbers,
				(value: number) => value * 2,
			)

			const result = doubled.get()
			expect(result).toEqual([2, 4, 6])
			expect(Array.isArray(result)).toBe(true)
		})
	})

	describe('length property and sizing', () => {
		test('length property works for collections', () => {
			const numbers = createList([1, 2, 3, 4, 5])
			const collection = createCollection(numbers, (x: number) => x * 2)
			expect(collection.length).toBe(5)
		})

		test('length is reactive and updates with changes', () => {
			const items = createList([1, 2])
			const collection = createCollection(items, (x: number) => x * 2)

			expect(collection.length).toBe(2)
			items.add(3)
			expect(collection.length).toBe(3)
		})
	})

	describe('proxy data access', () => {
		test('properties can be accessed via computed signals', () => {
			const items = createList([10, 20, 30])
			const doubled = createCollection(items, (x: number) => x * 2)

			expect(doubled[0].get()).toBe(20)
			expect(doubled[1].get()).toBe(40)
			expect(doubled[2].get()).toBe(60)
		})

		test('returns undefined for non-existent properties', () => {
			const items = createList([1, 2])
			const collection = createCollection(items, (x: number) => x)
			expect(collection[5]).toBeUndefined()
		})

		test('supports numeric key access', () => {
			const numbers = createList([1, 2, 3])
			const collection = createCollection(numbers, (x: number) => x * 2)
			expect(collection.at(1)?.get()).toBe(4)
		})
	})

	describe('key-based access methods', () => {
		test('byKey() returns computed signal for existing keys', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			const key0 = numbers.keyAt(0)
			const key1 = numbers.keyAt(1)

			expect(key0).toBeDefined()
			expect(key1).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.byKey(key0!)).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.byKey(key1!)).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.byKey(key0!)?.get()).toBe(2)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.byKey(key1!)?.get()).toBe(4)
		})

		test('keyAt() and indexOfKey() work correctly', () => {
			const numbers = createList([5, 10, 15])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			const key0 = doubled.keyAt(0)
			const key1 = doubled.keyAt(1)

			expect(key0).toBeDefined()
			expect(key1).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.indexOfKey(key0!)).toBe(0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.indexOfKey(key1!)).toBe(1)
		})
	})

	describe('reactivity', () => {
		test('collection-level get() is reactive', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			let lastArray: number[] = []
			createEffect(() => {
				lastArray = doubled.get()
			})

			expect(lastArray).toEqual([2, 4, 6])
			numbers.add(4)
			expect(lastArray).toEqual([2, 4, 6, 8])
		})

		test('individual signal reactivity works', () => {
			const items = createList([{ count: 1 }, { count: 2 }])
			const doubled = createCollection(
				items,
				(item: { count: number }) => ({ count: item.count * 2 }),
			)

			let lastItem: { count: number } | undefined
			let itemEffectRuns = 0
			createEffect(() => {
				lastItem = doubled[0].get()
				itemEffectRuns++
			})

			expect(lastItem).toEqual({ count: 2 })
			expect(itemEffectRuns).toBe(1)

			items[0].set({ count: 5 })
			expect(lastItem).toEqual({ count: 10 })
			// Effect runs twice: once initially, once for change, plus once for collection change
			expect(itemEffectRuns).toBeGreaterThanOrEqual(2)
		})

		test('updates are reactive', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			let lastArray: number[] = []
			let arrayEffectRuns = 0
			createEffect(() => {
				lastArray = doubled.get()
				arrayEffectRuns++
			})

			expect(lastArray).toEqual([2, 4, 6])
			expect(arrayEffectRuns).toBe(1)

			numbers[1].set(10)
			expect(lastArray).toEqual([2, 20, 6])
			expect(arrayEffectRuns).toBe(2)
		})
	})

	describe('iteration and spreading', () => {
		test('supports for...of iteration', () => {
			const numbers = createList([1, 2, 3])
			const doubled = createCollection(numbers, (x: number) => x * 2)
			const signals = [...doubled]

			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(2)
			expect(signals[1].get()).toBe(4)
			expect(signals[2].get()).toBe(6)
		})

		test('Symbol.isConcatSpreadable is true', () => {
			const numbers = createList([1, 2, 3])
			const collection = createCollection(numbers, (x: number) => x)
			expect(collection[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('change notifications', () => {
		test('emits add notifications', () => {
			const numbers = createList([1, 2])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			let arrayAddNotification: readonly string[] = []
			doubled.on('add', keys => {
				arrayAddNotification = keys
			})

			numbers.add(3)
			expect(arrayAddNotification).toHaveLength(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(doubled.byKey(arrayAddNotification[0]!)?.get()).toBe(6)
		})

		test('emits remove notifications when items are removed', () => {
			const items = createList([1, 2, 3])
			const doubled = createCollection(items, (x: number) => x * 2)

			let arrayRemoveNotification: readonly string[] = []
			doubled.on('remove', keys => {
				arrayRemoveNotification = keys
			})

			items.remove(1)
			expect(arrayRemoveNotification).toHaveLength(1)
		})

		test('emits sort notifications when source is sorted', () => {
			const numbers = createList([3, 1, 2])
			const doubled = createCollection(numbers, (x: number) => x * 2)

			let sortNotification: readonly string[] = []
			doubled.on('sort', newOrder => {
				sortNotification = newOrder
			})

			numbers.sort((a, b) => a - b)
			expect(sortNotification).toHaveLength(3)
			expect(doubled.get()).toEqual([2, 4, 6])
		})
	})

	describe('edge cases', () => {
		test('handles empty collections correctly', () => {
			const empty = createList<number>([])
			const collection = createCollection(empty, (x: number) => x * 2)
			expect(collection.length).toBe(0)
			expect(collection.get()).toEqual([])
		})

		test('handles UNSET values', () => {
			const list = createList([1, 2, 3])
			const processed = createCollection(list, (x: number) =>
				x > 2 ? x : UNSET,
			)

			// UNSET values should be filtered out
			expect(processed.get()).toEqual([3])
		})

		test('handles primitive values', () => {
			const list = createList(['hello', 'world'])
			const lengths = createCollection(list, (str: string) => ({
				length: str.length,
			}))

			expect(lengths[0].get()).toEqual({ length: 5 })
			expect(lengths[1].get()).toEqual({ length: 5 })
		})
	})

	describe('deriveCollection() method', () => {
		describe('synchronous transformations', () => {
			test('transforms collection values with sync callback', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(quadrupled.length).toBe(3)
				expect(quadrupled[0].get()).toBe(4)
				expect(quadrupled[1].get()).toBe(8)
				expect(quadrupled[2].get()).toBe(12)
			})

			test('transforms object values with sync callback', () => {
				const users = createList([
					{ name: 'Alice', age: 25 },
					{ name: 'Bob', age: 30 },
				])
				const basicInfo = createCollection(
					users,
					(user: { name: string; age: number }) => ({
						displayName: user.name.toUpperCase(),
						isAdult: user.age >= 18,
					}),
				)
				const detailedInfo = basicInfo.deriveCollection(
					(info: { displayName: string; isAdult: boolean }) => ({
						...info,
						category: info.isAdult ? 'adult' : 'minor',
					}),
				)

				expect(detailedInfo[0].get()).toEqual({
					displayName: 'ALICE',
					isAdult: true,
					category: 'adult',
				})
				expect(detailedInfo[1].get()).toEqual({
					displayName: 'BOB',
					isAdult: true,
					category: 'adult',
				})
			})

			test('transforms string values to different types', () => {
				const words = createList(['hello', 'world', 'test'])
				const wordInfo = createCollection(words, (word: string) => ({
					word,
					length: word.length,
				}))
				const analysis = wordInfo.deriveCollection(
					(info: { word: string; length: number }) => ({
						...info,
						isLong: info.length > 4,
					}),
				)

				expect(analysis[0].get().word).toBe('hello')
				expect(analysis[0].get().length).toBe(5)
				expect(analysis[0].get().isLong).toBe(true)
				expect(analysis[1].get().word).toBe('world')
				expect(analysis[1].get().length).toBe(5)
				expect(analysis[1].get().isLong).toBe(true)
				expect(analysis[2].get().word).toBe('test')
				expect(analysis[2].get().length).toBe(4)
				expect(analysis[2].get().isLong).toBe(false)
			})

			test('derived collection reactivity with sync transformations', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				let collectionValue: number[] = []
				let effectRuns = 0
				createEffect(() => {
					collectionValue = quadrupled.get()
					effectRuns++
				})

				expect(collectionValue).toEqual([4, 8, 12])
				expect(effectRuns).toBe(1)

				numbers.add(4)
				expect(collectionValue).toEqual([4, 8, 12, 16])
				expect(effectRuns).toBe(2)

				numbers[1].set(5)
				expect(collectionValue).toEqual([4, 20, 12, 16])
				expect(effectRuns).toBe(3)
			})

			test('derived collection responds to source removal', () => {
				const numbers = createList([1, 2, 3, 4])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(quadrupled.get()).toEqual([4, 8, 12, 16])

				numbers.remove(1)
				expect(quadrupled.get()).toEqual([4, 12, 16])
			})
		})

		describe('asynchronous transformations', () => {
			test('transforms values with async callback', async () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)

				const asyncQuadrupled = doubled.deriveCollection(
					async (x: number, abort: AbortSignal) => {
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')
						return x * 2
					},
				)

				const initialLength = asyncQuadrupled.length
				expect(initialLength).toBe(3)

				// Initially, async computations return UNSET
				expect(asyncQuadrupled[0]).toBeDefined()
				expect(asyncQuadrupled[1]).toBeDefined()
				expect(asyncQuadrupled[2]).toBeDefined()

				// Use effects to test async reactivity
				const results: number[] = []
				let effectRuns = 0

				createEffect(() => {
					const values = asyncQuadrupled.get()
					results.push(...values)
					effectRuns++
				})

				// Wait for async computations to complete
				await new Promise(resolve => setTimeout(resolve, 50))

				// Should have received the computed values
				expect(results.slice(-3)).toEqual([4, 8, 12])
				expect(effectRuns).toBeGreaterThanOrEqual(1)
			})

			test('async derived collection with object transformation', async () => {
				const users = createList([
					{ id: 1, name: 'Alice' },
					{ id: 2, name: 'Bob' },
				])
				const basicInfo = createCollection(
					users,
					(user: { id: number; name: string }) => ({
						userId: user.id,
						displayName: user.name.toUpperCase(),
					}),
				)

				const enrichedUsers = basicInfo.deriveCollection(
					async (
						info: { userId: number; displayName: string },
						abort: AbortSignal,
					) => {
						// Simulate async enrichment
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')

						return {
							...info,
							slug: info.displayName
								.toLowerCase()
								.replace(/\s+/g, '-'),
							timestamp: Date.now(),
						}
					},
				)

				// Use effect to test async behavior
				let enrichedResults: Array<{
					userId: number
					displayName: string
					slug: string
					timestamp: number
				}> = []

				createEffect(() => {
					enrichedResults = enrichedUsers.get()
				})

				// Wait for async computations to complete
				await new Promise(resolve => setTimeout(resolve, 50))

				expect(enrichedResults).toHaveLength(2)

				const [result1, result2] = enrichedResults

				expect(result1?.userId).toBe(1)
				expect(result1?.displayName).toBe('ALICE')
				expect(result1?.slug).toBe('alice')
				expect(typeof result1?.timestamp).toBe('number')

				expect(result2?.userId).toBe(2)
				expect(result2?.displayName).toBe('BOB')
				expect(result2?.slug).toBe('bob')
				expect(typeof result2?.timestamp).toBe('number')
			})

			test('async derived collection reactivity', async () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const asyncQuadrupled = doubled.deriveCollection(
					async (x: number, abort: AbortSignal) => {
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')
						return x * 2
					},
				)

				const effectValues: number[][] = []
				createEffect(() => {
					// Access all values to trigger reactive behavior
					const currentValue = asyncQuadrupled.get()
					effectValues.push(currentValue)
				})

				// Wait for initial effect
				await new Promise(resolve => setTimeout(resolve, 50))

				// Initial empty array (async values not resolved yet)
				expect(effectValues[0]).toEqual([])

				// Trigger individual computations
				await Promise.all([
					asyncQuadrupled[0].get(),
					asyncQuadrupled[1].get(),
					asyncQuadrupled[2].get(),
				])

				// Wait for effects to process
				await new Promise(resolve => setTimeout(resolve, 50))

				// Should have the computed values now
				const lastValue = effectValues[effectValues.length - 1]
				expect(lastValue).toEqual([4, 8, 12])
			})

			test('handles AbortSignal cancellation', async () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				let abortCalled = false

				const slowCollection = doubled.deriveCollection(
					async (x: number, abort: AbortSignal) => {
						abort.addEventListener('abort', () => {
							abortCalled = true
						})

						// Long delay to allow cancellation
						const timeout = new Promise(resolve =>
							setTimeout(resolve, 100),
						)
						await timeout

						if (abort.aborted) throw new Error('Aborted')
						return x * 2
					},
				)

				// Start computation
				const promise = slowCollection[0].get()

				// Change source to trigger cancellation
				numbers[0].set(10)

				// Wait for potential abort
				await new Promise(resolve => setTimeout(resolve, 50))

				try {
					await promise
				} catch (_error) {
					// Expected to be cancelled
				}

				expect(abortCalled).toBe(true)
			})
		})

		describe('derived collection chaining', () => {
			test('chains multiple sync derivations', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)
				const octupled = quadrupled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(octupled[0].get()).toBe(8)
				expect(octupled[1].get()).toBe(16)
				expect(octupled[2].get()).toBe(24)
			})

			test('chains sync and async derivations', async () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				const asyncOctupled = quadrupled.deriveCollection(
					async (x: number, abort: AbortSignal) => {
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')
						return x * 2
					},
				)

				// Use effect to test chained async behavior
				let chainedResults: number[] = []

				createEffect(() => {
					chainedResults = asyncOctupled.get()
				})

				// Wait for async computations to complete
				await new Promise(resolve => setTimeout(resolve, 50))

				expect(chainedResults).toEqual([8, 16, 24])
			})
		})

		describe('derived collection access methods', () => {
			test('provides array-like access to computed signals', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(quadrupled[0].get()).toBe(4)
				expect(quadrupled[1].get()).toBe(8)
				expect(quadrupled[2].get()).toBe(12)
				expect(quadrupled[10]).toBeUndefined()
			})

			test('supports key-based access', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				const key0 = quadrupled.keyAt(0)
				const key1 = quadrupled.keyAt(1)

				expect(key0).toBeDefined()
				expect(key1).toBeDefined()
				// biome-ignore lint/style/noNonNullAssertion: test
				expect(quadrupled.byKey(key0!)).toBeDefined()
				// biome-ignore lint/style/noNonNullAssertion: test
				expect(quadrupled.byKey(key1!)).toBeDefined()
				// biome-ignore lint/style/noNonNullAssertion: test
				expect(quadrupled.byKey(key0!)?.get()).toBe(4)
				// biome-ignore lint/style/noNonNullAssertion: test
				expect(quadrupled.byKey(key1!)?.get()).toBe(8)
			})

			test('supports iteration', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				const signals = [...quadrupled]
				expect(signals).toHaveLength(3)
				expect(signals[0].get()).toBe(4)
				expect(signals[1].get()).toBe(8)
				expect(signals[2].get()).toBe(12)
			})
		})

		describe('derived collection event handling', () => {
			test('emits add events when source adds items', () => {
				const numbers = createList([1, 2])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				let addedKeys: readonly string[] = []
				quadrupled.on('add', keys => {
					addedKeys = keys
				})

				numbers.add(3)
				expect(addedKeys).toHaveLength(1)
				// biome-ignore lint/style/noNonNullAssertion: test
				expect(quadrupled.byKey(addedKeys[0]!)?.get()).toBe(12)
			})

			test('emits remove events when source removes items', () => {
				const numbers = createList([1, 2, 3])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				let removedKeys: readonly string[] = []
				quadrupled.on('remove', keys => {
					removedKeys = keys
				})

				numbers.remove(1)
				expect(removedKeys).toHaveLength(1)
			})

			test('emits sort events when source is sorted', () => {
				const numbers = createList([3, 1, 2])
				const doubled = createCollection(numbers, (x: number) => x * 2)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				let sortedKeys: readonly string[] = []
				quadrupled.on('sort', newOrder => {
					sortedKeys = newOrder
				})

				numbers.sort((a, b) => a - b)
				expect(sortedKeys).toHaveLength(3)
				expect(quadrupled.get()).toEqual([4, 8, 12])
			})
		})

		describe('edge cases', () => {
			test('handles empty collection derivation', () => {
				const empty = createList<number>([])
				const emptyCollection = createCollection(
					empty,
					(x: number) => x * 2,
				)
				const derived = emptyCollection.deriveCollection(
					(x: number) => x * 2,
				)

				expect(derived.length).toBe(0)
				expect(derived.get()).toEqual([])
			})

			test('handles UNSET values in transformation', () => {
				const list = createList([1, 2, 3])
				const filtered = createCollection(list, (x: number) =>
					x > 1 ? { value: x } : UNSET,
				)
				const doubled = filtered.deriveCollection(
					(x: { value: number }) => ({ value: x.value * 2 }),
				)

				expect(doubled.get()).toEqual([{ value: 4 }, { value: 6 }])
			})

			test('handles complex object transformations', () => {
				const items = createList([
					{ id: 1, data: { value: 10, active: true } },
					{ id: 2, data: { value: 20, active: false } },
				])

				const processed = createCollection(
					items,
					(item: {
						id: number
						data: { value: number; active: boolean }
					}) => ({
						itemId: item.id,
						processedValue: item.data.value * 2,
						status: item.data.active ? 'active' : 'inactive',
					}),
				)

				const enhanced = processed.deriveCollection(
					(item: {
						itemId: number
						processedValue: number
						status: string
					}) => ({
						...item,
						category: item.processedValue > 15 ? 'high' : 'low',
					}),
				)

				expect(enhanced[0].get().itemId).toBe(1)
				expect(enhanced[0].get().processedValue).toBe(20)
				expect(enhanced[0].get().status).toBe('active')
				expect(enhanced[0].get().category).toBe('high')
				expect(enhanced[1].get().itemId).toBe(2)
				expect(enhanced[1].get().processedValue).toBe(40)
				expect(enhanced[1].get().status).toBe('inactive')
				expect(enhanced[1].get().category).toBe('high')
			})
		})
	})
})
