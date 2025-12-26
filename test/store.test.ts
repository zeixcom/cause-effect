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
			let addNotification: readonly string[]
			const user = createStore({ name: 'John' })
			user.on('add', change => {
				addNotification = change
			})

			// Wait for initial add event
			setTimeout(() => {
				expect(addNotification).toContain('name')
			}, 0)

			// Record store - new property
			const userWithEmail = createStore<{ name: string; email?: string }>(
				{ name: 'John' },
			)
			let newAddNotification: readonly string[] = []
			userWithEmail.on('add', change => {
				newAddNotification = change
			})
			userWithEmail.add('email', 'john@example.com')
			expect(newAddNotification).toContain('email')

			// Array store
			const numbers = createStore([1, 2])
			let arrayAddNotification: readonly string[] = []
			numbers.on('add', change => {
				arrayAddNotification = change
			})
			numbers.add(3)
			expect(arrayAddNotification).toHaveLength(1)
			// The exact key will be a generated stable key, we just verify one key was added
		})

		test('emits change notifications when properties are modified', () => {
			// Record store
			const user = createStore({ name: 'John' })
			let changeNotification: readonly string[] = []
			user.on('change', change => {
				changeNotification = change
			})
			user.name.set('Jane')
			expect(changeNotification).toContain('name')

			// Array store
			const items = createStore(['a', 'b'])
			let arrayChangeNotification: readonly string[] = []
			items.on('change', change => {
				arrayChangeNotification = change
			})
			items[0].set('alpha')
			expect(arrayChangeNotification).toHaveLength(1)
			// The exact key will be a generated stable key for index 0
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
			let changeNotification: readonly string[] = []
			user.on('change', change => {
				changeNotification = change
			})
			user.preferences.theme.set('dark')
			expect(changeNotification).toContain('preferences')

			// Array store with nested objects
			const users = createStore([{ name: 'Alice', role: 'admin' }])
			let arrayChangeNotification: readonly string[] = []
			users.on('change', change => {
				arrayChangeNotification = change
			})
			users[0].name.set('Alicia')
			expect(arrayChangeNotification).toHaveLength(1)
			// The exact key will be a generated stable key for index 0
		})

		test('emits remove notifications when properties are removed', () => {
			// Record store
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let removeNotification: readonly string[] = []
			user.on('remove', change => {
				removeNotification = change
			})
			user.remove('email')
			expect(removeNotification).toContain('email')

			// Array store
			const items = createStore(['a', 'b', 'c'])
			let arrayRemoveNotification: readonly string[] = []
			items.on('remove', change => {
				arrayRemoveNotification = change
			})
			items.remove(1)
			expect(arrayRemoveNotification).toHaveLength(1)
			// The exact key will be a generated stable key for index 1
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

			let changeNotification: readonly string[] | undefined
			let addNotification: readonly string[] | undefined
			let removeNotification: readonly string[] | undefined
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

			expect(changeNotification).toContain('preferences')
			expect(addNotification).toContain('age')
			expect(removeNotification).toContain('email')
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
				sortNotification = [...change]
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
			expect(lengthDescriptor?.configurable).toBe(false)

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
			expect(arrayLengthDescriptor?.enumerable).toBe(false)
			expect(arrayLengthDescriptor?.configurable).toBe(false)
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
			expect(store.dashboard.widgets[0].config.color?.get()).toBe('red')
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

	describe('byKey() method', () => {
		test('works with record stores using property keys', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
				age: 30,
			})

			// Access signals by key
			const nameSignal = user.byKey('name')
			const emailSignal = user.byKey('email')
			const ageSignal = user.byKey('age')
			// @ts-expect-error deliberate check for invalid key
			const nonexistentSignal = user.byKey('nonexistent')

			expect(nameSignal?.get()).toBe('Alice')
			expect(emailSignal?.get()).toBe('alice@example.com')
			expect(ageSignal?.get()).toBe(30)
			expect(nonexistentSignal).toBeUndefined()

			// Verify these are the same signals as property access
			expect(nameSignal).toBe(user.name)
			expect(emailSignal).toBe(user.email)
			expect(ageSignal).toBe(user.age)
		})

		test('works with array stores using stable keys', () => {
			const numbers = createStore([10, 20, 30])

			// Get the stable keys from internal mappings by checking signal access
			const signal0 = numbers[0]
			const signal1 = numbers[1]
			const signal2 = numbers[2]

			// Find stable keys by checking which keys return these signals
			let key0: string | undefined
			let key1: string | undefined
			let key2: string | undefined

			// Since stable keys are auto-generated as "0", "1", "2" by default
			for (let i = 0; i < 10; i++) {
				const key = String(i)
				if (numbers.byKey(key) === signal0) key0 = key
				if (numbers.byKey(key) === signal1) key1 = key
				if (numbers.byKey(key) === signal2) key2 = key
			}

			expect(key0).toBeDefined()
			expect(key1).toBeDefined()
			expect(key2).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.byKey(key0!)).toBe(signal0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.byKey(key1!)).toBe(signal1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.byKey(key2!)).toBe(signal2)
			expect(numbers.byKey('nonexistent')).toBeUndefined()
		})

		test('works with array stores using custom string prefix keys', () => {
			const items = createStore(['apple', 'banana', 'cherry'], 'fruit')

			// Custom keys should be "fruit0", "fruit1", "fruit2"
			const appleSignal = items.byKey('fruit0')
			const bananaSignal = items.byKey('fruit1')
			const cherrySignal = items.byKey('fruit2')

			expect(appleSignal?.get()).toBe('apple')
			expect(bananaSignal?.get()).toBe('banana')
			expect(cherrySignal?.get()).toBe('cherry')

			// Should match positional access
			expect(appleSignal).toBe(items[0])
			expect(bananaSignal).toBe(items[1])
			expect(cherrySignal).toBe(items[2])

			// Non-existent keys return undefined
			expect(items.byKey('fruit3')).toBeUndefined()
			expect(items.byKey('item0')).toBeUndefined()
		})

		test('works with array stores using function-based keys', () => {
			const users = createStore(
				[
					{ id: 'u1', name: 'Alice' },
					{ id: 'u2', name: 'Bob' },
					{ id: 'u3', name: 'Charlie' },
				],
				item => item.id,
			)

			// Function-based keys should use the id property
			const aliceSignal = users.byKey('u1')
			const bobSignal = users.byKey('u2')
			const charlieSignal = users.byKey('u3')

			expect(aliceSignal?.name.get()).toBe('Alice')
			expect(bobSignal?.name.get()).toBe('Bob')
			expect(charlieSignal?.name.get()).toBe('Charlie')

			// Should match positional access
			expect(aliceSignal).toBe(users[0])
			expect(bobSignal).toBe(users[1])
			expect(charlieSignal).toBe(users[2])

			// Non-existent keys return undefined
			expect(users.byKey('u4')).toBeUndefined()
			expect(users.byKey('nonexistent')).toBeUndefined()
		})

		test('stable keys persist after sort operations', () => {
			const numbers = createStore([30, 10, 20], 'num')

			// Get original signals and their stable keys
			const signal30 = numbers[0] // num0
			const signal10 = numbers[1] // num1
			const signal20 = numbers[2] // num2

			expect(numbers.byKey('num0')).toBe(signal30)
			expect(numbers.byKey('num1')).toBe(signal10)
			expect(numbers.byKey('num2')).toBe(signal20)

			// Sort the array
			numbers.sort((a, b) => a - b)
			expect(numbers.get()).toEqual([10, 20, 30])

			// Stable keys should still point to same signals
			expect(numbers.byKey('num0')).toBe(signal30) // Still points to 30
			expect(numbers.byKey('num1')).toBe(signal10) // Still points to 10
			expect(numbers.byKey('num2')).toBe(signal20) // Still points to 20

			// But positional access should reflect new order
			expect(numbers[0]).toBe(signal10) // 10 is now first
			expect(numbers[1]).toBe(signal20) // 20 is now second
			expect(numbers[2]).toBe(signal30) // 30 is now third
		})

		test('stable keys work with add/remove operations', () => {
			const items = createStore(['first'], 'item')

			// Get original signal
			const firstSignal = items[0]
			expect(items.byKey('item0')).toBe(firstSignal)

			// Add new item
			items.add('second')
			const secondSignal = items[1]
			expect(items.byKey('item1')).toBe(secondSignal)

			// Both keys should still work
			expect(items.byKey('item0')).toBe(firstSignal)
			expect(items.byKey('item1')).toBe(secondSignal)

			// Remove first item
			items.remove(0)
			expect(items.get()).toEqual(['second'])

			// First key should no longer work, second should still work
			expect(items.byKey('item0')).toBeUndefined()
			expect(items.byKey('item1')).toBe(secondSignal)
			expect(items[0]).toBe(secondSignal) // Now at position 0
		})

		test('works with nested stores', () => {
			const app = createStore<{
				users: Array<{ name: string; settings?: { theme: string } }>
				config: {
					version: string
				}
			}>({
				users: [
					{ name: 'Alice', settings: { theme: 'dark' } },
					{ name: 'Bob', settings: { theme: 'light' } },
				],
				config: { version: '1.0' },
			})

			// Access nested array store by key
			const usersStore = app.byKey('users')
			const configStore = app.byKey('config')

			expect(usersStore).toBe(app.users)
			expect(configStore).toBe(app.config)

			// Access within nested array using stable keys (default numeric)
			const aliceStore = usersStore?.byKey('0')
			const bobStore = usersStore?.byKey('1')

			expect(aliceStore?.name.get()).toBe('Alice')
			expect(bobStore?.name.get()).toBe('Bob')
			expect(aliceStore?.settings?.get()?.theme).toBe('dark')
			expect(bobStore?.settings?.get()?.theme).toBe('light')
		})

		test('byKey is reactive and works with computed signals', () => {
			const inventory = createStore(
				[
					{ id: 'item1', count: 5 },
					{ id: 'item2', count: 3 },
				],
				item => item.id,
			)

			const item1Signal = inventory.byKey('item1')
			expect(item1Signal).toBeDefined()

			const item1Count = createComputed(() => {
				return item1Signal?.count.get() ?? 0
			})

			expect(item1Count.get()).toBe(5)

			// Update through stable key reference
			item1Signal?.count.set(10)
			expect(item1Count.get()).toBe(10)

			// Update through positional reference should also work
			inventory[0].count.set(15)
			expect(item1Count.get()).toBe(15)
		})
	})

	describe('keyAt() and indexOfKey() methods', () => {
		test('keyAt() works with record stores using order array', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
				age: 30,
			})

			expect(user.keyAt(0)).toBe('name')
			expect(user.keyAt(1)).toBe('email')
			expect(user.keyAt(2)).toBe('age')
			expect(user.keyAt(3)).toBeUndefined()
			expect(user.keyAt(-1)).toBeUndefined()
		})

		test('indexOfKey() works with record stores using order array', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
				age: 30,
			})

			expect(user.indexOfKey('name')).toBe(0)
			expect(user.indexOfKey('email')).toBe(1)
			expect(user.indexOfKey('age')).toBe(2)
			expect(user.indexOfKey('nonexistent')).toBe(-1)
		})

		test('keyAt() works with array stores using default stable keys', () => {
			const numbers = createStore([10, 20, 30])

			// Get stable keys at each position
			expect(numbers.keyAt(0)).toBe('0')
			expect(numbers.keyAt(1)).toBe('1')
			expect(numbers.keyAt(2)).toBe('2')
			expect(numbers.keyAt(3)).toBeUndefined()
			expect(numbers.keyAt(-1)).toBeUndefined()
		})

		test('indexOfKey() works with array stores using default stable keys', () => {
			const numbers = createStore([10, 20, 30])

			// Get positions by stable keys
			expect(numbers.indexOfKey('0')).toBe(0)
			expect(numbers.indexOfKey('1')).toBe(1)
			expect(numbers.indexOfKey('2')).toBe(2)
			expect(numbers.indexOfKey('3')).toBe(-1)
			expect(numbers.indexOfKey('nonexistent')).toBe(-1)
		})

		test('keyAt() and indexOfKey() work with custom string prefix keys', () => {
			const items = createStore(['apple', 'banana', 'cherry'], 'fruit')

			// Test keyAt with custom prefix
			expect(items.keyAt(0)).toBe('fruit0')
			expect(items.keyAt(1)).toBe('fruit1')
			expect(items.keyAt(2)).toBe('fruit2')
			expect(items.keyAt(3)).toBeUndefined()

			// Test indexOfKey with custom prefix
			expect(items.indexOfKey('fruit0')).toBe(0)
			expect(items.indexOfKey('fruit1')).toBe(1)
			expect(items.indexOfKey('fruit2')).toBe(2)
			expect(items.indexOfKey('fruit3')).toBe(-1)
		})

		test('keyAt() and indexOfKey() work with function-based keys', () => {
			const users = createStore(
				[
					{ id: 'alice', name: 'Alice' },
					{ id: 'bob', name: 'Bob' },
					{ id: 'charlie', name: 'Charlie' },
				],
				item => item.id,
			)

			// Test keyAt with function-based keys
			expect(users.keyAt(0)).toBe('alice')
			expect(users.keyAt(1)).toBe('bob')
			expect(users.keyAt(2)).toBe('charlie')
			expect(users.keyAt(3)).toBeUndefined()

			// Test indexOfKey with function-based keys
			expect(users.indexOfKey('alice')).toBe(0)
			expect(users.indexOfKey('bob')).toBe(1)
			expect(users.indexOfKey('charlie')).toBe(2)
			expect(users.indexOfKey('david')).toBe(-1)
		})

		test('stable key mappings persist after sort operations', () => {
			const numbers = createStore([30, 10, 20])

			// Get original stable keys
			const key0 = numbers.keyAt(0) // '0' for value 30
			const key1 = numbers.keyAt(1) // '1' for value 10
			const key2 = numbers.keyAt(2) // '2' for value 20

			// Sort the array
			numbers.sort((a, b) => a - b) // [10, 20, 30]

			// Stable keys should still exist but at different positions
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.indexOfKey(key1!)).toBe(0) // '1' (value 10) now at position 0
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.indexOfKey(key2!)).toBe(1) // '2' (value 20) now at position 1
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(numbers.indexOfKey(key0!)).toBe(2) // '0' (value 30) now at position 2

			// Position-to-key mappings should be updated
			expect(numbers.keyAt(0)).toBe(key1) // Position 0 now has key '1'
			expect(numbers.keyAt(1)).toBe(key2) // Position 1 now has key '2'
			expect(numbers.keyAt(2)).toBe(key0) // Position 2 now has key '0'
		})

		test('stable key mappings work with add and remove operations', () => {
			const items = createStore(['first', 'second'])

			// Get initial stable keys
			const firstKey = items.keyAt(0)
			const secondKey = items.keyAt(1)

			// Add a new item
			items.add('third')
			const thirdKey = items.keyAt(2)

			// Check all mappings
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(firstKey!)).toBe(0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(secondKey!)).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(thirdKey!)).toBe(2)

			// Remove the first item
			items.remove(0)

			// Check that second and third items moved up
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(firstKey!)).toBe(-1) // Removed
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(secondKey!)).toBe(0) // Moved to position 0
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(thirdKey!)).toBe(1) // Moved to position 1

			// Check position-to-key mappings
			expect(items.keyAt(0)).toBe(secondKey)
			expect(items.keyAt(1)).toBe(thirdKey)
			expect(items.keyAt(2)).toBeUndefined()
		})

		test('keyAt() and indexOfKey() work with empty arrays', () => {
			const empty = createStore<string[]>([])

			expect(empty.keyAt(0)).toBeUndefined()
			expect(empty.indexOfKey('0')).toBe(-1)

			// Add an item and test
			empty.add('item')
			expect(empty.keyAt(0)).toBe('0')
			expect(empty.indexOfKey('0')).toBe(0)
		})

		test('methods handle invalid inputs gracefully', () => {
			const numbers = createStore([1, 2, 3])

			// Test keyAt with invalid indices
			expect(numbers.keyAt(NaN)).toBeUndefined()
			expect(numbers.keyAt(Infinity)).toBeUndefined()
			expect(numbers.keyAt(-Infinity)).toBeUndefined()

			// Test indexOfKey with invalid keys
			expect(numbers.indexOfKey('')).toBe(-1)
		})

		test('round-trip consistency: keyAt(indexOfKey(key)) === key', () => {
			const items = createStore(['a', 'b', 'c'], 'item')

			// Get a stable key
			const key = items.keyAt(1) // 'item1'
			expect(key).toBe('item1')

			// Round trip: key -> index -> key
			// biome-ignore lint/style/noNonNullAssertion: test
			const index = items.indexOfKey(key!)
			expect(index).toBe(1)

			// biome-ignore lint/style/noNonNullAssertion: test
			const roundTripKey = items.keyAt(index!)
			expect(roundTripKey).toBe(key)
		})

		test('round-trip consistency: indexOfKey(keyAt(index)) === index', () => {
			const numbers = createStore([10, 20, 30])

			// Get an index
			const index = 2

			// Round trip: index -> key -> index
			const key = numbers.keyAt(index)
			expect(key).toBe('2')

			// biome-ignore lint/style/noNonNullAssertion: test
			const roundTripIndex = numbers.indexOfKey(key!)
			expect(roundTripIndex).toBe(index)
		})

		test('methods work correctly after multiple operations', () => {
			const items = createStore(['a', 'b'], 'x')

			// Track initial keys
			const keyA = items.keyAt(0) // 'x0'
			const keyB = items.keyAt(1) // 'x1'

			// Add, sort, remove operations
			items.add('c') // ['a', 'b', 'c']
			const keyC = items.keyAt(2) // 'x2'

			items.sort() // ['a', 'b', 'c'] (alphabetical)

			// Keys should still map correctly after sort
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyA!)).toBe(0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyB!)).toBe(1)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyC!)).toBe(2)

			// Remove middle item
			items.remove(1) // ['a', 'c']

			// Check final state
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyA!)).toBe(0)
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyB!)).toBe(-1) // Removed
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.indexOfKey(keyC!)).toBe(1)

			expect(items.keyAt(0)).toBe(keyA)
			expect(items.keyAt(1)).toBe(keyC)
			expect(items.keyAt(2)).toBeUndefined()
		})
	})

	describe('splice() method', () => {
		test('splice() throws error for record stores', () => {
			const user = createStore({ name: 'Alice', age: 30 })

			// @ts-expect-error deliberate call with non-array-like object
			expect(() => user.splice(0, 1)).toThrow(
				'Forbidden method call splice in store because it is only supported for array-like stores',
			)
		})

		test('splice() removes elements without adding new ones', () => {
			const numbers = createStore([10, 20, 30, 40, 50])

			const deleted = numbers.splice(1, 2)

			expect(deleted).toEqual([20, 30])
			expect(numbers.get()).toEqual([10, 40, 50])
			expect(numbers.length).toBe(3)
		})

		test('splice() adds elements without removing any', () => {
			const numbers = createStore([10, 20, 30])

			const deleted = numbers.splice(1, 0, 15, 17)

			expect(deleted).toEqual([])
			expect(numbers.get()).toEqual([10, 15, 17, 20, 30])
			expect(numbers.length).toBe(5)
		})

		test('splice() replaces elements (remove and add)', () => {
			const numbers = createStore([10, 20, 30, 40, 50])

			const deleted = numbers.splice(1, 2, 25, 35)

			expect(deleted).toEqual([20, 30])
			expect(numbers.get()).toEqual([10, 25, 35, 40, 50])
			expect(numbers.length).toBe(5)
		})

		test('splice() handles negative start index', () => {
			const numbers = createStore([10, 20, 30, 40, 50])

			const deleted = numbers.splice(-2, 1, 45)

			expect(deleted).toEqual([40])
			expect(numbers.get()).toEqual([10, 20, 30, 45, 50])
		})

		test('splice() handles start index beyond array length', () => {
			const numbers = createStore([10, 20, 30])

			const deleted = numbers.splice(10, 1, 40, 50)

			expect(deleted).toEqual([])
			expect(numbers.get()).toEqual([10, 20, 30, 40, 50])
		})

		test('splice() handles deleteCount beyond available elements', () => {
			const numbers = createStore([10, 20, 30])

			const deleted = numbers.splice(1, 10, 25)

			expect(deleted).toEqual([20, 30])
			expect(numbers.get()).toEqual([10, 25])
		})

		test('splice() with no arguments behaves like empty splice', () => {
			const numbers = createStore([10, 20, 30])

			const deleted = numbers.splice(0)

			expect(deleted).toEqual([10, 20, 30])
			expect(numbers.get()).toEqual([])
			expect(numbers.length).toBe(0)
		})

		test('splice() maintains stable keys correctly', () => {
			const items = createStore(['a', 'b', 'c', 'd'])

			// Get keys before splice
			const keyA = items.keyAt(0)
			const keyD = items.keyAt(3)

			// Splice in the middle
			items.splice(1, 2, 'x', 'y')

			// Keys that weren't removed should still exist
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.byKey(keyA!)).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.byKey(keyA!)?.get()).toBe('a')
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.byKey(keyD!)).toBeDefined()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(items.byKey(keyD!)?.get()).toBe('d')

			// Check final array
			expect(items.get()).toEqual(['a', 'x', 'y', 'd'])
		})

		test('splice() emits correct notifications', () => {
			const numbers = createStore([10, 20, 30, 40])

			let addNotification: readonly string[] | undefined
			let removeNotification: readonly string[] | undefined

			numbers.on('add', change => {
				addNotification = change
			})

			numbers.on('remove', change => {
				removeNotification = change
			})

			const deleted = numbers.splice(1, 2, 25, 35)

			expect(deleted).toEqual([20, 30])
			expect(removeNotification).toBeDefined()
			expect(addNotification).toBeDefined()

			// Check that the right number of keys were added/removed
			if (removeNotification) expect(removeNotification).toHaveLength(2)
			if (addNotification) expect(addNotification).toHaveLength(2)
		})

		test('splice() is reactive', () => {
			const numbers = createStore([10, 20, 30])

			let lastValue: number[] = []
			let effectRuns = 0

			createEffect(() => {
				lastValue = numbers.get()
				effectRuns++
			})

			// Initial effect run
			expect(effectRuns).toBe(1)
			expect(lastValue).toEqual([10, 20, 30])

			// Splice should trigger reactivity
			numbers.splice(1, 1, 25, 35)

			expect(effectRuns).toBe(2)
			expect(lastValue).toEqual([10, 25, 35, 30])
		})

		test('splice() works with nested objects', () => {
			type User = { name: string; active: boolean }
			const userData: User[] = [
				{ name: 'Alice', active: true },
				{ name: 'Bob', active: false },
				{ name: 'Charlie', active: true },
			]
			const users = createStore(userData)

			const newUser = { name: 'David', active: false }
			const deleted = users.splice(1, 1, newUser)

			expect(deleted).toHaveLength(1)
			expect(deleted[0].name).toBe('Bob')
			expect(deleted[0].active).toBe(false)

			expect(users.get()).toHaveLength(3)
			expect(users[1].name.get()).toBe('David')
			expect(users[1].active.get()).toBe(false)
		})

		test('splice() handles edge case of empty array', () => {
			const empty = createStore<number[]>([])

			const deleted = empty.splice(0, 0, 10, 20)

			expect(deleted).toEqual([])
			expect(empty.get()).toEqual([10, 20])
			expect(empty.length).toBe(2)
		})

		test('splice() handles insertion at the end', () => {
			const numbers = createStore([10, 20, 30])

			const deleted = numbers.splice(3, 0, 40, 50)

			expect(deleted).toEqual([])
			expect(numbers.get()).toEqual([10, 20, 30, 40, 50])
		})

		test('splice() preserves existing signals after modifications', () => {
			const numbers = createStore([10, 20, 30, 40])

			// Get signal reference before splice
			const signal0 = numbers[0]
			const signal3 = numbers[3]

			// Splice in the middle
			numbers.splice(1, 2, 25)

			// Original signals at positions 0 and 3 should still work
			expect(signal0.get()).toBe(10)
			expect(signal3.get()).toBe(40)

			// Array should be [10, 25, 40]
			expect(numbers.get()).toEqual([10, 25, 40])
			expect(numbers[0]).toBe(signal0)
			expect(numbers[2]).toBe(signal3) // signal3 moved to position 2
		})
	})

	describe('deriveCollection() method', () => {
		test('throws error for record stores', () => {
			const user = createStore({ name: 'John', age: 30 })
			expect(() => {
				// @ts-expect-error - testing runtime error
				user.deriveCollection(item => item)
			}).toThrow(
				'Forbidden method call deriveCollection in store because it is only supported for array-like stores',
			)
		})

		test('creates collection with sync transformation - double numbers', () => {
			const numbers = createStore([1, 2, 3])
			const doubled = numbers.deriveCollection(item => item * 2)

			expect(doubled.length).toBe(3)
			expect(doubled.get()).toEqual([2, 4, 6])

			// Test individual access
			expect(doubled[0].get()).toBe(2)
			expect(doubled[1].get()).toBe(4)
			expect(doubled[2].get()).toBe(6)
		})

		test('creates collection with sync transformation - uppercase strings', () => {
			const words = createStore(['hello', 'world', 'test'])
			const uppercased = words.deriveCollection(item =>
				typeof item === 'string' ? item.toUpperCase() : item,
			)

			expect(uppercased.get()).toEqual(['HELLO', 'WORLD', 'TEST'])
			expect(uppercased[1].get()).toBe('WORLD')
		})

		test('collection reacts to source store changes', () => {
			const numbers = createStore([1, 2])
			const doubled = numbers.deriveCollection(item => item * 2)

			expect(doubled.get()).toEqual([2, 4])

			// Add item to source
			numbers.add(3)
			expect(doubled.get()).toEqual([2, 4, 6])

			// Remove item from source
			numbers.remove(0)
			expect(doubled.get()).toEqual([4, 6])
		})

		test('collection is reactive to individual item changes', () => {
			const numbers = createStore([1, 2, 3])
			const doubled = numbers.deriveCollection(item => item * 2)

			let lastValue: number[] = []
			let effectRuns = 0
			createEffect(() => {
				lastValue = doubled.get()
				effectRuns++
			})

			expect(lastValue).toEqual([2, 4, 6])
			expect(effectRuns).toBe(1)

			// Change individual item
			numbers[1].set(5)
			expect(lastValue).toEqual([2, 10, 6])
			expect(effectRuns).toBe(2)
		})

		test('collection handles async transformation with timeout', async () => {
			const numbers = createStore([1, 2, 3])

			const asyncTransformed = numbers.deriveCollection(
				async (item, signal) => {
					// Simulate async work with random timeout
					const delay = Math.random() * 10 + 5 // 5-15ms
					await new Promise(resolve => {
						const timeout = setTimeout(resolve, delay)
						signal?.addEventListener('abort', () => {
							clearTimeout(timeout)
						})
					})

					if (signal?.aborted) {
						throw new Error('Aborted')
					}

					return item * 10
				},
			)

			// Wait for async computation to complete
			await new Promise(resolve => setTimeout(resolve, 50))

			expect(asyncTransformed.get()).toEqual([10, 20, 30])
		}, 1000)

		/* test('rapid mutations abort previous async operations', async () => {
			const numbers = createStore([1])
			let computationStarted = 0
			let computationCompleted = 0
			let computationAborted = 0

			const asyncTransformed = numbers.deriveCollection(
				async (item, signal) => {
					computationStarted++

					// Longer async operation
					try {
						await new Promise((resolve, reject) => {
							const timeout = setTimeout(resolve, 20)
							signal?.addEventListener('abort', () => {
								clearTimeout(timeout)
								reject(new Error('Aborted'))
							})
						})

						if (signal?.aborted) {
							throw new Error('Aborted')
						}

						computationCompleted++
						return item * 100
					} catch (error) {
						if (
							error instanceof Error &&
							error.message === 'Aborted'
						) {
							computationAborted++
							throw error
						}
						throw error
					}
				},
			)

			// Rapidly change the value multiple times
			numbers[0].set(2)
			numbers[0].set(3)
			numbers[0].set(4)
			numbers[0].set(5)

			// Wait for all operations to settle
			await new Promise(resolve => setTimeout(resolve, 100))

			// Should have started multiple computations but only completed the last one
			expect(computationStarted).toBeGreaterThan(1)
			expect(computationCompleted).toBeLessThan(computationStarted)
			expect(computationAborted).toBeGreaterThan(0)

			// Final result should be the last value
			expect(asyncTransformed.get()).toEqual([500])
		}, 1000) */

		test('collection supports iteration and enumeration', () => {
			const fruits = createStore(['apple', 'banana', 'cherry'])
			const uppercased = fruits.deriveCollection(item =>
				typeof item === 'string' ? item.toUpperCase() : item,
			)

			// Test for...of iteration
			const signals = []
			for (const signal of uppercased) {
				signals.push(signal.get())
			}
			expect(signals).toEqual(['APPLE', 'BANANA', 'CHERRY'])

			// Test spread operator
			const spread = [...uppercased]
			expect(spread.map(s => s.get())).toEqual([
				'APPLE',
				'BANANA',
				'CHERRY',
			])
		})

		test('collection supports key-based access methods', () => {
			const items = createStore(['a', 'b', 'c'], 'item')
			const uppercased = items.deriveCollection(item =>
				typeof item === 'string' ? item.toUpperCase() : item,
			)

			// Test key access methods inherited from array store pattern
			const key0 = uppercased.keyAt(0)
			const key1 = uppercased.keyAt(1)

			expect(key0).toBeTruthy()
			expect(key1).toBeTruthy()

			if (key0 && key1) {
				expect(uppercased.indexOfKey(key0)).toBe(0)
				expect(uppercased.indexOfKey(key1)).toBe(1)

				// Test byKey access
				expect(uppercased.byKey(key0)?.get()).toBe('A')
				expect(uppercased.byKey(key1)?.get()).toBe('B')
			}
		})

		/* test('collection supports local sorting', () => {
			const numbers = createStore([3, 1, 4, 1, 5])
			const doubled = numbers.deriveCollection(item => item * 2)

			expect(doubled.get()).toEqual([6, 2, 8, 2, 10])

			// Sort collection locally
			doubled.sort((a, b) => a - b)
			expect(doubled.get()).toEqual([2, 2, 6, 8, 10])

			// Add item to source - should override local sort
			numbers.add(0)
			expect(doubled.get()).toEqual([6, 2, 8, 2, 10, 0]) // Back to source order + new item
		}) */

		test('collection emits notifications for changes', () => {
			const numbers = createStore([1, 2, 3])
			const doubled = numbers.deriveCollection(item => item * 2)

			let addNotifications: readonly string[] = []
			let removeNotifications: readonly string[] = []
			let sortNotifications: readonly string[] = []

			doubled.on('add', keys => {
				addNotifications = keys
			})
			doubled.on('remove', keys => {
				removeNotifications = keys
			})
			doubled.on('sort', keys => {
				sortNotifications = keys
			})

			// Add to source
			numbers.add(4)
			expect(addNotifications.length).toBe(1)

			// Remove from source
			numbers.remove(0)
			expect(removeNotifications.length).toBe(1)

			// Sort collection
			doubled.sort()
			expect(sortNotifications.length).toBe(doubled.length)
		})

		test('collection with nested objects', () => {
			const users = createStore([
				{ name: 'Alice', age: 25 },
				{ name: 'Bob', age: 30 },
			])

			const userSummaries = users.deriveCollection<{
				summary: string
				isAdult: boolean
			}>(user => ({
				summary: `${user.name} (${user.age} years old)`,
				isAdult: user.age >= 18,
			}))

			const summaries = userSummaries.get()
			expect(summaries[0].summary).toBe('Alice (25 years old)')
			expect(summaries[0].isAdult).toBe(true)
			expect(summaries[1].summary).toBe('Bob (30 years old)')
			expect(summaries[1].isAdult).toBe(true)

			// Test reactivity to nested changes
			users[0].age.set(16)
			expect(userSummaries[0].get().summary).toBe('Alice (16 years old)')
			expect(userSummaries[0].get().isAdult).toBe(false)
		})

		test('collection cleanup when no longer watched', () => {
			const numbers = createStore([1, 2, 3])
			const doubled = numbers.deriveCollection(item => item * 2)

			let effectRuns = 0
			const cleanup = createEffect(() => {
				doubled.get() // Subscribe to collection
				effectRuns++
			})

			expect(effectRuns).toBe(1)

			// Change source - should trigger effect
			numbers[0].set(5)
			expect(effectRuns).toBe(2)

			// Cleanup effect
			cleanup()

			// Change source - should not trigger effect anymore
			numbers[0].set(10)
			expect(effectRuns).toBe(2) // Should not increment
		})

		test('multiple collections from same source', () => {
			const numbers = createStore([1, 2, 3])

			const doubled = numbers.deriveCollection(item => item * 2)
			const squared = numbers.deriveCollection(item => item * item)

			expect(doubled.get()).toEqual([2, 4, 6])
			expect(squared.get()).toEqual([1, 4, 9])

			// Both should react to source changes
			numbers[1].set(5)
			expect(doubled.get()).toEqual([2, 10, 6])
			expect(squared.get()).toEqual([1, 25, 9])
		})
	})
})
