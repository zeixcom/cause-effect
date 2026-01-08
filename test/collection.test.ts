import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createStore,
	DerivedCollection,
	isCollection,
	List,
	UNSET,
} from '../index.ts'

describe('collection', () => {
	describe('creation and basic operations', () => {
		test('creates collection with initial values from list', () => {
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(
				numbers,
				(value: number) => value * 2,
			)

			expect(doubled.length).toBe(3)
			expect(doubled.at(0)?.get()).toBe(2)
			expect(doubled.at(1)?.get()).toBe(4)
			expect(doubled.at(2)?.get()).toBe(6)
		})

		test('creates collection from function source', () => {
			const doubled = new DerivedCollection(
				() => new List([10, 20, 30]),
				(value: number) => value * 2,
			)

			expect(doubled.length).toBe(3)
			expect(doubled.at(0)?.get()).toBe(20)
			expect(doubled.at(1)?.get()).toBe(40)
			expect(doubled.at(2)?.get()).toBe(60)
		})

		test('has Symbol.toStringTag of Collection', () => {
			const list = new List([1, 2, 3])
			const collection = new DerivedCollection(list, (x: number) => x)
			expect(Object.prototype.toString.call(collection)).toBe(
				'[object Collection]',
			)
		})

		test('isCollection identifies collection instances correctly', () => {
			const store = createStore({ a: 1 })
			const list = new List([1, 2, 3])
			const collection = new DerivedCollection(list, (x: number) => x)

			expect(isCollection(collection)).toBe(true)
			expect(isCollection(list)).toBe(false)
			expect(isCollection(store)).toBe(false)
			expect(isCollection({})).toBe(false)
			expect(isCollection(null)).toBe(false)
		})

		test('get() returns the complete collection value', () => {
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(
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
			const numbers = new List([1, 2, 3, 4, 5])
			const collection = new DerivedCollection(
				numbers,
				(x: number) => x * 2,
			)
			expect(collection.length).toBe(5)
		})

		test('length is reactive and updates with changes', () => {
			const items = new List([1, 2])
			const collection = new DerivedCollection(
				items,
				(x: number) => x * 2,
			)

			expect(collection.length).toBe(2)
			items.add(3)
			expect(collection.length).toBe(3)
		})
	})

	describe('index-based access', () => {
		test('properties can be accessed via computed signals', () => {
			const items = new List([10, 20, 30])
			const doubled = new DerivedCollection(items, (x: number) => x * 2)

			expect(doubled.at(0)?.get()).toBe(20)
			expect(doubled.at(1)?.get()).toBe(40)
			expect(doubled.at(2)?.get()).toBe(60)
		})

		test('returns undefined for non-existent properties', () => {
			const items = new List([1, 2])
			const collection = new DerivedCollection(items, (x: number) => x)
			expect(collection.at(5)).toBeUndefined()
		})

		test('supports numeric key access', () => {
			const numbers = new List([1, 2, 3])
			const collection = new DerivedCollection(
				numbers,
				(x: number) => x * 2,
			)
			expect(collection.at(1)?.get()).toBe(4)
		})
	})

	describe('key-based access methods', () => {
		test('byKey() returns computed signal for existing keys', () => {
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(numbers, (x: number) => x * 2)

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
			const numbers = new List([5, 10, 15])
			const doubled = new DerivedCollection(numbers, (x: number) => x * 2)

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
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(numbers, (x: number) => x * 2)

			let lastArray: number[] = []
			createEffect(() => {
				lastArray = doubled.get()
			})

			expect(lastArray).toEqual([2, 4, 6])
			numbers.add(4)
			expect(lastArray).toEqual([2, 4, 6, 8])
		})

		test('individual signal reactivity works', () => {
			const items = new List([{ count: 1 }, { count: 2 }])
			const doubled = new DerivedCollection(
				items,
				(item: { count: number }) => ({ count: item.count * 2 }),
			)

			let lastItem: { count: number } | undefined
			let itemEffectRuns = 0
			createEffect(() => {
				lastItem = doubled.at(0)?.get()
				itemEffectRuns++
			})

			expect(lastItem).toEqual({ count: 2 })
			expect(itemEffectRuns).toBe(1)

			items.at(0)?.set({ count: 5 })
			expect(lastItem).toEqual({ count: 10 })
			// Effect runs twice: once initially, once for change
			expect(itemEffectRuns).toEqual(2)
		})

		test('updates are reactive', () => {
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(numbers, (x: number) => x * 2)

			let lastArray: number[] = []
			let arrayEffectRuns = 0
			createEffect(() => {
				lastArray = doubled.get()
				arrayEffectRuns++
			})

			expect(lastArray).toEqual([2, 4, 6])
			expect(arrayEffectRuns).toBe(1)

			numbers.at(1)?.set(10)
			expect(lastArray).toEqual([2, 20, 6])
			expect(arrayEffectRuns).toBe(2)
		})
	})

	describe('iteration and spreading', () => {
		test('supports for...of iteration', () => {
			const numbers = new List([1, 2, 3])
			const doubled = new DerivedCollection(numbers, (x: number) => x * 2)
			const signals = [...doubled]

			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(2)
			expect(signals[1].get()).toBe(4)
			expect(signals[2].get()).toBe(6)
		})

		test('Symbol.isConcatSpreadable is true', () => {
			const numbers = new List([1, 2, 3])
			const collection = new DerivedCollection(numbers, (x: number) => x)
			expect(collection[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('edge cases', () => {
		test('handles empty collections correctly', () => {
			const empty = new List<number>([])
			const collection = new DerivedCollection(
				empty,
				(x: number) => x * 2,
			)
			expect(collection.length).toBe(0)
			expect(collection.get()).toEqual([])
		})

		test('handles UNSET values', () => {
			const list = new List([1, 2, 3])
			const processed = new DerivedCollection(list, (x: number) =>
				x > 2 ? x : UNSET,
			)

			// UNSET values should be filtered out
			expect(processed.get()).toEqual([3])
		})

		test('handles primitive values', () => {
			const list = new List(['hello', 'world'])
			const lengths = new DerivedCollection(list, (str: string) => ({
				length: str.length,
			}))

			expect(lengths.at(0)?.get()).toEqual({ length: 5 })
			expect(lengths.at(1)?.get()).toEqual({ length: 5 })
		})
	})

	describe('deriveCollection() method', () => {
		describe('synchronous transformations', () => {
			test('transforms collection values with sync callback', () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(quadrupled.length).toBe(3)
				expect(quadrupled.at(0)?.get()).toBe(4)
				expect(quadrupled.at(1)?.get()).toBe(8)
				expect(quadrupled.at(2)?.get()).toBe(12)
			})

			test('transforms object values with sync callback', () => {
				const users = new List([
					{ name: 'Alice', age: 25 },
					{ name: 'Bob', age: 30 },
				])
				const basicInfo = new DerivedCollection(
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

				expect(detailedInfo.at(0)?.get()).toEqual({
					displayName: 'ALICE',
					isAdult: true,
					category: 'adult',
				})
				expect(detailedInfo.at(1)?.get()).toEqual({
					displayName: 'BOB',
					isAdult: true,
					category: 'adult',
				})
			})

			test('transforms string values to different types', () => {
				const words = new List(['hello', 'world', 'test'])
				const wordInfo = new DerivedCollection(
					words,
					(word: string) => ({
						word,
						length: word.length,
					}),
				)
				const analysis = wordInfo.deriveCollection(
					(info: { word: string; length: number }) => ({
						...info,
						isLong: info.length > 4,
					}),
				)

				expect(analysis.at(0)?.get().word).toBe('hello')
				expect(analysis.at(0)?.get().length).toBe(5)
				expect(analysis.at(0)?.get().isLong).toBe(true)
				expect(analysis.at(1)?.get().word).toBe('world')
				expect(analysis.at(1)?.get().length).toBe(5)
				expect(analysis.at(1)?.get().isLong).toBe(true)
				expect(analysis.at(2)?.get().word).toBe('test')
				expect(analysis.at(2)?.get().length).toBe(4)
				expect(analysis.at(2)?.get().isLong).toBe(false)
			})

			test('derived collection reactivity with sync transformations', () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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

				numbers.at(1)?.set(5)
				expect(collectionValue).toEqual([4, 20, 12, 16])
				expect(effectRuns).toBe(3)
			})

			test('derived collection responds to source removal', () => {
				const numbers = new List([1, 2, 3, 4])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)

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
				expect(asyncQuadrupled.at(0)).toBeDefined()
				expect(asyncQuadrupled.at(1)).toBeDefined()
				expect(asyncQuadrupled.at(2)).toBeDefined()

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
				const users = new List([
					{ id: 1, name: 'Alice' },
					{ id: 2, name: 'Bob' },
				])
				const basicInfo = new DerivedCollection(
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
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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
				asyncQuadrupled.at(0)?.get()
				asyncQuadrupled.at(1)?.get()
				asyncQuadrupled.at(2)?.get()

				// Wait for effects to process
				await new Promise(resolve => setTimeout(resolve, 50))

				// Should have the computed values now
				const lastValue = effectValues[effectValues.length - 1]
				expect(lastValue).toEqual([4, 8, 12])
			})

			test('handles AbortSignal cancellation', async () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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
				const _awaited = slowCollection.at(0)?.get()

				// Change source to trigger cancellation
				numbers.at(0)?.set(10)

				// Wait for potential abort
				await new Promise(resolve => setTimeout(resolve, 50))

				expect(abortCalled).toBe(true)
			})
		})

		describe('derived collection chaining', () => {
			test('chains multiple sync derivations', () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)
				const octupled = quadrupled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(octupled.at(0)?.get()).toBe(8)
				expect(octupled.at(1)?.get()).toBe(16)
				expect(octupled.at(2)?.get()).toBe(24)
			})

			test('chains sync and async derivations', async () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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
			test('provides index-based access to computed signals', () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
				const quadrupled = doubled.deriveCollection(
					(x: number) => x * 2,
				)

				expect(quadrupled.at(0)?.get()).toBe(4)
				expect(quadrupled.at(1)?.get()).toBe(8)
				expect(quadrupled.at(2)?.get()).toBe(12)
				expect(quadrupled.at(10)).toBeUndefined()
			})

			test('supports key-based access', () => {
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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
				const numbers = new List([1, 2, 3])
				const doubled = new DerivedCollection(
					numbers,
					(x: number) => x * 2,
				)
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

		describe('edge cases', () => {
			test('handles empty collection derivation', () => {
				const empty = new List<number>([])
				const emptyCollection = new DerivedCollection(
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
				const list = new List([1, 2, 3])
				const filtered = new DerivedCollection(list, (x: number) =>
					x > 1 ? { value: x } : UNSET,
				)
				const doubled = filtered.deriveCollection(
					(x: { value: number }) => ({ value: x.value * 2 }),
				)

				expect(doubled.get()).toEqual([{ value: 4 }, { value: 6 }])
			})

			test('handles complex object transformations', () => {
				const items = new List([
					{ id: 1, data: { value: 10, active: true } },
					{ id: 2, data: { value: 20, active: false } },
				])

				const processed = new DerivedCollection(
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

				expect(enhanced.at(0)?.get().itemId).toBe(1)
				expect(enhanced.at(0)?.get().processedValue).toBe(20)
				expect(enhanced.at(0)?.get().status).toBe('active')
				expect(enhanced.at(0)?.get().category).toBe('high')
				expect(enhanced.at(1)?.get().itemId).toBe(2)
				expect(enhanced.at(1)?.get().processedValue).toBe(40)
				expect(enhanced.at(1)?.get().status).toBe('inactive')
				expect(enhanced.at(1)?.get().category).toBe('high')
			})
		})
	})

	describe('Watch Callbacks', () => {
		test('Collection watched callback is called when effect accesses collection.get()', () => {
			const numbers = new List([10, 20, 30])

			let collectionWatchedCalled = false
			let collectionUnwatchCalled = false
			const doubled = numbers.deriveCollection(x => x * 2, {
				watched: () => {
					collectionWatchedCalled = true
				},
				unwatched: () => {
					collectionUnwatchCalled = true
				},
			})

			expect(collectionWatchedCalled).toBe(false)

			// Access collection via collection.get() - this should trigger collection's watched callback
			let effectValue: number[] = []
			const cleanup = createEffect(() => {
				effectValue = doubled.get()
			})

			expect(collectionWatchedCalled).toBe(true)
			expect(effectValue).toEqual([20, 40, 60])
			expect(collectionUnwatchCalled).toBe(false)

			// Cleanup effect - should trigger unwatch
			cleanup()
			expect(collectionUnwatchCalled).toBe(true)
		})

		test('Collection and List watched callbacks work independently', () => {
			let sourceWatchedCalled = false
			const items = new List(['hello', 'world'], {
				watched: () => {
					sourceWatchedCalled = true
				},
			})

			let collectionWatchedCalled = false
			let collectionUnwatchedCalled = false
			const uppercased = items.deriveCollection(x => x.toUpperCase(), {
				watched: () => {
					collectionWatchedCalled = true
				},
				unwatched: () => {
					collectionUnwatchedCalled = true
				},
			})

			// Effect 1: Access collection-level data - triggers both watched callbacks
			let collectionValue: string[] = []
			const collectionCleanup = createEffect(() => {
				collectionValue = uppercased.get()
			})

			expect(collectionWatchedCalled).toBe(true)
			expect(sourceWatchedCalled).toBe(true) // Source items accessed by collection.get()
			expect(collectionValue).toEqual(['HELLO', 'WORLD'])

			// Effect 2: Access individual collection item independently
			let itemValue: string | undefined
			const itemCleanup = createEffect(() => {
				itemValue = uppercased.at(0)?.get()
			})

			expect(itemValue).toBe('HELLO')

			// Clean up effects
			collectionCleanup()
			expect(collectionUnwatchedCalled).toBe(true)

			itemCleanup()
		})

		test('Collection length access triggers Collection watched callback', () => {
			const numbers = new List([1, 2, 3])

			let collectionWatchedCalled = false
			let collectionUnwatchedCalled = false
			const doubled = numbers.deriveCollection(x => x * 2, {
				watched: () => {
					collectionWatchedCalled = true
				},
				unwatched: () => {
					collectionUnwatchedCalled = true
				},
			})

			// Access via collection.length - this should trigger collection's watched callback
			let effectValue: number = 0
			const cleanup = createEffect(() => {
				effectValue = doubled.length
			})

			expect(collectionWatchedCalled).toBe(true)
			expect(effectValue).toBe(3)
			expect(collectionUnwatchedCalled).toBe(false)

			cleanup()
			expect(collectionUnwatchedCalled).toBe(true)
		})
	})
})
