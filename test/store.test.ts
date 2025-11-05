import { describe, expect, test } from 'bun:test'
import {
	computed,
	effect,
	isStore,
	type StoreAddEvent,
	type StoreChangeEvent,
	type StoreRemoveEvent,
	state,
	store,
	UNSET,
	arrayToRecord,
} from '..'

describe('store', () => {
	describe('creation and basic operations', () => {
		test('creates a store with initial values', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })

			expect(user.name.get()).toBe('Hannah')
			expect(user.email.get()).toBe('hannah@example.com')
		})

		test('has Symbol.toStringTag of Store', () => {
			const s = store({ a: 1 })
			expect(s[Symbol.toStringTag]).toBe('Store')
		})

		test('isStore identifies store instances correctly', () => {
			const s = store({ a: 1 })
			const st = state(1)
			const c = computed(() => 1)

			expect(isStore(s)).toBe(true)
			expect(isStore(st)).toBe(false)
			expect(isStore(c)).toBe(false)
			expect(isStore({})).toBe(false)
			expect(isStore(null)).toBe(false)
		})

		test('get() returns the complete store value', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })

			expect(user.get()).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			const participants = store(
				arrayToRecord([
					{ name: 'Alice', tags: ['friends', 'mates'] },
					{ name: 'Bob', tags: ['friends'] },
				]),
			)
			expect(participants.get()).toEqual([
				{ name: 'Alice', tags: ['friends', 'mates'] },
				{ name: 'Bob', tags: ['friends'] },
			])
		})
	})

	describe('proxy data access and modification', () => {
		test('properties can be accessed and modified via signals', () => {
			const user = store({ name: 'Hannah', age: 25 })

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
			const user = store({ name: 'Hannah' })

			// @ts-expect-error accessing non-existent property
			expect(user.nonExistent).toBeUndefined()
		})

		test('supports numeric key access', () => {
			const items = store({ '0': 'first', '1': 'second' })

			expect(items[0].get()).toBe('first')
			expect(items['0'].get()).toBe('first')
			expect(items[1].get()).toBe('second')
			expect(items['1'].get()).toBe('second')
		})

		test('can add new properties via add method', () => {
			const user = store<{ name: string; email?: string }>({
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
			const user = store<{ name: string; email?: string }>({
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
	})

	describe('nested stores', () => {
		test('creates nested stores for object properties', () => {
			const user = store({
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
			const user = store({
				preferences: {
					theme: 'dark',
				},
			})

			user.preferences.theme.set('light')
			expect(user.preferences.theme.get()).toBe('light')
			expect(user.get().preferences.theme).toBe('light')
		})

		test('deeply nested stores work correctly', () => {
			const config = store({
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
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })

			user.set({ name: 'Alice', email: 'alice@example.com' })

			expect(user.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
		})

		test('update() modifies store using function', () => {
			const user = store({ name: 'Hannah', age: 25 })

			user.update(prev => ({ ...prev, age: prev.age + 1 }))

			expect(user.get()).toEqual({
				name: 'Hannah',
				age: 26,
			})
		})
	})

	describe('iterator protocol', () => {
		test('supports for...of iteration', () => {
			const user = store({ name: 'Hannah', age: 25 })
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
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			expect(user.size.get()).toBe(1)

			user.add('email', 'hannah@example.com')
			expect(user.size.get()).toBe(2)

			user.remove('email')
			expect(user.size.get()).toBe(1)
		})

		test('dispatches store-add event on initial creation', async () => {
			let addEvent: StoreAddEvent<{ name: string }> | null = null
			const user = store({ name: 'Hannah' })

			user.addEventListener('store-add', event => {
				addEvent = event
			})

			// Wait for the async initial event
			await new Promise(resolve => setTimeout(resolve, 10))

			expect(addEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addEvent!.detail).toEqual({ name: 'Hannah' })
		})

		test('dispatches store-add event for new properties', () => {
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			let addEvent: StoreAddEvent<{
				name: string
				email?: string
			}> | null = null
			user.addEventListener('store-add', event => {
				addEvent = event
			})

			user.update(v => ({ ...v, email: 'hannah@example.com' }))

			expect(addEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addEvent!.detail).toEqual({
				email: 'hannah@example.com',
			})
		})

		test('dispatches store-change event for property changes', () => {
			const user = store({ name: 'Hannah' })

			let changeEvent: StoreChangeEvent<{ name: string }> | null = null
			user.addEventListener('store-change', event => {
				changeEvent = event
			})

			user.set({ name: 'Alice' })

			expect(changeEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(changeEvent!.detail).toEqual({
				name: 'Alice',
			})
		})

		test('dispatches store-change event for signal changes', () => {
			const user = store({ name: 'Hannah' })

			let changeEvent: StoreChangeEvent<{ name: string }> | null = null
			user.addEventListener('store-change', event => {
				changeEvent = event
			})

			user.name.set('Bob')

			expect(changeEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(changeEvent!.detail).toEqual({
				name: 'Bob',
			})
		})

		test('dispatches store-remove event for removed properties', () => {
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'hannah@example.com',
			})

			let removeEvent: StoreRemoveEvent<{
				name: string
				email?: string
			}> | null = null
			user.addEventListener('store-remove', event => {
				removeEvent = event
			})

			user.remove('email')

			expect(removeEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(removeEvent!.detail.email).toBe(UNSET)
		})

		test('dispatches store-add event when using add method', () => {
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			let addEvent: StoreAddEvent<{
				name: string
				email?: string
			}> | null = null
			user.addEventListener('store-add', event => {
				addEvent = event
			})

			user.add('email', 'hannah@example.com')

			expect(addEvent).toBeTruthy()
			// biome-ignore lint/style/noNonNullAssertion: test
			expect(addEvent!.detail).toEqual({
				email: 'hannah@example.com',
			})
		})

		test('can remove event listeners', () => {
			const user = store({ name: 'Hannah' })

			let eventCount = 0
			const listener = () => {
				eventCount++
			}

			user.addEventListener('store-change', listener)
			user.name.set('Alice')
			expect(eventCount).toBe(1)

			user.removeEventListener('store-change', listener)
			user.name.set('Bob')
			expect(eventCount).toBe(1) // Should not increment
		})

		test('supports multiple event listeners for the same event', () => {
			const user = store({ name: 'Hannah' })

			let listener1Called = false
			let listener2Called = false

			user.addEventListener('store-change', () => {
				listener1Called = true
			})

			user.addEventListener('store-change', () => {
				listener2Called = true
			})

			user.name.set('Alice')

			expect(listener1Called).toBe(true)
			expect(listener2Called).toBe(true)
		})
	})

	describe('reactivity', () => {
		test('store-level get() is reactive', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })
			let lastValue = { name: '', email: '' }

			effect(() => {
				lastValue = user.get()
			})

			user.name.set('Alice')

			expect(lastValue).toEqual({
				name: 'Alice',
				email: 'hannah@example.com',
			})
		})

		test('individual signal reactivity works', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })
			let lastName = ''
			let nameEffectRuns = 0

			// Get signal for name property directly
			const nameSignal = user.name

			effect(() => {
				lastName = nameSignal.get()
				nameEffectRuns++
			})

			// Change name should trigger effect
			user.name.set('Alice')
			expect(lastName).toBe('Alice')
			expect(nameEffectRuns).toBe(2) // Initial + update
		})

		test('nested store changes propagate to parent', () => {
			const user = store({
				preferences: {
					theme: 'dark',
				},
			})
			let effectRuns = 0

			effect(() => {
				user.get() // Watch entire store
				effectRuns++
			})

			user.preferences.theme.set('light')
			expect(effectRuns).toBe(2) // Initial + nested change
		})

		test('updates are reactive', () => {
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
			})
			let lastValue = {}
			let effectRuns = 0

			effect(() => {
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
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			let lastValue = {}
			let effectRuns = 0

			effect(() => {
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
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
				email: 'original@example.com',
			})

			const originalSize = user.size.get()
			user.add('email', 'new@example.com')

			expect(user.email?.get()).toBe('original@example.com')
			expect(user.size.get()).toBe(originalSize)
		})

		test('remove method has no effect on non-existent properties', () => {
			const user = store<{ name: string; email?: string }>({
				name: 'Hannah',
			})

			const originalSize = user.size.get()
			user.remove('email')

			expect(user.size.get()).toBe(originalSize)
		})
	})

	describe('computed integration', () => {
		test('works with computed signals', () => {
			const user = store({ firstName: 'Hannah', lastName: 'Smith' })

			const fullName = computed(() => {
				return `${user.firstName.get()} ${user.lastName.get()}`
			})

			expect(fullName.get()).toBe('Hannah Smith')

			user.firstName.set('Alice')
			expect(fullName.get()).toBe('Alice Smith')
		})

		test('computed reacts to nested store changes', () => {
			const config = store({
				ui: {
					theme: 'dark',
				},
			})

			const themeDisplay = computed(() => {
				return `Theme: ${config.ui.theme.get()}`
			})

			expect(themeDisplay.get()).toBe('Theme: dark')

			config.ui.theme.set('light')
			expect(themeDisplay.get()).toBe('Theme: light')
		})
	})

	describe('arrays and edge cases', () => {
		test('handles arrays as store values', () => {
			const data = store({ items: [1, 2, 3] })

			// Arrays become stores with string indices
			expect(isStore(data.items)).toBe(true)
			expect(data.items['0'].get()).toBe(1)
			expect(data.items['1'].get()).toBe(2)
			expect(data.items['2'].get()).toBe(3)
		})

		test('array-derived nested stores have correct type inference', () => {
			const todoApp = store({
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
			const data = store({ value: UNSET as string })

			expect(data.value.get()).toBe(UNSET)
			data.value.set('some string')
			expect(data.value.get()).toBe('some string')
		})

		test('handles primitive values', () => {
			const data = store({
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
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })

			expect(Object.keys(user)).toEqual(['name', 'email'])
		})

		test('property enumeration works', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })
			const keys: string[] = []

			for (const key in user) {
				keys.push(key)
			}

			expect(keys).toEqual(['name', 'email'])
		})

		test('in operator works', () => {
			const user = store({ name: 'Hannah' })

			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
		})

		test('Object.getOwnPropertyDescriptor works', () => {
			const user = store({ name: 'Hannah' })

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
			const fruits = store({ items: ['apple', 'banana', 'cherry'] })

			expect(isStore(fruits.items)).toBe(true)
			expect(fruits.items['0'].get()).toBe('apple')
			expect(fruits.items['1'].get()).toBe('banana')
			expect(fruits.items['2'].get()).toBe('cherry')
		})

		test('nested objects become nested stores', () => {
			const config = store({
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
			const user = store({ name: 'Hannah', age: 25, active: true })

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
			const config = store({
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
})
