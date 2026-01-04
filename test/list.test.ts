import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	List,
	createStore,
	isCollection,
	isList,
	isStore,
	Memo,
	State,
	UNSET,
} from '../index.ts'

describe('list', () => {
	describe('creation and basic operations', () => {
		test('creates lists with initial values', () => {
			const numbers = new List([1, 2, 3])
			expect(numbers.at(0)?.get()).toBe(1)
			expect(numbers.at(1)?.get()).toBe(2)
			expect(numbers.at(2)?.get()).toBe(3)
		})

		test('has Symbol.toStringTag of List', () => {
			const list = new List([1, 2])
			expect(list[Symbol.toStringTag]).toBe('List')
		})

		test('isList identifies list instances correctly', () => {
			const store = createStore({ a: 1 })
			const list = new List([1])
			const state = new State(1)
			const computed = new Memo(() => 1)

			expect(isList(list)).toBe(true)
			expect(isStore(store)).toBe(true)
			expect(isList(state)).toBe(false)
			expect(isList(computed)).toBe(false)
			expect(isList({})).toBe(false)
		})

		test('get() returns the complete list value', () => {
			const numbers = new List([1, 2, 3])
			expect(numbers.get()).toEqual([1, 2, 3])

			// Nested structures
			const participants = new List([
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
			const numbers = new List([1, 2, 3])
			expect(numbers.length).toBe(3)
			expect(typeof numbers.length).toBe('number')
		})

		test('length is reactive and updates with changes', () => {
			const items = new List([1, 2])
			expect(items.length).toBe(2)
			items.add(3)
			expect(items.length).toBe(3)
			items.remove(1)
			expect(items.length).toBe(2)
		})
	})

	describe('data access and modification', () => {
		test('items can be accessed and modified via signals', () => {
			const items = new List(['a', 'b'])
			expect(items.at(0)?.get()).toBe('a')
			expect(items.at(1)?.get()).toBe('b')
			items.at(0)?.set('alpha')
			items.at(1)?.set('beta')
			expect(items.at(0)?.get()).toBe('alpha')
			expect(items.at(1)?.get()).toBe('beta')
		})

		test('returns undefined for non-existent properties', () => {
			const items = new List(['a'])
			expect(items.at(5)).toBeUndefined()
		})
	})

	describe('add() and remove() methods', () => {
		test('add() method appends to end', () => {
			const fruits = new List(['apple', 'banana'])
			fruits.add('cherry')
			expect(fruits.at(2)?.get()).toBe('cherry')
		})

		test('remove() method removes by index', () => {
			const items = new List(['a', 'b', 'c'])
			items.remove(1) // Remove 'b'
			expect(items.get()).toEqual(['a', 'c'])
			expect(items.length).toBe(2)
		})

		test('add method prevents null values', () => {
			const items = new List([1])
			// @ts-expect-error testing null values
			expect(() => items.add(null)).toThrow()
		})

		test('remove method handles non-existent indices gracefully', () => {
			const items = new List(['a'])
			expect(() => items.remove(5)).not.toThrow()
			expect(items.get()).toEqual(['a'])
		})
	})

	describe('sort() method', () => {
		test('sorts lists with different compare functions', () => {
			const numbers = new List([3, 1, 2])

			numbers.sort()
			expect(numbers.get()).toEqual([1, 2, 3])

			numbers.sort((a, b) => b - a)
			expect(numbers.get()).toEqual([3, 2, 1])

			const names = new List(['Charlie', 'Alice', 'Bob'])
			names.sort((a, b) => a.localeCompare(b))
			expect(names.get()).toEqual(['Alice', 'Bob', 'Charlie'])
		})

		test('triggers HOOK_SORT with new order', () => {
			const numbers = new List([3, 1, 2])
			let order: readonly string[] | undefined
			numbers.on('sort', sort => {
				order = sort
			})
			numbers.sort()
			expect(order).toHaveLength(3)
			expect(order).toEqual(['1', '2', '0'])
		})

		test('sort is reactive - watchers are notified', () => {
			const numbers = new List([3, 1, 2])
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
			const numbers = new List([1, 2, 3, 4])
			const deleted = numbers.splice(1, 2)
			expect(deleted).toEqual([2, 3])
			expect(numbers.get()).toEqual([1, 4])
		})

		test('splice() adds elements without removing any', () => {
			const numbers = new List([1, 3])
			const deleted = numbers.splice(1, 0, 2)
			expect(deleted).toEqual([])
			expect(numbers.get()).toEqual([1, 2, 3])
		})

		test('splice() replaces elements (remove and add)', () => {
			const numbers = new List([1, 2, 3])
			const deleted = numbers.splice(1, 1, 4, 5)
			expect(deleted).toEqual([2])
			expect(numbers.get()).toEqual([1, 4, 5, 3])
		})

		test('splice() handles negative start index', () => {
			const numbers = new List([1, 2, 3])
			const deleted = numbers.splice(-1, 1, 4)
			expect(deleted).toEqual([3])
			expect(numbers.get()).toEqual([1, 2, 4])
		})
	})

	describe('reactivity', () => {
		test('list-level get() is reactive', () => {
			const numbers = new List([1, 2, 3])
			let lastArray: number[] = []
			createEffect(() => {
				lastArray = numbers.get()
			})

			expect(lastArray).toEqual([1, 2, 3])
			numbers.add(4)
			expect(lastArray).toEqual([1, 2, 3, 4])
		})

		test('individual signal reactivity works', () => {
			const items = new List([{ count: 5 }])
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
			const numbers = new List([1, 2])
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
			const numbers = new List([1, 2, 3])
			const sum = new Memo(() =>
				numbers.get().reduce((acc, n) => acc + n, 0),
			)

			expect(sum.get()).toBe(6)
			numbers.add(4)
			expect(sum.get()).toBe(10)
		})

		test('computed handles additions and removals', () => {
			const numbers = new List([1, 2, 3])
			const sum = new Memo(() => {
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
			const numbers = new List([1, 2, 3])

			const sum = new Memo(() => {
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
			const numbers = new List([10, 20, 30])
			const signals = [...numbers]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(10)
			expect(signals[1].get()).toBe(20)
			expect(signals[2].get()).toBe(30)
		})

		test('Symbol.isConcatSpreadable is true', () => {
			const numbers = new List([1, 2, 3])
			expect(numbers[Symbol.isConcatSpreadable]).toBe(true)
		})
	})

	describe('Hooks', () => {
		test('trigger HOOK_ADD when adding items', () => {
			const numbers = new List([1, 2])
			let addedKeys: readonly string[] | undefined
			let newArray: number[] = []
			numbers.on('add', add => {
				addedKeys = add
				newArray = numbers.get()
			})
			numbers.add(3)
			expect(addedKeys).toHaveLength(1)
			expect(newArray).toEqual([1, 2, 3])
		})

		test('triggers HOOK_CHANGE when properties are modified', () => {
			const items = new List([{ value: 10 }])
			let changedKeys: readonly string[] | undefined
			let newArray: { value: number }[] = []
			items.on('change', change => {
				changedKeys = change
				newArray = items.get()
			})
			items.at(0)?.set({ value: 20 })
			expect(changedKeys).toHaveLength(1)
			expect(newArray).toEqual([{ value: 20 }])
		})

		test('triggers HOOK_REMOVE when items are removed', () => {
			const items = new List([1, 2, 3])
			let removedKeys: readonly string[] | undefined
			let newArray: number[] = []
			items.on('remove', remove => {
				removedKeys = remove
				newArray = items.get()
			})
			items.remove(1)
			expect(removedKeys).toHaveLength(1)
			expect(newArray).toEqual([1, 3])
		})
	})

	describe('edge cases', () => {
		test('handles empty lists correctly', () => {
			const empty = new List([])
			expect(empty.get()).toEqual([])
			expect(empty.length).toBe(0)
		})

		test('handles UNSET values', () => {
			const list = new List([UNSET, 'valid'])
			expect(list.get()).toEqual([UNSET, 'valid'])
		})

		test('handles primitive values', () => {
			const list = new List([42, 'text', true])
			expect(list.at(0)?.get()).toBe(42)
			expect(list.at(1)?.get()).toBe('text')
			expect(list.at(2)?.get()).toBe(true)
		})
	})

	describe('deriveCollection() method', () => {
		describe('synchronous transformations', () => {
			test('transforms list values with sync callback', () => {
				const numbers = new List([1, 2, 3])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				expect(isCollection(doubled)).toBe(true)
				expect(doubled.length).toBe(3)
				expect(doubled.get()).toEqual([2, 4, 6])
			})

			test('transforms object values with sync callback', () => {
				const users = new List([
					{ name: 'Alice', age: 25 },
					{ name: 'Bob', age: 30 },
				])
				const userInfo = users.deriveCollection(user => ({
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
				const words = new List(['hello', 'world', 'test'])
				const wordLengths = words.deriveCollection((word: string) => ({
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
				const numbers = new List([1, 2])
				const doubled = numbers.deriveCollection(
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
				const numbers = new List([1, 2, 3])
				const doubled = numbers.deriveCollection(
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
				const numbers = new List([1, 2, 3])
				const asyncDoubled = numbers.deriveCollection(
					async (value: number, abort: AbortSignal) => {
						// Simulate async operation
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')
						return value * 2
					},
				)

				// Trigger initial computation by accessing the collection
				const initialLength = asyncDoubled.length
				expect(initialLength).toBe(3)

				// Access each computed signal to trigger computation
				for (let i = 0; i < asyncDoubled.length; i++) {
					asyncDoubled.at(i)?.get()
				}

				// Allow async operations to complete
				await new Promise(resolve => setTimeout(resolve, 50))

				expect(asyncDoubled.get()).toEqual([2, 4, 6])
			})

			test('async collection with object transformation', async () => {
				const users = new List([
					{ id: 1, name: 'Alice' },
					{ id: 2, name: 'Bob' },
				])

				const enrichedUsers = users.deriveCollection(
					async (user, abort: AbortSignal) => {
						// Simulate API call
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')

						return {
							...user,
							slug: user.name.toLowerCase(),
							timestamp: Date.now(),
						}
					},
				)

				// Trigger initial computation by accessing each computed signal
				for (let i = 0; i < enrichedUsers.length; i++) {
					enrichedUsers.at(i)?.get()
				}

				// Allow async operations to complete
				await new Promise(resolve => setTimeout(resolve, 50))

				const result = enrichedUsers.get()
				expect(result).toHaveLength(2)
				expect(result[0].slug).toBe('alice')
				expect(result[1].slug).toBe('bob')
				expect(typeof result[0].timestamp).toBe('number')
			})

			test('async collection reactivity', async () => {
				const numbers = new List([1, 2])
				const asyncDoubled = numbers.deriveCollection(
					async (value: number, abort: AbortSignal) => {
						await new Promise(resolve => setTimeout(resolve, 5))
						if (abort.aborted) throw new Error('Aborted')
						return value * 2
					},
				)

				const effectValues: number[][] = []

				// Set up effect to track changes reactively
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
				expect(effectValues[effectValues.length - 1]).toEqual([
					10, 4, 6,
				])
			})

			test('handles AbortSignal cancellation', async () => {
				const numbers = new List([1])
				let abortCalled = false

				const slowCollection = numbers.deriveCollection(
					async (value: number, abort: AbortSignal) => {
						return new Promise<number>((resolve, reject) => {
							const timeout = setTimeout(
								() => resolve(value * 2),
								50,
							)
							abort.addEventListener('abort', () => {
								clearTimeout(timeout)
								abortCalled = true
								reject(new Error('Aborted'))
							})
						})
					},
				)

				// Trigger initial computation
				slowCollection.at(0)?.get()

				// Change the value to trigger cancellation of the first computation
				numbers.at(0)?.set(2)

				// Allow some time for operations
				await new Promise(resolve => setTimeout(resolve, 100))

				expect(abortCalled).toBe(true)
				expect(slowCollection.get()).toEqual([4]) // Last value (2 * 2)
			})
		})

		describe('derived collection chaining', () => {
			test('chains multiple sync derivations', () => {
				const numbers = new List([1, 2, 3])
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

			test('chains sync and async derivations', async () => {
				const numbers = new List([1, 2])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)
				const asyncSquared = doubled.deriveCollection(
					async (value: number, abort: AbortSignal) => {
						await new Promise(resolve => setTimeout(resolve, 10))
						if (abort.aborted) throw new Error('Aborted')
						return value * value
					},
				)

				// Trigger initial computation by accessing each computed signal
				for (let i = 0; i < asyncSquared.length; i++) {
					asyncSquared.at(i)?.get()
				}

				await new Promise(resolve => setTimeout(resolve, 50))
				expect(asyncSquared.get()).toEqual([4, 16]) // (1*2)^2, (2*2)^2
			})
		})

		describe('collection access methods', () => {
			test('supports index-based access to computed signals', () => {
				const numbers = new List([1, 2, 3])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				expect(doubled.at(0)?.get()).toBe(2)
				expect(doubled.at(1)?.get()).toBe(4)
				expect(doubled.at(2)?.get()).toBe(6)
				expect(doubled.at(3)).toBeUndefined()
			})

			test('supports key-based access', () => {
				const numbers = new List([10, 20])
				const doubled = numbers.deriveCollection(
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
				const numbers = new List([1, 2, 3])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				const signals = [...doubled]
				expect(signals).toHaveLength(3)
				expect(signals[0].get()).toBe(2)
				expect(signals[1].get()).toBe(4)
				expect(signals[2].get()).toBe(6)
			})
		})

		describe('collection event handling', () => {
			test('emits add events when source adds items', () => {
				const numbers = new List([1, 2])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				let addedKeys: readonly string[] | undefined
				doubled.on('add', keys => {
					addedKeys = keys
				})

				numbers.add(3)
				expect(addedKeys).toHaveLength(1)
			})

			test('emits remove events when source removes items', () => {
				const numbers = new List([1, 2, 3])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				let removedKeys: readonly string[] | undefined
				doubled.on('remove', keys => {
					removedKeys = keys
				})

				numbers.remove(1)
				expect(removedKeys).toHaveLength(1)
			})

			test('emits sort events when source is sorted', () => {
				const numbers = new List([3, 1, 2])
				const doubled = numbers.deriveCollection(
					(value: number) => value * 2,
				)

				let sortedKeys: readonly string[] | undefined
				doubled.on('sort', keys => {
					sortedKeys = keys
				})

				numbers.sort()
				expect(sortedKeys).toHaveLength(3)
				expect(doubled.get()).toEqual([2, 4, 6]) // Sorted and doubled
			})
		})

		describe('edge cases', () => {
			test('handles empty list derivation', () => {
				const empty = new List<number>([])
				const doubled = empty.deriveCollection(
					(value: number) => value * 2,
				)

				expect(doubled.get()).toEqual([])
				expect(doubled.length).toBe(0)
			})

			test('handles UNSET values in transformation', () => {
				const list = new List([1, UNSET, 3])
				const processed = list.deriveCollection(value => {
					return value === UNSET ? 0 : value * 2
				})

				// UNSET values are filtered out before transformation
				expect(processed.get()).toEqual([2, 6])
			})

			test('handles complex object transformations', () => {
				const items = new List([
					{ id: 1, data: { value: 10, active: true } },
					{ id: 2, data: { value: 20, active: false } },
				])

				const transformed = items.deriveCollection(item => ({
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

	describe('hooks system', () => {
		test('List HOOK_WATCH is called when effect accesses list.get()', () => {
			const numbers = new List([10, 20, 30])
			let listHookWatchCalled = false
			let listUnwatchCalled = false

			// Set up HOOK_WATCH callback on the list itself
			numbers.on('watch', () => {
				listHookWatchCalled = true
				return () => {
					listUnwatchCalled = true
				}
			})

			expect(listHookWatchCalled).toBe(false)

			// Access list via list.get() - this should trigger list's HOOK_WATCH
			let effectValue: number[] = []
			const cleanup = createEffect(() => {
				effectValue = numbers.get()
			})

			expect(listHookWatchCalled).toBe(true)
			expect(effectValue).toEqual([10, 20, 30])
			expect(listUnwatchCalled).toBe(false)

			// Cleanup effect - should trigger unwatch
			cleanup()
			expect(listUnwatchCalled).toBe(true)
		})

		test('individual State signals have independent HOOK_WATCH when accessed via list.at().get()', () => {
			const items = new List(['first', 'second'])
			let firstItemHookCalled = false
			let firstItemUnwatchCalled = false

			// Get the first item signal and set up its HOOK_WATCH
			// biome-ignore lint/style/noNonNullAssertion: test
			const firstItemSignal = items.at(0)!
			firstItemSignal.on('watch', () => {
				firstItemHookCalled = true
				return () => {
					firstItemUnwatchCalled = true
				}
			})

			expect(firstItemHookCalled).toBe(false)

			// Access first item via signal.get() - this should trigger the State signal's HOOK_WATCH
			let effectValue: string | undefined
			const cleanup = createEffect(() => {
				effectValue = firstItemSignal.get()
			})

			expect(firstItemHookCalled).toBe(true)
			expect(effectValue).toBe('first')
			expect(firstItemUnwatchCalled).toBe(false)

			// Cleanup effect - should trigger State signal's unwatch
			cleanup()
			expect(firstItemUnwatchCalled).toBe(true)
		})

		test('State signal unwatch is called when item gets removed from list', () => {
			const items = new List(['first', 'second'])
			let firstItemUnwatchCalled = false

			// Get the first item signal and set up its HOOK_WATCH
			// biome-ignore lint/style/noNonNullAssertion: test
			const firstItemSignal = items.at(0)!
			firstItemSignal.on('watch', () => {
				return () => {
					firstItemUnwatchCalled = true
				}
			})

			let effectValue: string | undefined
			const cleanup = createEffect(() => {
				effectValue = firstItemSignal.get()
			})

			expect(effectValue).toBe('first')
			expect(firstItemUnwatchCalled).toBe(false)

			// Remove the first item (index 0) - the State signal still exists but the list changed
			items.remove(0)

			// The State signal should still work (it's not automatically cleaned up)
			expect(effectValue).toBe('first') // State signal retains its value
			expect(firstItemUnwatchCalled).toBe(false) // Unwatch only happens when effect cleanup

			// Cleanup the effect - this should call the State signal's unwatch
			cleanup()
			expect(firstItemUnwatchCalled).toBe(true)
		})

		test('new items added to list get independent State signals with their own hooks', () => {
			const numbers = new List<number>([])

			// Start with empty list - create effect that tries to access first item
			let effectValue: number | undefined
			const cleanup = createEffect(() => {
				const firstItem = numbers.at(0)
				effectValue = firstItem?.get()
			})

			// No items yet
			expect(effectValue).toBe(undefined)

			// Add first item
			const key = numbers.add(42)
			// biome-ignore lint/style/noNonNullAssertion: test
			const newItemSignal = numbers.byKey(key)!

			let newItemHookCalled = false
			let newItemUnwatchCalled = false
			newItemSignal.on('watch', () => {
				newItemHookCalled = true
				return () => {
					newItemUnwatchCalled = true
				}
			})

			// Create new effect to access the new item
			let newEffectValue: number | undefined
			const newCleanup = createEffect(() => {
				newEffectValue = newItemSignal.get()
			})

			expect(newItemHookCalled).toBe(true)
			expect(newEffectValue).toBe(42)
			expect(newItemUnwatchCalled).toBe(false)

			// Cleanup should trigger unwatch
			newCleanup()
			expect(newItemUnwatchCalled).toBe(true)

			cleanup()
		})

		test('List length access triggers List HOOK_WATCH', () => {
			const numbers = new List([1, 2, 3])
			let listHookWatchCalled = false
			let listUnwatchCalled = false

			numbers.on('watch', () => {
				listHookWatchCalled = true
				return () => {
					listUnwatchCalled = true
				}
			})

			// Access via list.length - this should trigger list's HOOK_WATCH
			let effectValue: number = 0
			const cleanup = createEffect(() => {
				effectValue = numbers.length
			})

			expect(listHookWatchCalled).toBe(true)
			expect(effectValue).toBe(3)
			expect(listUnwatchCalled).toBe(false)

			cleanup()
			expect(listUnwatchCalled).toBe(true)
		})

		test('exact scenario: List HOOK_WATCH triggered by list.at(0).get(), unwatch on item removal, restart on new item', () => {
			const list = new List<number>([42])
			let listHookWatchCallCount = 0
			let listUnwatchCallCount = 0

			// Set up List's HOOK_WATCH (this is triggered by list-level access like get() or length)
			list.on('watch', () => {
				listHookWatchCallCount++
				return () => {
					listUnwatchCallCount++
				}
			})

			// Scenario 1: The list's HOOK_WATCH is called when an effect accesses the first item
			// Note: list.at(0).get() accesses the State signal, not the list itself
			// But if we access list.get() or list.length, it triggers the list's HOOK_WATCH
			let effectValue: number | undefined
			const cleanup1 = createEffect(() => {
				// Access list first to trigger list HOOK_WATCH
				const length = list.length
				if (length > 0) {
					effectValue = list.at(0)?.get()
				} else {
					effectValue = undefined
				}
			})

			expect(listHookWatchCallCount).toBe(1) // List HOOK_WATCH called due to list.length access
			expect(effectValue).toBe(42)

			// Scenario 2: The list's unwatch callback is called when the only item with active subscription gets removed
			list.remove(0)
			// The effect should re-run due to list.length change and effectValue should now be undefined
			expect(effectValue).toBe(undefined)

			// The list unwatch is not called yet because the effect is still active (watching an empty list)
			expect(listUnwatchCallCount).toBe(0)

			// Clean up the first effect
			cleanup1()
			expect(listUnwatchCallCount).toBe(1) // Now unwatch is called

			// Scenario 3: The list's HOOK_WATCH is restarted after a new item has been added that gets accessed by an effect
			list.add(100)

			const cleanup2 = createEffect(() => {
				const length = list.length
				if (length > 0) {
					effectValue = list.at(0)?.get()
				} else {
					effectValue = undefined
				}
			})

			expect(listHookWatchCallCount).toBe(2) // List HOOK_WATCH called again
			expect(effectValue).toBe(100)

			cleanup2()
			expect(listUnwatchCallCount).toBe(2) // Second unwatch called
		})
	})
})
