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
		test('creates a store with initial values', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			expect(user.name.get()).toBe('Hannah')
			expect(user.email.get()).toBe('hannah@example.com')
		})

		test('has Symbol.toStringTag of Store', () => {
			const s = createStore({ a: 1 })
			expect(s[Symbol.toStringTag]).toBe('Store')
		})

		test('isStore identifies store instances correctly', () => {
			const s = createStore({ a: 1 })
			const st = createState(1)
			const c = createComputed(() => 1)

			expect(isStore(s)).toBe(true)
			expect(isStore(st)).toBe(false)
			expect(isStore(c)).toBe(false)
			expect(isStore({})).toBe(false)
			expect(isStore(null)).toBe(false)
		})

		test('get() returns the complete store value', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			expect(user.get()).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			const participants = createStore<
				{ name: string; tags: string[] }[]
			>([
				{ name: 'Alice', tags: ['friends', 'mates'] },
				{ name: 'Bob', tags: ['friends'] },
			])
			expect(participants.get()).toEqual([
				{ name: 'Alice', tags: ['friends', 'mates'] },
				{ name: 'Bob', tags: ['friends'] },
			])
		})
	})

	describe('proxy data access and modification', () => {
		test('properties can be accessed and modified via signals', () => {
			const user = createStore({ name: 'Hannah', age: 25 })

			// Get signals from store proxy
			expect(user.name.get()).toBe('Hannah')
			expect(user.age.get()).toBe(25)

			// Set values via signals
			user.name.set('Alice')
			user.age.set(30)

			expect(user.name.get()).toBe('Alice')
			expect(user.age.get()).toBe(30)
		})

		test('returns undefined for non-existent properties', () => {
			const user = createStore({ name: 'Hannah' })

			// @ts-expect-error accessing non-existent property
			expect(user.nonExistent).toBeUndefined()
		})

		test('supports numeric key access', () => {
			const items = createStore({ '0': 'first', '1': 'second' })

			expect(items[0].get()).toBe('first')
			expect(items['0'].get()).toBe('first')
			expect(items[1].get()).toBe('second')
			expect(items['1'].get()).toBe('second')
		})

		test('can add new properties via add method', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			user.add('email', 'hannah@example.com')

			expect(user.email?.get()).toBe('hannah@example.com')
			expect(user.get()).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
		})

		test('can remove existing properties via remove method', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			expect(user.email?.get()).toBe('hannah@example.com')

			user.remove('email')

			expect(user.email).toBeUndefined()
			expect(user.get()).toEqual({
				name: 'Hannah',
			})
		})

		test('add method prevents null values', () => {
			const user = createStore<{ name: string; tags?: string[] }>({
				name: 'Alice',
			})

			expect(() => {
				// @ts-expect-error deliberate test that null values are not allowed
				user.add('tags', null)
			}).toThrow(
				'Nullish signal values are not allowed in store for key "tags"',
			)
		})
	})

	describe('nested stores', () => {
		test('creates nested stores for object properties', () => {
			const user = createStore({
				name: 'Hannah',
				preferences: {
					theme: 'dark',
					notifications: true,
				},
			})

			expect(isStore(user.preferences)).toBe(true)
			expect(user.preferences.theme?.get()).toBe('dark')
			expect(user.preferences.notifications?.get()).toBe(true)
		})

		test('nested properties are reactive', () => {
			const user = createStore({
				preferences: {
					theme: 'dark',
				},
			})

			user.preferences.theme.set('light')
			expect(user.preferences.theme.get()).toBe('light')
			expect(user.get().preferences.theme).toBe('light')
		})

		test('deeply nested stores work correctly', () => {
			const config = createStore({
				ui: {
					theme: {
						colors: {
							primary: 'blue',
						},
					},
				},
			})

			expect(config.ui.theme.colors.primary.get()).toBe('blue')
			config.ui.theme.colors.primary.set('red')
			expect(config.ui.theme.colors.primary.get()).toBe('red')
		})
	})

	describe('set() and update() methods', () => {
		test('set() replaces entire store value', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			user.set({ name: 'Alice', email: 'alice@example.com' })

			expect(user.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
		})

		test('update() modifies store using function', () => {
			const user = createStore({ name: 'Hannah', age: 25 })

			user.update(prev => ({ ...prev, age: prev.age + 1 }))

			expect(user.get()).toEqual({
				name: 'Hannah',
				age: 26,
			})
		})
	})

	describe('iterator protocol', () => {
		test('supports for...of iteration', () => {
			const user = createStore({ name: 'Hannah', age: 25 })
			const entries: Array<[string, unknown & {}]> = []

			for (const [key, signal] of user) {
				entries.push([key, signal.get()])
			}

			expect(entries).toContainEqual(['name', 'Hannah'])
			expect(entries).toContainEqual(['age', 25])
		})
	})

	describe('change tracking', () => {
		test('tracks size changes', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			expect(user.size.get()).toBe(1)

			user.add('email', 'hannah@example.com')
			expect(user.size.get()).toBe(2)

			user.remove('email')
			expect(user.size.get()).toBe(1)
		})

		test('emits an add notification on initial creation', async () => {
			let addNotification: Record<string, string> | null = null
			const user = createStore({ name: 'Hannah' })

			user.on('add', change => {
				addNotification = change
			})

			// Wait for the async initial event
			await new Promise(resolve => setTimeout(resolve, 10))

			expect(addNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addNotification!).toEqual({ name: 'Hannah' })
		})

		test('emits an add notification for new properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			let addNotification: Record<string, string> | null = null
			user.on('add', change => {
				addNotification = change
			})

			user.update(v => ({ ...v, email: 'hannah@example.com' }))

			expect(addNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addNotification!).toEqual({
				email: 'hannah@example.com',
			})
		})

		test('emits a change notification for property changes', () => {
			const user = createStore({ name: 'Hannah' })

			let changeNotification: Record<string, string> | null = null
			user.on('change', change => {
				changeNotification = change
			})

			user.set({ name: 'Alice' })

			expect(changeNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(changeNotification!).toEqual({
				name: 'Alice',
			})
		})

		test('emits a change notification for signal changes', () => {
			const user = createStore({ name: 'Hannah' })

			let changeNotification: Record<string, string> | null = null
			user.on('change', change => {
				changeNotification = change
			})

			user.name.set('Bob')

			expect(changeNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(changeNotification!).toEqual({
				name: 'Bob',
			})
		})

		test('emits a change notification when nested properties change', () => {
			const user = createStore({
				name: 'Hannah',
				preferences: {
					theme: 'dark',
					notifications: true,
				},
			})

			let changeNotification: Record<string, unknown> = {}
			user.on('change', change => {
				changeNotification = change
			})

			// Change a nested property
			user.preferences.theme.set('light')

			expect(changeNotification).toBeTruthy()
			// Should notify about the direct child "preferences" that contains the changed nested property
			expect(changeNotification).toEqual({
				preferences: {
					theme: 'light',
					notifications: true,
				},
			})
		})

		test('emits a change notification for deeply nested property changes', () => {
			const config = createStore({
				ui: {
					theme: {
						colors: {
							primary: 'blue',
							secondary: 'green',
						},
						mode: 'dark',
					},
				},
			})

			let changeNotification: Record<string, unknown> = {}
			config.on('change', change => {
				changeNotification = change
			})

			// Change a deeply nested property (3 levels deep)
			config.ui.theme.colors.primary.set('red')

			expect(changeNotification).toBeTruthy()
			// Should notify about the direct child "ui" that contains the changed nested structure
			expect(changeNotification).toEqual({
				ui: {
					theme: {
						colors: {
							primary: 'red',
							secondary: 'green',
						},
						mode: 'dark',
					},
				},
			})
		})

		test('emits a remove notification when nested properties are removed', () => {
			const user = createStore<{
				name: string
				preferences?: {
					theme: string
					notifications: boolean
				}
			}>({
				name: 'Hannah',
				preferences: {
					theme: 'dark',
					notifications: true,
				},
			})

			let removeNotification: Record<string, unknown> = {}
			user.on('remove', remove => {
				removeNotification = remove
			})

			// Remove the entire preferences object by setting the store without it
			user.set({ name: 'Hannah' })

			expect(removeNotification).toBeTruthy()
			// Should notify about the removal of the preferences property
			expect(removeNotification).toEqual({
				preferences: expect.anything(), // The actual structure doesn't matter, just that it was removed
			})
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
					theme: 'dark',
				},
			})

			let changeNotification: Record<string, unknown> = {}
			let addNotification: Record<string, unknown> = {}
			let removeNotification: Record<string, unknown> = {}

			user.on('change', change => {
				changeNotification = change
			})
			user.on('add', add => {
				addNotification = add
			})
			user.on('remove', remove => {
				removeNotification = remove
			})

			// Perform a set() that changes name, removes email, adds age, and keeps preferences
			user.set({
				name: 'Alice', // changed
				preferences: {
					theme: 'dark', // unchanged nested
				},
				age: 30, // added
				// email removed
			})

			// Should emit change notification for changed properties
			expect(changeNotification).toEqual({
				name: 'Alice',
			})

			// Should emit add notification for new properties
			expect(addNotification).toEqual({
				age: 30,
			})

			// Should emit remove notification for removed properties
			expect(removeNotification).toEqual({
				email: expect.anything(),
			})
		})

		test('set() with only removals emits only remove notifications', () => {
			const user = createStore<{
				name: string
				email?: string
				age?: number
			}>({
				name: 'Hannah',
				email: 'hannah@example.com',
				age: 25,
			})

			let changeNotification: Record<string, unknown> | null = null
			let removeNotification: Record<string, unknown> = {}

			user.on('change', change => {
				changeNotification = change
			})
			user.on('remove', remove => {
				removeNotification = remove
			})

			// Set to a subset that only removes properties (no changes)
			user.set({ name: 'Hannah' }) // same name, removes email and age

			// Should NOT emit change notification since name didn't change
			expect(changeNotification).toBe(null)

			// Should emit remove notification for removed properties
			expect(removeNotification).toEqual({
				email: expect.anything(),
				age: expect.anything(),
			})
		})

		test('emits a remove notification for removed properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			let removeNotification: Record<string, string> | null = null
			user.on('remove', change => {
				removeNotification = change
			})

			user.remove('email')

			expect(removeNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(removeNotification!.email).toBe(UNSET)
		})

		test('emits an add notification when using add method', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			let addNotification: Record<string, string> | null = null
			user.on('add', change => {
				addNotification = change
			})

			user.add('email', 'hannah@example.com')

			expect(addNotification).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addNotification!).toEqual({
				email: 'hannah@example.com',
			})
		})

		test('can remove notification listeners', () => {
			const user = createStore({ name: 'Hannah' })

			let notificationCount = 0
			const listener = () => {
				notificationCount++
			}

			const off = user.on('change', listener)
			user.name.set('Alice')
			expect(notificationCount).toBe(1)

			off()
			user.name.set('Bob')
			expect(notificationCount).toBe(1) // Should not increment
		})

		test('supports multiple notification listeners for the same type', () => {
			const user = createStore({ name: 'Hannah' })

			let listener1Called = false
			let listener2Called = false

			user.on('change', () => {
				listener1Called = true
			})

			user.on('change', () => {
				listener2Called = true
			})

			user.name.set('Alice')

			expect(listener1Called).toBe(true)
			expect(listener2Called).toBe(true)
		})
	})

	describe('reactivity', () => {
		test('store-level get() is reactive', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			let lastValue = { name: '', email: '' }

			createEffect(() => {
				lastValue = user.get()
			})

			user.name.set('Alice')

			expect(lastValue).toEqual({
				name: 'Alice',
				email: 'hannah@example.com',
			})
		})

		test('individual signal reactivity works', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			let lastName = ''
			let nameEffectRuns = 0

			// Get signal for name property directly
			const nameSignal = user.name

			createEffect(() => {
				lastName = nameSignal.get()
				nameEffectRuns++
			})

			// Change name should trigger effect
			user.name.set('Alice')
			expect(lastName).toBe('Alice')
			expect(nameEffectRuns).toBe(2) // Initial + update
		})

		test('nested store changes propagate to parent', () => {
			const user = createStore({
				preferences: {
					theme: 'dark',
				},
			})
			let effectRuns = 0

			createEffect(() => {
				user.get() // Watch entire store
				effectRuns++
			})

			user.preferences.theme.set('light')
			expect(effectRuns).toBe(2) // Initial + nested change
		})

		test('updates are reactive', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})
			let lastValue = {}
			let effectRuns = 0

			createEffect(() => {
				lastValue = user.get()
				effectRuns++
			})

			user.add('email', 'hannah@example.com')
			expect(lastValue).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(effectRuns).toBe(2)
		})

		test('remove method is reactive', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			let lastValue = {}
			let effectRuns = 0

			createEffect(() => {
				lastValue = user.get()
				effectRuns++
			})

			expect(effectRuns).toBe(1)

			user.remove('email')
			expect(lastValue).toEqual({
				name: 'Hannah',
			})
			expect(effectRuns).toBe(2)
		})

		test('add method does not overwrite existing properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'original@example.com',
			})

			const originalSize = user.size.get()

			expect(() => {
				user.add('email', 'new@example.com')
			}).toThrow(
				'Could not add store key "email" with value "new@example.com" because it already exists',
			)

			expect(user.email?.get()).toBe('original@example.com')
			expect(user.size.get()).toBe(originalSize)
		})

		test('remove method has no effect on non-existent properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			const originalSize = user.size.get()
			user.remove('email')

			expect(user.size.get()).toBe(originalSize)
		})
	})

	describe('computed integration', () => {
		test('works with computed signals', () => {
			const user = createStore({ firstName: 'Hannah', lastName: 'Smith' })

			const fullName = createComputed(() => {
				return `${user.firstName.get()} ${user.lastName.get()}`
			})

			expect(fullName.get()).toBe('Hannah Smith')

			user.firstName.set('Alice')
			expect(fullName.get()).toBe('Alice Smith')
		})

		test('computed reacts to nested store changes', () => {
			const config = createStore({
				ui: {
					theme: 'dark',
				},
			})

			const themeDisplay = createComputed(() => {
				return `Theme: ${config.ui.theme.get()}`
			})

			expect(themeDisplay.get()).toBe('Theme: dark')

			config.ui.theme.set('light')
			expect(themeDisplay.get()).toBe('Theme: light')
		})
	})

	describe('array-derived stores with computed sum', () => {
		test('computes sum correctly and updates when items are added, removed, or changed', () => {
			// Create a store with an array of numbers
			const numbers = createStore([1, 2, 3, 4, 5])

			// Create a computed that calculates the sum by accessing the array via .get()
			// This ensures reactivity to both value changes and structural changes
			const sum = createComputed(() => {
				const array = numbers.get()
				if (!Array.isArray(array)) return 0
				return array.reduce((acc, num) => acc + num, 0)
			})

			// Initial sum should be 15 (1+2+3+4+5)
			expect(sum.get()).toBe(15)
			expect(numbers.size.get()).toBe(5)

			// Test adding items
			numbers.add(6) // Add 6 at index 5
			expect(sum.get()).toBe(21) // 15 + 6 = 21
			expect(numbers.size.get()).toBe(6)

			numbers.add(7) // Add 7 at index 6
			expect(sum.get()).toBe(28) // 21 + 7 = 28
			expect(numbers.size.get()).toBe(7)

			// Test changing a single value
			numbers[2].set(10) // Change index 2 from 3 to 10
			expect(sum.get()).toBe(35) // 28 - 3 + 10 = 35

			// Test another value change
			numbers[0].set(5) // Change index 0 from 1 to 5
			expect(sum.get()).toBe(39) // 35 - 1 + 5 = 39

			// Test removing items
			numbers.remove(6) // Remove index 6 (value 7)
			expect(sum.get()).toBe(32) // 39 - 7 = 32
			expect(numbers.size.get()).toBe(6)

			numbers.remove(0) // Remove index 0 (value 5)
			expect(sum.get()).toBe(27) // 32 - 5 = 27
			expect(numbers.size.get()).toBe(5)

			// Verify the final array structure using .get()
			const finalArray = numbers.get()
			expect(Array.isArray(finalArray)).toBe(true)
			expect(finalArray).toEqual([2, 10, 4, 5, 6])
		})

		test('handles empty array and single element operations', () => {
			// Start with empty array
			const numbers = createStore<number[]>([])

			const sum = createComputed(() => {
				const array = numbers.get()
				if (!Array.isArray(array)) return 0
				return array.reduce((acc, num) => acc + num, 0)
			})

			// Empty array sum should be 0
			expect(sum.get()).toBe(0)
			expect(numbers.size.get()).toBe(0)

			// Add first element
			numbers.add(42)
			expect(sum.get()).toBe(42)
			expect(numbers.size.get()).toBe(1)

			// Change the only element
			numbers[0].set(100)
			expect(sum.get()).toBe(100)

			// Remove the only element
			numbers.remove(0)
			expect(sum.get()).toBe(0)
			expect(numbers.size.get()).toBe(0)
		})

		test('computed sum using store iteration with size tracking', () => {
			const numbers = createStore([10, 20, 30])

			// Use iteration but also track size to ensure reactivity to additions/removals
			const sum = createComputed(() => {
				// Access size to subscribe to structural changes
				numbers.size.get()
				let total = 0
				for (const signal of numbers) {
					total += signal.get()
				}
				return total
			})

			expect(sum.get()).toBe(60)

			// Add more numbers
			numbers.add(40)
			expect(sum.get()).toBe(100)

			// Modify existing values
			numbers[1].set(25) // Change 20 to 25
			expect(sum.get()).toBe(105) // 10 + 25 + 30 + 40

			// Remove a value
			numbers.remove(2) // Remove 30
			expect(sum.get()).toBe(75) // 10 + 25 + 40
		})

		test('demonstrates array compaction behavior with remove operations', () => {
			// Create a store with an array
			const numbers = createStore([10, 20, 30, 40, 50])

			// Create a computed using iteration approach with size tracking
			const sumWithIteration = createComputed(() => {
				// Access size to subscribe to structural changes
				numbers.size.get()
				let total = 0
				for (const signal of numbers) {
					total += signal.get()
				}
				return total
			})

			// Create a computed using .get() approach for comparison
			const sumWithGet = createComputed(() => {
				const array = numbers.get()
				if (!Array.isArray(array)) return 0
				return array.reduce((acc, num) => acc + num, 0)
			})

			// Initial state: [10, 20, 30, 40, 50], keys [0,1,2,3,4]
			expect(sumWithIteration.get()).toBe(150)
			expect(sumWithGet.get()).toBe(150)
			expect(numbers.size.get()).toBe(5)

			// Remove items - arrays should compact (not create sparse holes)
			numbers.remove(1) // Remove 20, array becomes [10, 30, 40, 50]
			expect(numbers.size.get()).toBe(4)
			expect(numbers.get()).toEqual([10, 30, 40, 50])
			expect(sumWithIteration.get()).toBe(130) // 10 + 30 + 40 + 50
			expect(sumWithGet.get()).toBe(130)

			numbers.remove(2) // Remove 40, array becomes [10, 30, 50]
			expect(numbers.size.get()).toBe(3)
			expect(numbers.get()).toEqual([10, 30, 50])
			expect(sumWithIteration.get()).toBe(90) // 10 + 30 + 50
			expect(sumWithGet.get()).toBe(90)

			// Set a new array of same size (3 elements)
			numbers.set([100, 200, 300])
			expect(numbers.size.get()).toBe(3)
			expect(numbers.get()).toEqual([100, 200, 300])

			// Both approaches work correctly with compacted arrays
			expect(sumWithGet.get()).toBe(600) // 100 + 200 + 300
			expect(sumWithIteration.get()).toBe(600) // Both work correctly
		})

		test('verifies root cause: diff works on array representation but reconcile uses sparse keys', () => {
			// Create a sparse array scenario
			const numbers = createStore([10, 20, 30])

			// Remove middle element to create sparse structure
			numbers.remove(1) // Now has keys ["0", "2"] with values [10, 30]

			// Verify the sparse structure
			expect(numbers.get()).toEqual([10, 30])
			expect(numbers.size.get()).toBe(2)

			// Now set a new array of same length
			// The diff should see [10, 30] -> [100, 200] as:
			// - index 0: 10 -> 100 (change)
			// - index 1: 30 -> 200 (change)
			// But internally the keys are ["0", "2"], not ["0", "1"]
			numbers.set([100, 200])

			// With the fix: sparse array replacement now works correctly
			const result = numbers.get()

			// The fix ensures proper sparse array replacement
			expect(result).toEqual([100, 200]) // This now passes with the diff fix!
		})
	})

	describe('arrays and edge cases', () => {
		test('handles arrays as store values', () => {
			const data = createStore({ items: [1, 2, 3] })

			// Arrays become stores with string indices
			expect(isStore(data.items)).toBe(true)
			expect(data.items['0'].get()).toBe(1)
			expect(data.items['1'].get()).toBe(2)
			expect(data.items['2'].get()).toBe(3)
		})

		test('array-derived nested stores have correct type inference', () => {
			const todoApp = createStore({
				todos: ['Buy milk', 'Walk the dog', 'Write code'],
				users: [
					{ name: 'Alice', active: true },
					{ name: 'Bob', active: false },
				],
				numbers: [1, 2, 3, 4, 5],
			})

			// Arrays should become stores
			expect(isStore(todoApp.todos)).toBe(true)
			expect(isStore(todoApp.users)).toBe(true)
			expect(isStore(todoApp.numbers)).toBe(true)

			// String array elements should be State<string>
			expect(todoApp.todos['0'].get()).toBe('Buy milk')
			expect(todoApp.todos['1'].get()).toBe('Walk the dog')
			expect(todoApp.todos['2'].get()).toBe('Write code')

			// Should be able to modify string elements
			todoApp.todos['0'].set('Buy groceries')
			expect(todoApp.todos['0'].get()).toBe('Buy groceries')

			// Object array elements should be Store<T>
			expect(isStore(todoApp.users[0])).toBe(true)
			expect(isStore(todoApp.users[1])).toBe(true)

			// Should be able to access nested properties in object array elements
			expect(todoApp.users[0].name.get()).toBe('Alice')
			expect(todoApp.users[0].active.get()).toBe(true)
			expect(todoApp.users[1].name.get()).toBe('Bob')
			expect(todoApp.users[1].active.get()).toBe(false)

			// Should be able to modify nested properties
			todoApp.users[0].name.set('Alice Smith')
			todoApp.users[0].active.set(false)
			expect(todoApp.users[0].name.get()).toBe('Alice Smith')
			expect(todoApp.users[0].active.get()).toBe(false)

			// Number array elements should be State<number>
			expect(todoApp.numbers[0].get()).toBe(1)
			expect(todoApp.numbers[4].get()).toBe(5)

			// Should be able to modify number elements
			todoApp.numbers[0].set(10)
			todoApp.numbers[4].set(50)
			expect(todoApp.numbers[0].get()).toBe(10)
			expect(todoApp.numbers[4].get()).toBe(50)

			// Store-level access should reflect all changes
			const currentState = todoApp.get()
			expect(currentState.todos[0]).toBe('Buy groceries')
			expect(currentState.users[0].name).toBe('Alice Smith')
			expect(currentState.users[0].active).toBe(false)
			expect(currentState.numbers[0]).toBe(10)
			expect(currentState.numbers[4]).toBe(50)
		})

		test('handles UNSET values', () => {
			const data = createStore({ value: UNSET as string })

			expect(data.value.get()).toBe(UNSET)
			data.value.set('some string')
			expect(data.value.get()).toBe('some string')
		})

		test('handles primitive values', () => {
			const data = createStore({
				str: 'hello',
				num: 42,
				bool: true,
			})

			expect(data.str.get()).toBe('hello')
			expect(data.num.get()).toBe(42)
			expect(data.bool.get()).toBe(true)
		})
	})

	describe('proxy behavior', () => {
		test('Object.keys returns property keys', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			expect(Object.keys(user)).toEqual(['name', 'email'])
		})

		test('property enumeration works', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			const keys: string[] = []

			for (const key in user) {
				keys.push(key)
			}

			expect(keys).toEqual(['name', 'email'])
		})

		test('in operator works', () => {
			const user = createStore({ name: 'Hannah' })

			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
		})

		test('Object.getOwnPropertyDescriptor works', () => {
			const user = createStore({ name: 'Hannah' })

			const descriptor = Object.getOwnPropertyDescriptor(user, 'name')
			expect(descriptor).toEqual({
				enumerable: true,
				configurable: true,
				writable: true,
				value: user.name,
			})
		})
	})

	describe('type conversion via toSignal', () => {
		test('arrays are converted to stores', () => {
			const fruits = createStore({ items: ['apple', 'banana', 'cherry'] })

			expect(isStore(fruits.items)).toBe(true)
			expect(fruits.items['0'].get()).toBe('apple')
			expect(fruits.items['1'].get()).toBe('banana')
			expect(fruits.items['2'].get()).toBe('cherry')
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
	})

	describe('spread operator behavior', () => {
		test('spreading store spreads individual signals', () => {
			const user = createStore({ name: 'Hannah', age: 25, active: true })

			// Spread the store - should get individual signals
			const spread = { ...user }

			// Check that we get the signals themselves
			expect('name' in spread).toBe(true)
			expect('age' in spread).toBe(true)
			expect('active' in spread).toBe(true)

			// The spread should contain signals that can be called with .get()
			expect(typeof spread.name?.get).toBe('function')
			expect(typeof spread.age?.get).toBe('function')
			expect(typeof spread.active?.get).toBe('function')

			// The signals should return the correct values
			expect(spread.name?.get()).toBe('Hannah')
			expect(spread.age?.get()).toBe(25)
			expect(spread.active?.get()).toBe(true)

			// Modifying the original store should be reflected in the spread signals
			user.name.set('Alice')
			user.age.set(30)

			expect(spread.name?.get()).toBe('Alice')
			expect(spread.age?.get()).toBe(30)
		})

		test('spreading nested store works correctly', () => {
			const config = createStore({
				app: { name: 'MyApp', version: '1.0' },
				settings: { theme: 'dark', debug: false },
			})

			const spread = { ...config }

			// Should get nested store signals
			expect(isStore(spread.app)).toBe(true)
			expect(isStore(spread.settings)).toBe(true)

			// Should be able to access nested properties
			expect(spread.app.name.get()).toBe('MyApp')
			expect(spread.settings.theme.get()).toBe('dark')

			// Modifications should be reflected
			config.app.name.set('UpdatedApp')
			expect(spread.app.name.get()).toBe('UpdatedApp')
		})
	})

	describe('JSON integration', () => {
		test('seamless integration with JSON.parse() and JSON.stringify() for API workflows', async () => {
			// Simulate loading data from a JSON API response
			const jsonResponse = `{
				"user": {
					"id": 123,
					"name": "John Doe",
					"email": "john@example.com",
					"preferences": {
						"theme": "dark",
						"notifications": true,
						"language": "en"
					}
				},
				"settings": {
					"autoSave": true,
					"timeout": 5000
				},
				"tags": ["developer", "javascript", "typescript"]
			}`

			// Parse JSON and create store - works seamlessly
			const apiData = JSON.parse(jsonResponse)
			const userStore = createStore<{
				user: {
					id: number
					name: string
					email: string
					preferences: {
						theme: string
						notifications: boolean
						language: string
						fontSize?: number
					}
				}
				settings: {
					autoSave: boolean
					timeout: number
				}
				tags: string[]
				lastLogin?: Date
			}>(apiData)

			// Verify initial data is accessible and reactive
			expect(userStore.user.name.get()).toBe('John Doe')
			expect(userStore.user.preferences.theme.get()).toBe('dark')
			expect(userStore.settings.autoSave.get()).toBe(true)
			expect(userStore.get().tags).toEqual([
				'developer',
				'javascript',
				'typescript',
			])

			// Simulate user interactions - update preferences
			userStore.user.preferences.theme.set('light')
			userStore.user.preferences.notifications.set(false)

			// Add new preference
			userStore.user.preferences.add('fontSize', 14)

			// Update settings
			userStore.settings.timeout.set(10000)

			// Add new top-level property
			userStore.add('lastLogin', new Date('2024-01-15T10:30:00Z'))

			// Verify changes are reflected
			expect(userStore.user.preferences.theme.get()).toBe('light')
			expect(userStore.user.preferences.notifications.get()).toBe(false)
			expect(userStore.settings.timeout.get()).toBe(10000)

			// Get current state and verify it's JSON-serializable
			const currentState = userStore.get()
			expect(currentState.user.preferences.theme).toBe('light')
			expect(currentState.user.preferences.notifications).toBe(false)
			expect(currentState.settings.timeout).toBe(10000)
			expect(currentState.tags).toEqual([
				'developer',
				'javascript',
				'typescript',
			])

			// Convert back to JSON - seamless serialization
			const jsonPayload = JSON.stringify(currentState)

			// Verify the JSON contains our updates
			const parsedBack = JSON.parse(jsonPayload)
			expect(parsedBack.user.preferences.theme).toBe('light')
			expect(parsedBack.user.preferences.notifications).toBe(false)
			expect(parsedBack.user.preferences.fontSize).toBe(14)
			expect(parsedBack.settings.timeout).toBe(10000)
			expect(parsedBack.lastLogin).toBe('2024-01-15T10:30:00.000Z')

			// Demonstrate update() for bulk changes
			userStore.update(data => ({
				...data,
				user: {
					...data.user,
					email: 'john.doe@newcompany.com',
					preferences: {
						...data.user.preferences,
						theme: 'auto',
						language: 'fr',
					},
				},
				settings: {
					...data.settings,
					autoSave: false,
				},
			}))

			// Verify bulk update worked
			expect(userStore.user.email.get()).toBe('john.doe@newcompany.com')
			expect(userStore.user.preferences.theme.get()).toBe('auto')
			expect(userStore.user.preferences.language.get()).toBe('fr')
			expect(userStore.settings.autoSave.get()).toBe(false)

			// Final JSON serialization for sending to server
			const finalPayload = JSON.stringify(userStore.get())
			expect(typeof finalPayload).toBe('string')
			expect(finalPayload).toContain('john.doe@newcompany.com')
			expect(finalPayload).toContain('"theme":"auto"')
		})

		test('handles complex nested structures and arrays from JSON', () => {
			const complexJson = `{
				"dashboard": {
					"widgets": [
						{"id": 1, "type": "chart", "config": {"color": "blue"}},
						{"id": 2, "type": "table", "config": {"rows": 10}}
					],
					"layout": {
						"columns": 3,
						"responsive": true
					}
				},
				"metadata": {
					"version": "1.0.0",
					"created": "2024-01-01T00:00:00Z",
					"tags": null
				}
			}`

			const data = JSON.parse(complexJson)

			// Test that null values in initial JSON are filtered out (treated as UNSET)
			const dashboardStore = createStore<{
				dashboard: {
					widgets: {
						id: number
						type: string
						config: Record<string, string | number | boolean>
					}[]
					layout: {
						columns: number
						responsive: boolean
					}
				}
				metadata: {
					version: string
					created: string
					tags?: string[]
				}
			}>(data)

			// Access nested array elements
			expect(dashboardStore.dashboard.widgets.get()).toHaveLength(2)
			expect(dashboardStore.dashboard.widgets[0].type.get()).toBe('chart')
			expect(dashboardStore.dashboard.widgets[1].config.rows.get()).toBe(
				10,
			)

			// Update array element
			dashboardStore.set({
				...dashboardStore.get(),
				dashboard: {
					...dashboardStore.dashboard.get(),
					widgets: [
						...dashboardStore.dashboard.widgets.get(),
						{ id: 3, type: 'graph', config: { animate: true } },
					],
				},
			})

			// Verify array update
			expect(dashboardStore.get().dashboard.widgets).toHaveLength(3)
			expect(dashboardStore.get().dashboard.widgets[2].type).toBe('graph')

			// Test that individual null additions are still prevented via add()
			expect(() => {
				// @ts-expect-error deliberate test case
				dashboardStore.add('newProp', null)
			}).toThrow(
				'Nullish signal values are not allowed in store for key "newProp"',
			)

			// Test that individual property .set() operations prevent null values
			expect(() => {
				dashboardStore.update(data => ({
					...data,
					metadata: {
						...data.metadata,
						// @ts-expect-error deliberate test case
						tags: null,
					},
				}))
			}).toThrow(
				'Nullish signal values are not allowed in store for key "tags"',
			)

			// Update null to actual value (this should work)
			dashboardStore.update(data => ({
				...data,
				metadata: {
					...data.metadata,
					tags: ['production', 'v1'],
				},
			}))

			expect(dashboardStore.get().metadata.tags).toEqual([
				'production',
				'v1',
			])

			// Verify JSON round-trip
			const serialized = JSON.stringify(dashboardStore.get())
			const reparsed = JSON.parse(serialized)
			expect(reparsed.dashboard.widgets).toHaveLength(3)
			expect(reparsed.metadata.tags).toEqual(['production', 'v1'])
		})

		test('demonstrates real-world form data management', () => {
			// Simulate form data loaded from API
			const formData = {
				profile: {
					firstName: '',
					lastName: '',
					email: '',
					bio: '',
				},
				preferences: {
					emailNotifications: true,
					pushNotifications: false,
					marketing: false,
				},
				address: {
					street: '',
					city: '',
					country: 'US',
					zipCode: '',
				},
			}

			const formStore = createStore<{
				profile: {
					id?: number
					createdAt?: string
					firstName: string
					lastName: string
					email: string
					bio: string
				}
				preferences: {
					emailNotifications: boolean
					pushNotifications: boolean
					marketing: boolean
				}
				address: {
					street: string
					city: string
					country: string
					zipCode: string
				}
			}>(formData)

			// Simulate user filling out form
			formStore.profile.firstName.set('Jane')
			formStore.profile.lastName.set('Smith')
			formStore.profile.email.set('jane.smith@example.com')
			formStore.profile.bio.set(
				'Full-stack developer with 5 years experience',
			)

			// Update address
			formStore.address.street.set('123 Main St')
			formStore.address.city.set('San Francisco')
			formStore.address.zipCode.set('94105')

			// Toggle preferences
			formStore.preferences.pushNotifications.set(true)
			formStore.preferences.marketing.set(true)

			// Get form data for submission - ready for JSON.stringify
			const submissionData = formStore.get()

			expect(submissionData.profile.firstName).toBe('Jane')
			expect(submissionData.profile.email).toBe('jane.smith@example.com')
			expect(submissionData.address.city).toBe('San Francisco')
			expect(submissionData.preferences.pushNotifications).toBe(true)

			// Simulate sending to API
			const jsonPayload = JSON.stringify(submissionData)
			expect(jsonPayload).toContain('jane.smith@example.com')
			expect(jsonPayload).toContain('San Francisco')

			// Simulate receiving updated data back from server
			const serverResponse = {
				...submissionData,
				profile: {
					...submissionData.profile,
					id: 456,
					createdAt: '2024-01-15T12:00:00Z',
				},
			}

			// Update store with server response
			formStore.set(serverResponse)

			// Verify server data is integrated
			expect(formStore.profile.id?.get()).toBe(456)
			expect(formStore.profile.createdAt?.get()).toBe(
				'2024-01-15T12:00:00Z',
			)
			expect(formStore.get().profile.firstName).toBe('Jane') // Original data preserved
		})

		describe('Symbol.isConcatSpreadable and polymorphic behavior', () => {
			test('array-like stores have Symbol.isConcatSpreadable true and length property', () => {
				const numbers = createStore([1, 2, 3])

				// Should be concat spreadable
				expect(numbers[Symbol.isConcatSpreadable]).toBe(true)

				// Should have length property
				expect(numbers.length).toBe(3)
				expect(typeof numbers.length).toBe('number')

				// Add an item and verify length updates
				numbers.add(4)
				expect(numbers.length).toBe(4)
			})

			test('object-like stores have Symbol.isConcatSpreadable false and no length property', () => {
				const user = createStore({ name: 'John', age: 25 })

				// Should not be concat spreadable
				expect(user[Symbol.isConcatSpreadable]).toBe(false)

				// Should not have length property
				// @ts-expect-error deliberately accessing non-existent length property
				expect(user.length).toBeUndefined()
				expect('length' in user).toBe(false)
			})

			test('array-like stores iterate over signals only', () => {
				const numbers = createStore([10, 20, 30])
				const signals = [...numbers]

				// Should yield signals, not [key, signal] pairs
				expect(signals).toHaveLength(3)
				expect(signals[0].get()).toBe(10)
				expect(signals[1].get()).toBe(20)
				expect(signals[2].get()).toBe(30)

				// Verify they are signal objects
				signals.forEach(signal => {
					expect(typeof signal.get).toBe('function')
				})
			})

			test('object-like stores iterate over [key, signal] pairs', () => {
				const user = createStore({ name: 'Alice', age: 30 })
				const entries = [...user]

				// Should yield [key, signal] pairs
				expect(entries).toHaveLength(2)

				// Find the name entry
				const nameEntry = entries.find(([key]) => key === 'name')
				expect(nameEntry).toBeDefined()
				expect(nameEntry?.[0]).toBe('name')
				expect(nameEntry?.[1].get()).toBe('Alice')

				// Find the age entry
				const ageEntry = entries.find(([key]) => key === 'age')
				expect(ageEntry).toBeDefined()
				expect(ageEntry?.[0]).toBe('age')
				expect(ageEntry?.[1].get()).toBe(30)
			})

			test('array-like stores support single-parameter add() method', () => {
				const fruits = createStore(['apple', 'banana'])

				// Should add to end without specifying key
				fruits.add('cherry')

				const result = fruits.get()
				expect(result).toEqual(['apple', 'banana', 'cherry'])
				expect(fruits.length).toBe(3)
			})

			test('object-like stores require key parameter for add() method', () => {
				const config = createStore<{
					debug: boolean
					timeout?: number
				}>({
					debug: true,
				})

				// Should require both key and value
				config.add('timeout', 5000)

				expect(config.get()).toEqual({ debug: true, timeout: 5000 })
			})

			test('concat works correctly with array-like stores', () => {
				const numbers = createStore([2, 3])
				const prefix = [createState(1)]
				const suffix = [createState(4), createState(5)]

				// Should spread signals when concat-ed
				const combined = prefix.concat(
					numbers as unknown as ConcatArray<State<number>>,
					suffix,
				)

				expect(combined).toHaveLength(5)
				expect(combined[0].get()).toBe(1)
				expect(combined[1].get()).toBe(2) // from store
				expect(combined[2].get()).toBe(3) // from store
				expect(combined[3].get()).toBe(4)
				expect(combined[4].get()).toBe(5)
			})

			test('spread operator works correctly with array-like stores', () => {
				const numbers = createStore([10, 20])

				// Should spread signals
				const spread = [createState(5), ...numbers, createState(30)]

				expect(spread).toHaveLength(4)
				expect(spread[0].get()).toBe(5)
				expect(spread[1].get()).toBe(10) // from store
				expect(spread[2].get()).toBe(20) // from store
				expect(spread[3].get()).toBe(30)
			})

			test('array-like stores maintain numeric key ordering', () => {
				const items = createStore(['first', 'second', 'third'])

				// Get the keys
				const keys = Object.keys(items)
				expect(keys).toEqual(['0', '1', '2', 'length'])

				// Iteration should be in order
				const signals = [...items]
				expect(signals[0].get()).toBe('first')
				expect(signals[1].get()).toBe('second')
				expect(signals[2].get()).toBe('third')
			})

			test('polymorphic behavior is determined at creation time', () => {
				// Created as array - stays array-like
				const arrayStore = createStore([1, 2])
				expect(arrayStore[Symbol.isConcatSpreadable]).toBe(true)
				expect(arrayStore.length).toBe(2)

				// Created as object - stays object-like
				const objectStore = createStore<{
					a: number
					b: number
					c?: number
				}>({
					a: 1,
					b: 2,
				})
				expect(objectStore[Symbol.isConcatSpreadable]).toBe(false)
				// @ts-expect-error deliberate access to non-existent length property
				expect(objectStore.length).toBeUndefined()

				// Even after modifications, behavior doesn't change
				arrayStore.add(3)
				expect(arrayStore[Symbol.isConcatSpreadable]).toBe(true)

				objectStore.add('c', 3)
				expect(objectStore[Symbol.isConcatSpreadable]).toBe(false)
			})

			test('runtime type detection using typeof length', () => {
				const arrayStore = createStore([1, 2, 3])
				const objectStore = createStore({ x: 1, y: 2 })

				// Can distinguish at runtime
				expect(typeof arrayStore.length === 'number').toBe(true)
				// @ts-expect-error deliberately accessing non-existent length property
				expect(typeof objectStore.length === 'number').toBe(false)
			})

			test('empty stores behave correctly', () => {
				const emptyArray = createStore([])
				const emptyObject = createStore({})

				// Empty array store
				expect(emptyArray[Symbol.isConcatSpreadable]).toBe(true)
				expect(emptyArray.length).toBe(0)
				expect([...emptyArray]).toEqual([])

				// Empty object store
				expect(emptyObject[Symbol.isConcatSpreadable]).toBe(false)
				// @ts-expect-error deliberately accessing non-existent length property
				expect(emptyObject.length).toBeUndefined()
				expect([...emptyObject]).toEqual([])
			})
		})

		test('debug length property issue', () => {
			const numbers = createStore([1, 2, 3])

			// Test length in computed context
			const lengthComputed = createComputed(() => numbers.length)
			numbers.add(4)

			// Test if length property is actually reactive
			expect(numbers.length).toBe(4)
			expect(lengthComputed.get()).toBe(4)
		})
	})

	describe('sort() method', () => {
		test('sorts array-like store with numeric compareFn', () => {
			const numbers = createStore([3, 1, 4, 1, 5])

			// Capture old signal references
			const oldSignals = [
				numbers[0],
				numbers[1],
				numbers[2],
				numbers[3],
				numbers[4],
			]

			numbers.sort((a, b) => a - b)

			// Check sorted order
			expect(numbers.get()).toEqual([1, 1, 3, 4, 5])

			// Verify signal references are preserved (moved, not recreated)
			expect(numbers[0]).toBe(oldSignals[1]) // first 1 was at index 1
			expect(numbers[1]).toBe(oldSignals[3]) // second 1 was at index 3
			expect(numbers[2]).toBe(oldSignals[0]) // 3 was at index 0
			expect(numbers[3]).toBe(oldSignals[2]) // 4 was at index 2
			expect(numbers[4]).toBe(oldSignals[4]) // 5 was at index 4
		})

		test('sorts array-like store with string compareFn', () => {
			const names = createStore(['Charlie', 'Alice', 'Bob'])

			names.sort((a, b) => a.localeCompare(b))

			expect(names.get()).toEqual(['Alice', 'Bob', 'Charlie'])
		})

		test('sorts record-like store by value', () => {
			const users = createStore({
				user1: { name: 'Charlie', age: 25 },
				user2: { name: 'Alice', age: 30 },
				user3: { name: 'Bob', age: 20 },
			})

			// Capture old signal references
			const oldSignals = {
				user1: users.user1,
				user2: users.user2,
				user3: users.user3,
			}

			// Sort by age
			users.sort((a, b) => a.age - b.age)

			// Check order via iteration
			const keys = Array.from(users, ([key]) => key)
			expect(keys).toEqual(['user3', 'user1', 'user2'])

			// Verify signal references are preserved
			expect(users.user1).toBe(oldSignals.user1)
			expect(users.user2).toBe(oldSignals.user2)
			expect(users.user3).toBe(oldSignals.user3)
		})

		test('emits a sort notification with new order', () => {
			const numbers = createStore([30, 10, 20])
			let sortNotification: string[] | null = null

			numbers.on('sort', change => {
				sortNotification = change
			})

			numbers.sort((a, b) => a - b)

			expect(sortNotification).not.toBeNull()
			// Keys in new sorted order: [10, 20, 30] came from indices [1, 2, 0]
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(sortNotification!).toEqual(['1', '2', '0'])
		})

		test('sort is reactive - watchers are notified', () => {
			const numbers = createStore([3, 1, 2])
			let effectCount = 0
			let lastValue: number[] = []

			createEffect(() => {
				lastValue = numbers.get()
				effectCount++
			})

			// Initial effect run
			expect(effectCount).toBe(1)
			expect(lastValue).toEqual([3, 1, 2])

			numbers.sort((a, b) => a - b)

			// Effect should run again after sort
			expect(effectCount).toBe(2)
			expect(lastValue).toEqual([1, 2, 3])
		})

		test('nested signals remain reactive after sorting', () => {
			const items = createStore([
				{ name: 'Charlie', score: 85 },
				{ name: 'Alice', score: 95 },
				{ name: 'Bob', score: 75 },
			])

			// Sort by score
			items.sort((a, b) => b.score - a.score) // descending

			// Verify order
			expect(items.get().map(item => item.name)).toEqual([
				'Alice',
				'Charlie',
				'Bob',
			])

			// Modify a nested property
			items[1].score.set(100) // Charlie's score

			// Verify the change is reflected
			expect(items.get()[1].score).toBe(100)
			expect(items[1].name.get()).toBe('Charlie')
		})

		test('sort with complex nested structures', () => {
			const posts = createStore([
				{
					id: 'post1',
					title: 'Hello World',
					meta: { views: 100, likes: 5 },
				},
				{
					id: 'post2',
					title: 'Getting Started',
					meta: { views: 50, likes: 10 },
				},
				{
					id: 'post3',
					title: 'Advanced Topics',
					meta: { views: 200, likes: 3 },
				},
			])

			// Sort by likes (ascending)
			posts.sort((a, b) => a.meta.likes - b.meta.likes)

			const sortedTitles = posts.get().map(post => post.title)
			expect(sortedTitles).toEqual([
				'Advanced Topics',
				'Hello World',
				'Getting Started',
			])

			// Verify nested reactivity still works
			posts[0].meta.likes.set(15)
			expect(posts.get()[0].meta.likes).toBe(15)
		})

		test('sort preserves array length and size', () => {
			const arr = createStore([5, 2, 8, 1])

			expect(arr.length).toBe(4)
			expect(arr.size.get()).toBe(4)

			arr.sort((a, b) => a - b)

			expect(arr.length).toBe(4)
			expect(arr.size.get()).toBe(4)
			expect(arr.get()).toEqual([1, 2, 5, 8])
		})

		test('sort with no compareFn uses default string sorting like Array.prototype.sort()', () => {
			const items = createStore(['banana', 'cherry', 'apple', '10', '2'])

			items.sort()

			// Default sorting converts to strings and compares in UTF-16 order
			expect(items.get()).toEqual(
				['banana', 'cherry', 'apple', '10', '2'].sort(),
			)
		})

		test('default sort handles numbers as strings like Array.prototype.sort()', () => {
			const numbers = createStore([80, 9, 100])

			numbers.sort()

			// Numbers are converted to strings: "100", "80", "9"
			// In UTF-16 order: "100" < "80" < "9"
			expect(numbers.get()).toEqual([80, 9, 100].sort())
		})

		test('default sort handles mixed values with proper string conversion', () => {
			const mixed = createStore(['b', 0, 'a', '', 'c'])

			mixed.sort()

			// String conversion: '' < '0' < 'a' < 'b' < 'c'
			expect(mixed.get()).toEqual(['', 0, 'a', 'b', 'c'])
		})

		test('multiple sorts work correctly', () => {
			const numbers = createStore([3, 1, 4, 1, 5])

			// Sort ascending
			numbers.sort((a, b) => a - b)
			expect(numbers.get()).toEqual([1, 1, 3, 4, 5])

			// Sort descending
			numbers.sort((a, b) => b - a)
			expect(numbers.get()).toEqual([5, 4, 3, 1, 1])
		})

		test('sort notification contains correct movement mapping for records', () => {
			const users = createStore({
				alice: { age: 30 },
				bob: { age: 20 },
				charlie: { age: 25 },
			})

			let sortNotification: string[] | null = null
			users.on('sort', change => {
				sortNotification = change
			})

			// Sort by age
			users.sort((a, b) => b.age - a.age)

			expect(sortNotification).not.toBeNull()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(sortNotification!).toEqual(['alice', 'charlie', 'bob'])
		})
	})

	describe('cross-component communication pattern', () => {
		test('event bus with UNSET initialization - type-safe pattern', () => {
			// Component B (the owner) declares the shape of events it will emit
			type EventBusSchema = {
				userLogin: { userId: number; timestamp: number }
				userLogout: { userId: number }
				userUpdate: { userId: number; profile: { name: string } }
			}

			// Initialize the event bus with proper typing
			const eventBus = createStore<EventBusSchema>({
				userLogin: UNSET,
				userLogout: UNSET,
				userUpdate: UNSET,
			})

			// Simple type-safe on functions
			const on = (
				event: keyof EventBusSchema,
				callback: (data: EventBusSchema[keyof EventBusSchema]) => void,
			) =>
				createEffect(() => {
					const data = eventBus[event].get()
					if (data !== UNSET) callback(data)
				})

			// Test the pattern with properly typed variables
			let receivedLogin: unknown = null
			let receivedLogout: unknown = null
			let receivedUpdate: unknown = null

			// Component A listens for events
			on('userLogin', data => {
				receivedLogin = data
			})

			on('userLogout', data => {
				receivedLogout = data
			})

			on('userUpdate', data => {
				receivedUpdate = data
			})

			// Initially nothing should be received (all UNSET)
			expect(receivedLogin).toBe(null)
			expect(receivedLogout).toBe(null)
			expect(receivedUpdate).toBe(null)

			// Component B emits user events with full type safety
			const loginData: EventBusSchema['userLogin'] = {
				userId: 123,
				timestamp: Date.now(),
			}
			eventBus.userLogin.set(loginData)

			expect(receivedLogin).toEqual(loginData)
			expect(receivedLogout).toBe(null) // Should not have triggered
			expect(receivedUpdate).toBe(null) // Should not have triggered

			// Test second event
			const logoutData: EventBusSchema['userLogout'] = { userId: 123 }
			eventBus.userLogout.set(logoutData)

			expect(receivedLogout).toEqual(logoutData)
			expect(receivedLogin).toEqual(loginData) // Should remain unchanged

			// Test third event
			const updateData: EventBusSchema['userUpdate'] = {
				userId: 456,
				profile: { name: 'Alice' },
			}
			eventBus.userUpdate.set(updateData)

			expect(receivedUpdate).toEqual(updateData)
			expect(receivedLogin).toEqual(loginData) // Should remain unchanged
			expect(receivedLogout).toEqual(logoutData) // Should remain unchanged

			// Test updating existing event
			const newLoginData: EventBusSchema['userLogin'] = {
				userId: 789,
				timestamp: Date.now(),
			}
			eventBus.userLogin.set(newLoginData)

			expect(receivedLogin).toEqual(newLoginData) // Should update
			expect(receivedLogout).toEqual(logoutData) // Should remain unchanged
			expect(receivedUpdate).toEqual(updateData) // Should remain unchanged

			// Compile-time type checking prevents errors:
			// emitUserLogin({ userId: 'invalid' }) // ❌ TypeScript error
			// emitUserLogin({ userId: 123, extraProp: 'invalid' }) // ❌ TypeScript error
			// emitUserLogout({ userId: 123, extraProp: 'invalid' }) // ❌ TypeScript error
		})
	})
})
