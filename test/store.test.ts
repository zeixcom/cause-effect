import { describe, expect, test } from 'bun:test'
import {
	createComputed,
	createEffect,
	createState,
	createStore,
	isStore,
	type State,
	UNSET,
} from '..'

describe('store', () => {
	describe('creation and basic operations', () => {
		test('creates stores with initial values', () => {
			// Record store
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(user.name.get()).toBe('Hannah')
			expect(user.email.get()).toBe('hannah@example.com')

			// Array store
			const numbers = createStore([1, 2, 3])
			expect(numbers[0].get()).toBe(1)
			expect(numbers[1].get()).toBe(2)
			expect(numbers[2].get()).toBe(3)
		})

		test('has Symbol.toStringTag of Store', () => {
			const recordStore = createStore({ a: 1 })
			const arrayStore = createStore([1, 2])

			expect(recordStore[Symbol.toStringTag]).toBe('Store')
			expect(arrayStore[Symbol.toStringTag]).toBe('Store')
		})

		test('isStore identifies store instances correctly', () => {
			const recordStore = createStore({ a: 1 })
			const arrayStore = createStore([1])
			const state = createState(1)
			const computed = createComputed(() => 1)

			expect(isStore(recordStore)).toBe(true)
			expect(isStore(arrayStore)).toBe(true)
			expect(isStore(state)).toBe(false)
			expect(isStore(computed)).toBe(false)
			expect(isStore({})).toBe(false)
			expect(isStore(null)).toBe(false)
		})

		test('get() returns the complete store value', () => {
			// Record store
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(user.get()).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			// Array store
			const numbers = createStore([1, 2, 3])
			expect(numbers.get()).toEqual([1, 2, 3])

			// Nested structures
			const participants = createStore([
				{ name: 'Alice', tags: ['admin'] },
				{ name: 'Bob', tags: ['user'] },
			])
			expect(participants[0].name.get()).toBe('Alice')
			expect(participants[0].tags.get()).toEqual(['admin'])
			expect(participants[1].name.get()).toBe('Bob')
			expect(participants[1].tags.get()).toEqual(['user'])
		})
	})

	describe('length property and sizing', () => {
		test('length property works for both store types', () => {
			// Record store
			const user = createStore({ name: 'John', age: 25 })
			expect(user.length).toBe(2)
			expect(typeof user.length).toBe('number')

			// Array store
			const numbers = createStore([1, 2, 3])
			expect(numbers.length).toBe(3)
			expect(typeof numbers.length).toBe('number')
		})

		test('length is reactive and updates with changes', () => {
			// Record store
			const user = createStore<{ name: string; age?: number }>({
				name: 'John',
			})
			expect(user.length).toBe(1)
			user.add('age', 25)
			expect(user.length).toBe(2)
			user.remove('age')
			expect(user.length).toBe(1)

			// Array store
			const items = createStore([1, 2])
			expect(items.length).toBe(2)
			items.add(3)
			expect(items.length).toBe(3)
			items.remove(1)
			expect(items.length).toBe(2)
		})
	})

	describe('proxy data access and modification', () => {
		test('properties can be accessed and modified via signals', () => {
			// Record store
			const user = createStore({ name: 'Alice', age: 30 })
			expect(user.name.get()).toBe('Alice')
			expect(user.age.get()).toBe(30)
			user.name.set('Alicia')
			user.age.set(31)
			expect(user.name.get()).toBe('Alicia')
			expect(user.age.get()).toBe(31)

			// Array store
			const items = createStore(['a', 'b'])
			expect(items[0].get()).toBe('a')
			expect(items[1].get()).toBe('b')
			items[0].set('alpha')
			items[1].set('beta')
			expect(items[0].get()).toBe('alpha')
			expect(items[1].get()).toBe('beta')
		})

		test('returns undefined for non-existent properties', () => {
			// Record store
			const user = createStore({ name: 'Alice' })
			// @ts-expect-error accessing non-existent property
			expect(user.nonexistent).toBeUndefined()

			// Array store
			const items = createStore(['a'])
			expect(items[5]).toBeUndefined()
		})

		test('supports numeric key access for both store types', () => {
			// Record store with numeric keys
			const items = createStore({ 0: 'zero', 1: 'one' })
			expect(items[0].get()).toBe('zero')
			expect(items[1].get()).toBe('one')

			// Array store with numeric keys
			const numbers = createStore([10, 20])
			expect(numbers[0].get()).toBe(10)
			expect(numbers[1].get()).toBe(20)
		})
	})

	describe('add() and remove() methods', () => {
		test('add() method behavior differs between store types', () => {
			// Record store - requires key parameter
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			user.add('email', 'john@example.com')
			expect(user.email?.get()).toBe('john@example.com')
			expect(user.length).toBe(2)

			// Array store - single parameter adds to end
			const fruits = createStore(['apple', 'banana'])
			fruits.add('cherry')
			expect(fruits[2].get()).toBe('cherry')
			expect(fruits.length).toBe(3)
			expect(fruits.get()).toEqual(['apple', 'banana', 'cherry'])
		})

		test('remove() method behavior differs between store types', () => {
			// Record store - removes by key
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			user.remove('email')
			expect(user.email).toBeUndefined()
			expect(user.name.get()).toBe('John')
			expect(user.length).toBe(1)

			// Array store - removes by index
			const items = createStore(['a', 'b', 'c'])
			items.remove(1) // Remove 'b'
			expect(items.get()).toEqual(['a', 'c'])
			expect(items.length).toBe(2)
		})

		test('add method prevents null values for both store types', () => {
			// Record store
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			// @ts-expect-error testing null values
			expect(() => user.add('email', null)).toThrow()

			// Array store
			const items = createStore([1])
			// @ts-expect-error testing null values
			expect(() => items.add(null)).toThrow()
		})

		test('add method prevents overwriting existing properties in record stores', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
				email: 'john@example.com',
			})
			const originalSize = user.length
			expect(() => user.add('name', 'Jane')).toThrow()
			expect(user.length).toBe(originalSize)
			expect(user.name.get()).toBe('John')
		})

		test('remove method handles non-existent properties gracefully', () => {
			// Record store
			const user = createStore<{ name: string }>({ name: 'John' })
			const originalSize = user.length
			// @ts-expect-error deliberate removal of non-existent property
			user.remove('nonexistent')
			expect(user.length).toBe(originalSize)

			// Array store - out of bounds throws
			const items = createStore([1, 2])
			expect(() => items.remove(5)).toThrow()
			expect(() => items.remove(-5)).toThrow()
		})
	})

	describe('nested stores', () => {
		test('creates nested stores for object properties in both store types', () => {
			// Record store
			const user = createStore({
				name: 'Alice',
				preferences: {
					theme: 'dark',
					notifications: true,
				},
			})
			expect(isStore(user.preferences)).toBe(true)
			expect(user.preferences.theme.get()).toBe('dark')
			expect(user.preferences.notifications.get()).toBe(true)

			// Array store with nested objects
			const users = createStore([
				{ name: 'Alice', active: true },
				{ name: 'Bob', active: false },
			])
			expect(isStore(users[0])).toBe(true)
			expect(users[0].name.get()).toBe('Alice')
			expect(users[1].active.get()).toBe(false)
		})

		test('nested properties are reactive', () => {
			// Record store
			const user = createStore({
				preferences: {
					theme: 'light',
				},
			})
			let lastTheme = ''
			createEffect(() => {
				lastTheme = user.preferences.theme.get()
			})
			expect(lastTheme).toBe('light')
			user.preferences.theme.set('dark')
			expect(lastTheme).toBe('dark')

			// Array store
			const configs = createStore([{ mode: 'development' }])
			let lastMode = ''
			createEffect(() => {
				lastMode = configs[0].mode.get()
			})
			expect(lastMode).toBe('development')
			configs[0].mode.set('production')
			expect(lastMode).toBe('production')
		})

		test('deeply nested stores work correctly', () => {
			const config = createStore({
				ui: {
					theme: {
						colors: {
							primary: '#blue',
						},
					},
				},
			})
			expect(config.ui.theme.colors.primary.get()).toBe('#blue')
			config.ui.theme.colors.primary.set('#red')
			expect(config.ui.theme.colors.primary.get()).toBe('#red')
		})
	})

	describe('set() and update() methods', () => {
		test('set() replaces entire store value for both store types', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			user.set({ name: 'Jane', email: 'jane@example.com' })
			expect(user.name.get()).toBe('Jane')
			expect(user.email.get()).toBe('jane@example.com')

			// Array store
			const numbers = createStore([1, 2, 3])
			numbers.set([4, 5])
			expect(numbers.get()).toEqual([4, 5])
			expect(numbers.length).toBe(2)
		})

		test('update() modifies store using function for both store types', () => {
			// Record store
			const user = createStore({ name: 'John', age: 25 })
			user.update(u => ({ ...u, age: u.age + 1 }))
			expect(user.name.get()).toBe('John')
			expect(user.age.get()).toBe(26)

			// Array store
			const numbers = createStore([1, 2, 3])
			numbers.update(arr => arr.map(n => n * 2))
			expect(numbers.get()).toEqual([2, 4, 6])
		})
	})

	describe('iteration protocol', () => {
		test('supports for...of iteration with different behaviors', () => {
			// Record store - yields [key, signal] pairs
			const user = createStore({ name: 'John', age: 25 })
			const entries = [...user]
			expect(entries).toHaveLength(2)
			expect(entries[0][0]).toBe('name')
			expect(entries[0][1].get()).toBe('John')
			expect(entries[1][0]).toBe('age')
			expect(entries[1][1].get()).toBe(25)

			// Array store - yields signals only
			const numbers = createStore([10, 20, 30])
			const signals = [...numbers]
			expect(signals).toHaveLength(3)
			expect(signals[0].get()).toBe(10)
			expect(signals[1].get()).toBe(20)
			expect(signals[2].get()).toBe(30)
		})

		test('Symbol.isConcatSpreadable behavior differs between store types', () => {
			// Array store - spreadable
			const numbers = createStore([1, 2, 3])
			expect(numbers[Symbol.isConcatSpreadable]).toBe(true)

			// Record store - not spreadable
			const user = createStore({ name: 'John', age: 25 })
			expect(user[Symbol.isConcatSpreadable]).toBe(false)
		})

		test('array stores maintain numeric key ordering', () => {
			const items = createStore(['first', 'second', 'third'])
			const keys = Object.keys(items).filter(
				k => !Number.isNaN(Number(k)),
			)
			expect(keys).toEqual(['0', '1', '2'])

			const signals = [...items]
			expect(signals.map(s => s.get())).toEqual([
				'first',
				'second',
				'third',
			])
		})
	})

	describe('change tracking and notifications', () => {
		test('emits add notifications for both store types', () => {
			// Record store - initial creation
			let addNotification: Record<string, unknown>
			const user = createStore({ name: 'John' })
			user.on('add', change => {
				addNotification = change
			})

			// Wait for initial add event
			setTimeout(() => {
				expect(addNotification.name).toBe('John')
			}, 0)

			// Record store - new property
			const userWithEmail = createStore<{ name: string; email?: string }>(
				{ name: 'John' },
			)
			let newAddNotification: Record<string, unknown> = {}
			userWithEmail.on('add', change => {
				newAddNotification = change
			})
			userWithEmail.add('email', 'john@example.com')
			expect(newAddNotification.email).toBe('john@example.com')

			// Array store
			const numbers = createStore([1, 2])
			let arrayAddNotification = {}
			numbers.on('add', change => {
				arrayAddNotification = change
			})
			numbers.add(3)
			expect(arrayAddNotification[2]).toBe(3)
		})

		test('emits change notifications when properties are modified', () => {
			// Record store
			const user = createStore({ name: 'John' })
			let changeNotification: Record<string, unknown> = {}
			user.on('change', change => {
				changeNotification = change
			})
			user.name.set('Jane')
			expect(changeNotification.name).toBe('Jane')

			// Array store
			const items = createStore(['a', 'b'])
			let arrayChangeNotification = {}
			items.on('change', change => {
				arrayChangeNotification = change
			})
			items[0].set('alpha')
			expect(arrayChangeNotification[0]).toBe('alpha')
		})

		test('emits change notifications for nested property changes', () => {
			// Record store
			const user = createStore({
				name: 'John',
				preferences: {
					theme: 'light',
					notifications: true,
				},
			})
			let changeNotification: Record<string, unknown> = {}
			user.on('change', change => {
				changeNotification = change
			})
			user.preferences.theme.set('dark')
			expect(changeNotification.preferences).toEqual({
				theme: 'dark',
				notifications: true,
			})

			// Array store with nested objects
			const users = createStore([{ name: 'Alice', role: 'admin' }])
			let arrayChangeNotification: Record<number, unknown> = []
			users.on('change', change => {
				arrayChangeNotification = change
			})
			users[0].name.set('Alicia')
			expect(arrayChangeNotification[0]).toEqual({
				name: 'Alicia',
				role: 'admin',
			})
		})

		test('emits remove notifications when properties are removed', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let removeNotification: Record<string, unknown> = {}
			user.on('remove', change => {
				removeNotification = change
			})
			user.remove('email')
			expect(removeNotification.email).toBe(UNSET)

			// Array store
			const items = createStore(['a', 'b', 'c'])
			let arrayRemoveNotification: Record<number, unknown> = []
			items.on('remove', change => {
				arrayRemoveNotification = change
			})
			items.remove(1)
			expect(arrayRemoveNotification[2]).toBe(UNSET) // Last item gets removed in compaction
		})

		test('set() correctly handles mixed changes, additions, and removals', () => {
			const user = createStore<{
				name: string
				email?: string
				preferences?: {
					theme: string
					notifications?: boolean
				}
				age?: number
			}>({
				name: 'Hannah',
				email: 'hannah@example.com',
				preferences: {
					theme: 'light', // will change
				},
			})

			let changeNotification: Record<string, unknown> | undefined
			let addNotification: Record<string, unknown> | undefined
			let removeNotification: Record<string, unknown> | undefined
			user.on('change', change => {
				changeNotification = change
			})
			user.on('add', change => {
				addNotification = change
			})
			user.on('remove', change => {
				removeNotification = change
			})

			user.set({
				name: 'Jane', // changed
				preferences: {
					theme: 'dark', // changed
				},
				age: 30, // added
			} as { name: string; preferences: { theme: string }; age: number })

			expect(changeNotification?.preferences).toEqual({ theme: 'dark' })
			expect(addNotification?.age).toBe(30)
			expect(removeNotification?.email).toBe(UNSET)
		})

		test('notification listeners can be removed', () => {
			const user = createStore({ name: 'John' })
			let notificationCount = 0
			const listener = () => {
				notificationCount++
			}
			const off = user.on('change', listener)
			user.name.set('Jane')
			expect(notificationCount).toBe(1)
			off()
			user.name.set('Jack')
			expect(notificationCount).toBe(1) // Should not increment
		})
	})

	describe('reactivity', () => {
		test('store-level get() is reactive for both store types', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let lastValue = { name: '', email: '' }
			createEffect(() => {
				lastValue = user.get()
			})
			expect(lastValue).toEqual({
				name: 'John',
				email: 'john@example.com',
			})
			user.name.set('Jane')
			expect(lastValue.name).toBe('Jane')
			expect(lastValue.email).toBe('john@example.com')

			// Array store
			const numbers = createStore([1, 2, 3])
			let lastArray: number[] = []
			createEffect(() => {
				lastArray = numbers.get()
			})
			expect(lastArray).toEqual([1, 2, 3])
			numbers[0].set(10)
			expect(lastArray).toEqual([10, 2, 3])
		})

		test('individual signal reactivity works for both store types', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let lastName = ''
			let nameEffectRuns = 0
			createEffect(() => {
				nameEffectRuns++
				lastName = user.name.get()
			})
			expect(lastName).toBe('John')
			expect(nameEffectRuns).toBe(1)
			user.name.set('Jane')
			expect(lastName).toBe('Jane')
			expect(nameEffectRuns).toBe(2)
			// Changing email should not trigger name effect
			user.email.set('jane@example.com')
			expect(nameEffectRuns).toBe(2)

			// Array store
			const items = createStore(['a', 'b'])
			let lastItem = ''
			let itemEffectRuns = 0
			createEffect(() => {
				itemEffectRuns++
				lastItem = items[0].get()
			})
			expect(lastItem).toBe('a')
			expect(itemEffectRuns).toBe(1)
			items[0].set('alpha')
			expect(lastItem).toBe('alpha')
			expect(itemEffectRuns).toBe(2)
			// Changing other item should not trigger effect
			items[1].set('beta')
			expect(itemEffectRuns).toBe(2)
		})

		test('nested store changes propagate to parent', () => {
			const user = createStore({
				preferences: {
					theme: 'light',
				},
			})
			let effectRuns = 0
			createEffect(() => {
				effectRuns++
				user.get() // Subscribe to entire store
			})
			expect(effectRuns).toBe(1)
			user.preferences.theme.set('dark')
			expect(effectRuns).toBe(2)
		})

		test('updates are reactive for both store types', () => {
			// Record store
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			let lastValue: Record<string, unknown> = {}
			let effectRuns = 0
			createEffect(() => {
				effectRuns++
				lastValue = user.get()
			})
			expect(effectRuns).toBe(1)
			user.update(u => ({ ...u, email: 'john@example.com' }))
			expect(effectRuns).toBe(2)
			expect(lastValue.name).toBe('John')
			expect(lastValue.email).toBe('john@example.com')

			// Array store
			const numbers = createStore([1, 2])
			let lastArray: number[] = []
			let arrayEffectRuns = 0
			createEffect(() => {
				arrayEffectRuns++
				lastArray = numbers.get()
			})
			expect(arrayEffectRuns).toBe(1)
			numbers.update(arr => [...arr, 3])
			expect(arrayEffectRuns).toBe(2)
			expect(lastArray).toEqual([1, 2, 3])
		})

		test('remove method is reactive for both store types', () => {
			// Record store
			const user = createStore<{
				name: string
				email?: string
			}>({
				name: 'John',
				email: 'john@example.com',
			})
			let lastValue: Record<string, unknown> = {}
			let effectRuns = 0
			createEffect(() => {
				effectRuns++
				lastValue = user.get()
			})
			expect(effectRuns).toBe(1)
			user.remove('email')
			expect(effectRuns).toBe(2)
			expect(lastValue.name).toBe('John')
			expect(lastValue.email).toBeUndefined()

			// Array store
			const items = createStore(['a', 'b', 'c'])
			let lastArray: string[] = []
			let arrayEffectRuns = 0
			createEffect(() => {
				arrayEffectRuns++
				lastArray = items.get()
			})
			expect(arrayEffectRuns).toBe(1)
			items.remove(1)
			// Array removal causes multiple reactivity updates due to compaction
			expect(arrayEffectRuns).toBeGreaterThanOrEqual(2)
			expect(lastArray).toEqual(['a', 'c'])
		})
	})

	describe('computed integration', () => {
		test('works with computed signals for both store types', () => {
			// Record store
			const user = createStore({ firstName: 'John', lastName: 'Doe' })
			const fullName = createComputed(() => {
				return `${user.firstName.get()} ${user.lastName.get()}`
			})
			expect(fullName.get()).toBe('John Doe')
			user.firstName.set('Jane')
			expect(fullName.get()).toBe('Jane Doe')

			// Array store
			const numbers = createStore([1, 2, 3])
			const sum = createComputed(() => {
				return numbers.get().reduce((acc, n) => acc + n, 0)
			})
			expect(sum.get()).toBe(6)
			numbers[0].set(10)
			expect(sum.get()).toBe(15)
		})

		test('computed reacts to nested store changes', () => {
			const config = createStore({
				ui: {
					theme: 'light',
				},
			})
			const themeDisplay = createComputed(() => {
				return `Theme: ${config.ui.theme.get()}`
			})
			expect(themeDisplay.get()).toBe('Theme: light')
			config.ui.theme.set('dark')
			expect(themeDisplay.get()).toBe('Theme: dark')
		})

		test('computed with array stores handles additions and removals', () => {
			const numbers = createStore([1, 2, 3])
			const sum = createComputed(() => {
				const array = numbers.get()
				return array.reduce((acc, n) => acc + n, 0)
			})

			expect(sum.get()).toBe(6)

			// Add a number
			numbers.add(4)
			expect(sum.get()).toBe(10)

			// Remove a number
			numbers.remove(0)
			const finalArray = numbers.get()
			expect(finalArray).toEqual([2, 3, 4])
			expect(sum.get()).toBe(9)
		})

		test('computed sum using store iteration with length tracking', () => {
			const numbers = createStore([1, 2, 3])

			const sum = createComputed(() => {
				// Access length to ensure reactivity
				const _length = numbers.length
				let total = 0
				for (const signal of numbers) {
					total += signal.get()
				}
				return total
			})

			expect(sum.get()).toBe(6)

			// Add item
			numbers.add(4)
			expect(sum.get()).toBe(10)

			// Remove item
			numbers.remove(1)
			expect(sum.get()).toBe(8) // 1 + 3 + 4 (middle item removed)
		})
	})

	describe('sort() method', () => {
		test('sorts array stores with different compare functions', () => {
			// Numeric sort
			const numbers = createStore([3, 1, 4, 1, 5])
			const _oldSignals = [
				numbers[0],
				numbers[1],
				numbers[2],
				numbers[3],
				numbers[4],
			]

			numbers.sort((a, b) => a - b)
			expect(numbers.get()).toEqual([1, 1, 3, 4, 5])

			// Verify signals moved correctly
			expect(numbers[0]).toBe(_oldSignals[1]) // First '1'
			expect(numbers[1]).toBe(_oldSignals[3]) // Second '1'
			expect(numbers[2]).toBe(_oldSignals[0]) // '3'

			// String sort
			const names = createStore(['Charlie', 'Alice', 'Bob'])
			names.sort()
			expect(names.get()).toEqual(['Alice', 'Bob', 'Charlie'])
		})

		test('sorts record stores by value', () => {
			const users = createStore({
				user1: { name: 'Charlie', age: 25 },
				user2: { name: 'Alice', age: 30 },
				user3: { name: 'Bob', age: 35 },
			})

			const _oldSignals = {
				user1: users.user1,
				user2: users.user2,
				user3: users.user3,
			}

			users.sort((a, b) => a.name.localeCompare(b.name))

			// After sorting by name: Alice, Bob, Charlie
			// The keys should be reordered based on the sort
			const sortedEntries = [...users]
			expect(sortedEntries[0][1].name.get()).toBe('Alice')
			expect(sortedEntries[1][1].name.get()).toBe('Bob')
			expect(sortedEntries[2][1].name.get()).toBe('Charlie')
		})

		test('emits sort notification with new order', () => {
			const numbers = createStore([3, 1, 2])
			let sortNotification: string[] = []
			numbers.on('sort', change => {
				sortNotification = change
			})

			numbers.sort((a, b) => a - b)
			expect(sortNotification).toEqual(['1', '2', '0']) // Original indices in new order
		})

		test('sort is reactive - watchers are notified', () => {
			const numbers = createStore([3, 1, 2])
			let effectCount = 0
			let lastValue: number[] = []

			createEffect(() => {
				effectCount++
				lastValue = numbers.get()
			})

			expect(effectCount).toBe(1)
			expect(lastValue).toEqual([3, 1, 2])

			numbers.sort((a, b) => a - b)
			expect(effectCount).toBe(2)
			expect(lastValue).toEqual([1, 2, 3])
		})

		test('nested signals remain reactive after sorting', () => {
			const items = createStore([
				{ name: 'Charlie', score: 85 },
				{ name: 'Alice', score: 95 },
				{ name: 'Bob', score: 75 },
			])

			items.sort((a, b) => a.score - b.score)

			// Verify order: Bob(75), Charlie(85), Alice(95)
			expect(items[0].name.get()).toBe('Bob')
			expect(items[1].name.get()).toBe('Charlie')
			expect(items[2].name.get()).toBe('Alice')

			// Verify signals are still reactive
			items[0].score.set(100)
			expect(items[0].score.get()).toBe(100)
		})

		test('default sort handles numbers as strings like Array.prototype.sort()', () => {
			const numbers = createStore([10, 2, 1])
			numbers.sort()
			expect(numbers.get()).toEqual([1, 10, 2]) // String comparison: "1" < "10" < "2"
		})

		test('multiple sorts work correctly', () => {
			const numbers = createStore([3, 1, 2])
			numbers.sort((a, b) => a - b) // [1, 2, 3]
			numbers.sort((a, b) => b - a) // [3, 2, 1]
			expect(numbers.get()).toEqual([3, 2, 1])
		})
	})

	describe('proxy behavior and enumeration', () => {
		test('Object.keys returns property keys for both store types', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			const userKeys = Object.keys(user)
			expect(userKeys.sort()).toEqual(['email', 'name'])

			// Array store
			const numbers = createStore([1, 2, 3])
			const numberKeys = Object.keys(numbers).filter(
				k => !Number.isNaN(Number(k)),
			)
			expect(numberKeys).toEqual(['0', '1', '2'])
		})

		test('property enumeration works for both store types', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			const userKeys: string[] = []
			for (const key in user) {
				userKeys.push(key)
			}
			expect(userKeys.sort()).toEqual(['email', 'name'])

			// Array store
			const numbers = createStore([10, 20])
			const numberKeys: string[] = []
			for (const key in numbers) {
				if (!Number.isNaN(Number(key))) numberKeys.push(key)
			}
			expect(numberKeys).toEqual(['0', '1'])
		})

		test('in operator works for both store types', () => {
			// Record store
			const user = createStore({ name: 'John' })
			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
			expect('length' in user).toBe(true)

			// Array store
			const numbers = createStore([1, 2])
			expect(0 in numbers).toBe(true)
			expect(2 in numbers).toBe(false)
			expect('length' in numbers).toBe(true)
		})

		test('Object.getOwnPropertyDescriptor works for both store types', () => {
			// Record store
			const user = createStore({ name: 'John' })
			const nameDescriptor = Object.getOwnPropertyDescriptor(user, 'name')
			expect(nameDescriptor).toEqual({
				enumerable: true,
				configurable: true,
				writable: true,
				value: user.name,
			})

			const lengthDescriptor = Object.getOwnPropertyDescriptor(
				user,
				'length',
			)
			expect(lengthDescriptor?.enumerable).toBe(false)
			expect(lengthDescriptor?.configurable).toBe(true)

			// Array store
			const numbers = createStore([1, 2])
			const indexDescriptor = Object.getOwnPropertyDescriptor(
				numbers,
				'0',
			)
			expect(indexDescriptor).toEqual({
				enumerable: true,
				configurable: true,
				writable: true,
				value: numbers[0],
			})

			const arrayLengthDescriptor = Object.getOwnPropertyDescriptor(
				numbers,
				'length',
			)
			expect(arrayLengthDescriptor?.enumerable).toBe(true) // Array stores show length as enumerable
			expect(arrayLengthDescriptor?.configurable).toBe(true)
		})
	})

	describe('spread operator behavior', () => {
		test('spreading stores works differently for each type', () => {
			// Record store - spreads individual signals
			const user = createStore({ name: 'John', age: 25 })
			const userSpread = { ...user }
			expect('name' in userSpread).toBe(true)
			expect('age' in userSpread).toBe(true)
			expect(typeof userSpread.name?.get).toBe('function')
			expect(userSpread.name?.get()).toBe('John')

			// Array store - spreads signals (not [key, value] pairs)
			const numbers = createStore([1, 2, 3])
			const numberSpread = [...numbers]
			expect(numberSpread).toHaveLength(3)
			expect(typeof numberSpread[0].get).toBe('function')
			expect(numberSpread[0].get()).toBe(1)
		})

		test('concat works correctly with array stores', () => {
			const numbers = createStore([2, 3])
			const prefix = [createState(1)]
			const suffix = [createState(4)]

			const combined = prefix.concat(
				numbers as unknown as ConcatArray<State<number>>,
				suffix,
			)

			expect(combined).toHaveLength(4)
			expect(combined[0].get()).toBe(1)
			expect(combined[1].get()).toBe(2) // from store
			expect(combined[2].get()).toBe(3) // from store
			expect(combined[3].get()).toBe(4)
		})
	})

	describe('UNSET and edge cases', () => {
		test('handles UNSET values for both store types', () => {
			// Record store
			const recordData = createStore({ value: UNSET as string })
			expect(recordData.value.get()).toBe(UNSET)
			recordData.value.set('some string')
			expect(recordData.value.get()).toBe('some string')

			// Array store
			const arrayData = createStore([UNSET as string])
			expect(arrayData[0].get()).toBe(UNSET)
			arrayData[0].set('some value')
			expect(arrayData[0].get()).toBe('some value')
		})

		test('handles primitive values in both store types', () => {
			// Record store
			const recordData = createStore({
				str: 'hello',
				num: 42,
				bool: true,
			})
			expect(recordData.str.get()).toBe('hello')
			expect(recordData.num.get()).toBe(42)
			expect(recordData.bool.get()).toBe(true)

			// Array store
			const arrayData = createStore(['hello', 42, true])
			expect(arrayData[0].get()).toBe('hello')
			expect(arrayData[1].get()).toBe(42)
			expect(arrayData[2].get()).toBe(true)
		})

		test('handles empty stores correctly', () => {
			// Empty record store
			const emptyRecord = createStore({})
			expect(emptyRecord.length).toBe(0)
			expect(emptyRecord[Symbol.isConcatSpreadable]).toBe(false)
			expect([...emptyRecord]).toEqual([])

			// Empty array store
			const emptyArray = createStore([])
			expect(emptyArray.length).toBe(0)
			expect(emptyArray[Symbol.isConcatSpreadable]).toBe(true)
			expect([...emptyArray]).toEqual([])
		})
	})

	describe('JSON integration and serialization', () => {
		test('seamless JSON integration for both store types', () => {
			// Record store from JSON
			const jsonData = {
				user: { name: 'John', preferences: { theme: 'dark' } },
				settings: { timeout: 5000 },
			}
			const recordStore = createStore(jsonData)
			expect(recordStore.user.name.get()).toBe('John')
			expect(recordStore.user.preferences.theme.get()).toBe('dark')

			// Modify and serialize back
			recordStore.user.name.set('Jane')
			recordStore.settings.timeout.set(10000)
			const serialized = JSON.stringify(recordStore.get())
			const parsed = JSON.parse(serialized)
			expect(parsed.user.name).toBe('Jane')
			expect(parsed.settings.timeout).toBe(10000)

			// Array store from JSON
			const arrayData = [
				{ id: 1, name: 'Item 1' },
				{ id: 2, name: 'Item 2' },
			]
			const arrayStore = createStore(arrayData)
			expect(arrayStore[0].name.get()).toBe('Item 1')

			// Modify and serialize
			arrayStore[0].name.set('Updated Item')
			const arraySerialized = JSON.stringify(arrayStore.get())
			const arrayParsed = JSON.parse(arraySerialized)
			expect(arrayParsed[0].name).toBe('Updated Item')
		})

		test('handles complex nested structures from JSON', () => {
			type Dashboard = {
				dashboard: {
					widgets: Array<{
						id: number
						type: string
						config: {
							color?: string
							rows?: number
						}
					}>
				}
			}
			const complexData = {
				dashboard: {
					widgets: [
						{ id: 1, type: 'chart', config: { color: 'blue' } },
						{ id: 2, type: 'table', config: { rows: 10 } },
					],
				},
			}

			const store = createStore<Dashboard>(complexData)
			expect(store.dashboard.widgets[0].type.get()).toBe('chart')
			expect(store.dashboard.widgets[1].config.rows?.get()).toBe(10)

			// Update nested array element
			store.dashboard.widgets[0].config.color?.set('red')
			expect(store.get().dashboard.widgets[0].config.color).toBe('red')
		})
	})

	describe('type conversion and nested stores', () => {
		test('arrays are converted to stores when nested', () => {
			const data = createStore({ items: [1, 2, 3] })
			expect(isStore(data.items)).toBe(true)
			expect(data.items[0].get()).toBe(1)
			expect(data.items[1].get()).toBe(2)
			expect(data.items[2].get()).toBe(3)
		})

		test('nested objects become nested stores', () => {
			const config = createStore({
				database: {
					host: 'localhost',
					port: 5432,
				},
			})
			expect(isStore(config.database)).toBe(true)
			expect(config.database.host.get()).toBe('localhost')
			expect(config.database.port.get()).toBe(5432)
		})

		test('array store with nested objects has correct type inference', () => {
			const users = createStore([
				{ name: 'Alice', active: true },
				{ name: 'Bob', active: false },
			])

			// Object array elements should be Store<T>
			expect(isStore(users[0])).toBe(true)
			expect(isStore(users[1])).toBe(true)

			// Should be able to access nested properties
			expect(users[0].name.get()).toBe('Alice')
			expect(users[0].active.get()).toBe(true)
			expect(users[1].name.get()).toBe('Bob')
			expect(users[1].active.get()).toBe(false)

			// Should be able to modify nested properties
			users[0].name.set('Alicia')
			users[0].active.set(false)
			expect(users[0].name.get()).toBe('Alicia')
			expect(users[0].active.get()).toBe(false)
		})
	})

	describe('advanced array behaviors', () => {
		test('array compaction with remove operations', () => {
			const numbers = createStore([10, 20, 30, 40, 50])

			// Create computed to test both iteration and get() approaches
			const sumWithGet = createComputed(() => {
				const array = numbers.get()
				return array.reduce((acc, num) => acc + num, 0)
			})

			expect(sumWithGet.get()).toBe(150) // 10+20+30+40+50

			// Remove middle element - should compact the array
			numbers.remove(2) // Remove 30
			expect(numbers.length).toBe(4)
			expect(numbers.get()).toEqual([10, 20, 40, 50])
			expect(sumWithGet.get()).toBe(120) // 10+20+40+50

			// Remove first element
			numbers.remove(0) // Remove 10
			expect(numbers.length).toBe(3)
			expect(numbers.get()).toEqual([20, 40, 50])
			expect(sumWithGet.get()).toBe(110) // 20+40+50
		})

		test('sparse array replacement works correctly', () => {
			const numbers = createStore([10, 20, 30])

			// Remove middle element to create sparse structure internally
			numbers.remove(1) // Remove 20, now [10, 30] with internal keys ["0", "2"]

			expect(numbers.get()).toEqual([10, 30])
			expect(numbers.length).toBe(2)

			// Set new array of same length - should work correctly
			numbers.set([100, 200])
			expect(numbers.get()).toEqual([100, 200])
			expect(numbers.length).toBe(2)
			expect(numbers[0].get()).toBe(100)
			expect(numbers[1].get()).toBe(200)
		})
	})

	describe('polymorphic behavior determined at creation', () => {
		test('store type is determined at creation time and maintained', () => {
			// Array store stays array-like
			const arrayStore = createStore([1, 2])
			expect(arrayStore[Symbol.isConcatSpreadable]).toBe(true)
			expect(arrayStore.length).toBe(2)

			// Even after modifications, stays array-like
			arrayStore.add(3)
			expect(arrayStore[Symbol.isConcatSpreadable]).toBe(true)
			expect(arrayStore.length).toBe(3)

			// Record store stays record-like
			const recordStore = createStore<{
				a: number
				b: number
				c?: number
			}>({ a: 1, b: 2 })
			expect(recordStore[Symbol.isConcatSpreadable]).toBe(false)
			expect(recordStore.length).toBe(2)

			// Even after modifications, stays record-like
			recordStore.add('c', 3)
			expect(recordStore[Symbol.isConcatSpreadable]).toBe(false)
			expect(recordStore.length).toBe(3)
		})

		test('empty stores maintain their type characteristics', () => {
			const emptyArray = createStore<string[]>([])
			const emptyRecord = createStore<{ key?: string }>({})

			// Empty array behaves like array
			expect(emptyArray[Symbol.isConcatSpreadable]).toBe(true)
			expect(emptyArray.length).toBe(0)

			// Empty record behaves like record
			expect(emptyRecord[Symbol.isConcatSpreadable]).toBe(false)
			expect(emptyRecord.length).toBe(0)

			// After adding items, they maintain their characteristics
			emptyArray.add('first')
			emptyRecord.add('key', 'value')

			expect(emptyArray[Symbol.isConcatSpreadable]).toBe(true)
			expect(emptyRecord[Symbol.isConcatSpreadable]).toBe(false)
		})
	})

	describe('cross-component communication pattern', () => {
		test('event bus with UNSET initialization - type-safe pattern', () => {
			type EventBusSchema = {
				userLogin: { userId: number; timestamp: number }
				userLogout: { userId: number }
				userUpdate: { userId: number; profile: { name: string } }
			}

			const eventBus = createStore<EventBusSchema>({
				userLogin: UNSET,
				userLogout: UNSET,
				userUpdate: UNSET,
			})

			const on = (
				event: keyof EventBusSchema,
				callback: (data: EventBusSchema[keyof EventBusSchema]) => void,
			) =>
				createEffect(() => {
					const data = eventBus[event].get()
					if (data !== UNSET) callback(data)
				})

			let receivedLogin: unknown = null
			let receivedLogout: unknown = null
			let receivedUpdate: unknown = null

			on('userLogin', data => {
				receivedLogin = data
			})
			on('userLogout', data => {
				receivedLogout = data
			})
			on('userUpdate', data => {
				receivedUpdate = data
			})

			// Initially nothing received
			expect(receivedLogin).toBe(null)
			expect(receivedLogout).toBe(null)
			expect(receivedUpdate).toBe(null)

			// Emit events
			const loginData: EventBusSchema['userLogin'] = {
				userId: 123,
				timestamp: Date.now(),
			}
			eventBus.userLogin.set(loginData)

			expect(receivedLogin).toEqual(loginData)
			expect(receivedLogout).toBe(null)
			expect(receivedUpdate).toBe(null)

			const logoutData: EventBusSchema['userLogout'] = { userId: 123 }
			eventBus.userLogout.set(logoutData)

			expect(receivedLogout).toEqual(logoutData)
			expect(receivedLogin).toEqual(loginData) // unchanged

			const updateData: EventBusSchema['userUpdate'] = {
				userId: 456,
				profile: { name: 'Alice' },
			}
			eventBus.userUpdate.set(updateData)

			expect(receivedUpdate).toEqual(updateData)
			expect(receivedLogin).toEqual(loginData) // unchanged
			expect(receivedLogout).toEqual(logoutData) // unchanged
		})
	})
})
