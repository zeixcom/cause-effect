import { describe, expect, test } from 'bun:test'
import {
	BaseStore,
	createEffect,
	createStore,
	isStore,
	Memo,
	State,
	UNSET,
} from '../../index.ts'

describe('store', () => {
	describe('creation and basic operations', () => {
		test('creates BaseStore with initial values', () => {
			const user = new BaseStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(user.byKey('name').get()).toBe('Hannah')
			expect(user.byKey('email').get()).toBe('hannah@example.com')
		})

		test('creates stores with initial values', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(user.name.get()).toBe('Hannah')
			expect(user.email.get()).toBe('hannah@example.com')
		})

		test('has Symbol.toStringTag of Store', () => {
			const store = createStore({ a: 1 })
			expect(store[Symbol.toStringTag]).toBe('Store')
		})

		test('isStore identifies store instances correctly', () => {
			const store = createStore({ a: 1 })
			const state = new State(1)
			const computed = new Memo(() => 1)

			expect(isStore(store)).toBe(true)
			expect(isStore(state)).toBe(false)
			expect(isStore(computed)).toBe(false)
			expect(isStore({})).toBe(false)
		})

		test('get() returns the complete store value', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			expect(user.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
		})
	})

	describe('proxy data access and modification', () => {
		test('properties can be accessed and modified via signals', () => {
			const user = createStore({ name: 'John', age: 30 })
			expect(user.name.get()).toBe('John')
			expect(user.age.get()).toBe(30)

			user.name.set('Alicia')
			user.age.set(31)
			expect(user.name.get()).toBe('Alicia')
			expect(user.age.get()).toBe(31)
		})

		test('returns undefined for non-existent properties', () => {
			const user = createStore({ name: 'Alice' })
			// @ts-expect-error accessing non-existent property
			expect(user.nonexistent).toBeUndefined()
		})

		test('supports string key access', () => {
			const items = createStore({ first: 'alpha', second: 'beta' })
			expect(items.first.get()).toBe('alpha')
			expect(items.second.get()).toBe('beta')
		})
	})

	describe('add() and remove() methods', () => {
		test('add() method adds new properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			user.add('email', 'john@example.com')
			expect(user.byKey('email')?.get()).toBe('john@example.com')
			expect(user.email?.get()).toBe('john@example.com')
		})

		test('remove() method removes properties', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
				email: 'john@example.com',
			})
			user.remove('email')
			expect(user.byKey('email')).toBeUndefined()
			// expect(user.byKey('name').get()).toBe('John')
			expect(user.email).toBeUndefined()
			// expect(user.name.get()).toBe('John')
		})

		test('add method prevents null values', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			// @ts-expect-error testing null values
			expect(() => user.add('email', null)).toThrow()
		})

		test('add method prevents overwriting existing properties', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			expect(() => user.add('name', 'Jane')).toThrow()
		})

		test('remove method handles non-existent properties gracefully', () => {
			const user = createStore({ name: 'John' })
			expect(() => user.remove('nonexistent')).not.toThrow()
		})
	})

	describe('nested stores', () => {
		test('creates nested stores for object properties', () => {
			const user = createStore({
				name: 'Alice',
				preferences: {
					theme: 'light',
					notifications: true,
				},
			})

			expect(user.name.get()).toBe('Alice')
			expect(user.preferences.theme.get()).toBe('light')
			expect(user.preferences.notifications.get()).toBe(true)
		})

		test('nested properties are reactive', () => {
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
		})

		test('deeply nested stores work correctly', () => {
			const config = createStore({
				ui: {
					theme: {
						colors: {
							primary: '#007acc',
						},
					},
				},
			})

			expect(config.ui.theme.colors.primary.get()).toBe('#007acc')
			config.ui.theme.colors.primary.set('#ff6600')
			expect(config.ui.theme.colors.primary.get()).toBe('#ff6600')
		})
	})

	describe('set() and update() methods', () => {
		test('set() replaces entire store value', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			user.set({ name: 'Jane', email: 'jane@example.com' })
			expect(user.name.get()).toBe('Jane')
			expect(user.email.get()).toBe('jane@example.com')
		})

		test('update() modifies store using function', () => {
			const user = createStore({ name: 'John', age: 25 })
			user.update(u => ({ ...u, age: u.age + 1 }))
			expect(user.name.get()).toBe('John')
			expect(user.age.get()).toBe(26)
		})
	})

	describe('iteration protocol', () => {
		test('supports for...of iteration', () => {
			const user = createStore({ name: 'John', age: 25 })
			const entries = [...user]
			expect(entries).toHaveLength(2)
			expect(entries[0][0]).toBe('name')
			expect(entries[0][1].get()).toBe('John')
			expect(entries[1][0]).toBe('age')
			expect(entries[1][1].get()).toBe(25)
		})

		test('Symbol.isConcatSpreadable is false', () => {
			const user = createStore({ name: 'John', age: 25 })
			expect(user[Symbol.isConcatSpreadable]).toBe(false)
		})

		test('maintains property key ordering', () => {
			const config = createStore({ alpha: 1, beta: 2, gamma: 3 })
			const keys = Object.keys(config)
			expect(keys).toEqual(['alpha', 'beta', 'gamma'])

			const entries = [...config]
			expect(entries.map(([key, signal]) => [key, signal.get()])).toEqual(
				[
					['alpha', 1],
					['beta', 2],
					['gamma', 3],
				],
			)
		})
	})

	describe('reactivity', () => {
		test('store-level get() is reactive', () => {
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
			user.email.set('jane@example.com')

			expect(lastValue).toEqual({
				name: 'Jane',
				email: 'jane@example.com',
			})
		})

		test('individual signal reactivity works', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let lastName = ''
			let nameEffectRuns = 0
			createEffect(() => {
				lastName = user.name.get()
				nameEffectRuns++
			})

			expect(lastName).toBe('John')
			expect(nameEffectRuns).toBe(1)

			user.name.set('Jane')
			expect(lastName).toBe('Jane')
			expect(nameEffectRuns).toBe(2)
		})

		test('nested store changes propagate to parent', () => {
			const user = createStore({
				preferences: {
					theme: 'light',
				},
			})
			let effectRuns = 0
			createEffect(() => {
				user.get()
				effectRuns++
			})

			expect(effectRuns).toBe(1)
			user.preferences.theme.set('dark')
			expect(effectRuns).toBe(2)
		})

		test('updates are reactive', () => {
			const user = createStore({
				name: 'John',
			})
			let lastValue: {
				name: string
				email?: string
			} = { name: '' }
			let effectRuns = 0
			createEffect(() => {
				lastValue = user.get()
				effectRuns++
			})

			expect(lastValue).toEqual({ name: 'John' })
			expect(effectRuns).toBe(1)

			user.update(u => ({ ...u, email: 'john@example.com' }))
			expect(lastValue).toEqual({
				name: 'John',
				email: 'john@example.com',
			})
			expect(effectRuns).toBe(2)
		})

		test('remove method is reactive', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
				age: 30,
			})
			let lastValue: {
				name: string
				email?: string
				age?: number
			} = { name: '', email: '', age: 0 }
			let effectRuns = 0
			createEffect(() => {
				lastValue = user.get()
				effectRuns++
			})

			expect(lastValue).toEqual({
				name: 'John',
				email: 'john@example.com',
				age: 30,
			})
			expect(effectRuns).toBe(1)

			user.remove('email')
			expect(lastValue).toEqual({ name: 'John', age: 30 })
			expect(effectRuns).toBe(2)
		})
	})

	describe('computed integration', () => {
		test('works with computed signals', () => {
			const user = createStore({
				firstName: 'John',
				lastName: 'Doe',
			})
			const fullName = new Memo(
				() => `${user.firstName.get()} ${user.lastName.get()}`,
			)

			expect(fullName.get()).toBe('John Doe')
			user.firstName.set('Jane')
			expect(fullName.get()).toBe('Jane Doe')
		})

		test('computed reacts to nested store changes', () => {
			const config = createStore({
				ui: {
					theme: 'light',
				},
			})
			const themeDisplay = new Memo(
				() => `Theme: ${config.ui.theme.get()}`,
			)

			expect(themeDisplay.get()).toBe('Theme: light')
			config.ui.theme.set('dark')
			expect(themeDisplay.get()).toBe('Theme: dark')
		})
	})

	describe('proxy behavior and enumeration', () => {
		test('Object.keys returns property keys', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			const userKeys = Object.keys(user)
			expect(userKeys.sort()).toEqual(['email', 'name'])
		})

		test('property enumeration works', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			const userKeys: string[] = []
			for (const key in user) {
				userKeys.push(key)
			}
			expect(userKeys.sort()).toEqual(['email', 'name'])
		})

		test('in operator works', () => {
			const user = createStore({ name: 'Alice' })
			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
		})

		test('Object.getOwnPropertyDescriptor works', () => {
			const user = createStore({ name: 'Alice' })
			const nameDescriptor = Object.getOwnPropertyDescriptor(user, 'name')
			expect(nameDescriptor).toEqual({
				enumerable: true,
				configurable: true,
				writable: true,
				value: user.name,
			})
		})
	})

	describe('byKey() method', () => {
		test('works with property keys', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
				age: 30,
			})

			const nameSignal = user.byKey('name')
			const emailSignal = user.byKey('email')
			const ageSignal = user.byKey('age')
			// @ts-expect-error deliberate access for nonexistent key
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

		test('works with nested stores', () => {
			const app = createStore({
				config: {
					version: '1.0.0',
				},
			})

			const configStore = app.byKey('config')
			expect(configStore?.get()).toEqual({ version: '1.0.0' })
			expect(configStore).toBe(app.config)
		})

		test('is reactive and works with computed signals', () => {
			const user = createStore<{
				name: string
				age: number
			}>({
				name: 'Alice',
				age: 30,
			})

			const nameSignal = user.byKey('name')
			const displayName = new Memo(() =>
				nameSignal ? `Hello, ${nameSignal.get()}!` : 'Unknown',
			)

			expect(displayName.get()).toBe('Hello, Alice!')
			nameSignal?.set('Bob')
			expect(displayName.get()).toBe('Hello, Bob!')
		})
	})

	describe('UNSET and edge cases', () => {
		test('handles UNSET values', () => {
			const store = createStore({ value: UNSET })
			expect(store.get()).toEqual({ value: UNSET })
		})

		test('handles primitive values', () => {
			const store = createStore({
				str: 'hello',
				num: 42,
				bool: true,
			})
			expect(store.str.get()).toBe('hello')
			expect(store.num.get()).toBe(42)
			expect(store.bool.get()).toBe(true)
		})

		test('handles empty stores correctly', () => {
			const empty = createStore({})
			expect(empty.get()).toEqual({})
		})
	})

	describe('JSON integration and serialization', () => {
		test('seamless JSON integration', () => {
			const jsonData = {
				user: { name: 'Alice', preferences: { theme: 'dark' } },
				settings: { timeout: 5000 },
			}
			const store = createStore(jsonData)

			expect(store.user.name.get()).toBe('Alice')
			expect(store.user.preferences.theme.get()).toBe('dark')
			expect(store.settings.timeout.get()).toBe(5000)

			const serialized = JSON.stringify(store.get())
			const parsed = JSON.parse(serialized)
			expect(parsed).toEqual(jsonData)
		})

		test('handles complex nested structures from JSON', () => {
			type Dashboard = {
				dashboard: {
					widgets: Array<{
						id: string
						type: string
						config: { color?: string; rows?: number }
					}>
				}
			}

			const complexData: Dashboard = {
				dashboard: {
					widgets: [
						{ id: '1', type: 'chart', config: { color: 'blue' } },
						{ id: '2', type: 'table', config: { rows: 10 } },
					],
				},
			}

			const store = createStore(complexData)
			expect(store.dashboard.widgets.at(0)?.get().config.color).toBe(
				'blue',
			)
			expect(store.dashboard.widgets.at(1)?.get().config.rows).toBe(10)
		})
	})

	describe('type conversion and nested stores', () => {
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

	describe('Watch Callbacks', () => {
		test('Root store watched callback triggered only by direct store access', async () => {
			let rootStoreCounter = 0
			let intervalId: Timer | undefined
			const store = createStore(
				{
					user: {
						name: 'John',
						profile: {
							email: 'john@example.com',
						},
					},
				},
				{
					watched: () => {
						intervalId = setInterval(() => {
							rootStoreCounter++
						}, 10)
					},
					unwatched: () => {
						if (intervalId) {
							clearInterval(intervalId)
							intervalId = undefined
						}
					},
				},
			)

			expect(rootStoreCounter).toBe(0)
			await new Promise(resolve => setTimeout(resolve, 50))
			expect(rootStoreCounter).toBe(0)

			// Access nested property directly - should NOT trigger root watched callback
			const nestedEffectCleanup = createEffect(() => {
				store.user.name.get()
			})

			await new Promise(resolve => setTimeout(resolve, 50))
			expect(rootStoreCounter).toBe(0) // Still 0 - nested access doesn't trigger root
			expect(intervalId).toBeUndefined()

			// Access root store directly - should trigger watched callback
			const rootEffectCleanup = createEffect(() => {
				store.get()
			})

			await new Promise(resolve => setTimeout(resolve, 50))
			expect(rootStoreCounter).toBeGreaterThan(0) // Now triggered
			expect(intervalId).toBeDefined()

			// Cleanup
			rootEffectCleanup()
			nestedEffectCleanup()
			await new Promise(resolve => setTimeout(resolve, 50))
			expect(intervalId).toBeUndefined()
		})

		test('Store property addition/removal affects store watched callback', async () => {
			let usersStoreCounter = 0
			const store = createStore(
				{
					users: {} as Record<string, { name: string }>,
				},
				{
					watched: () => {
						usersStoreCounter++
					},
					unwatched: () => {
						usersStoreCounter--
					},
				},
			)

			expect(usersStoreCounter).toBe(0)

			// Watch the entire store
			const usersEffect = createEffect(() => {
				store.get()
			})
			expect(usersStoreCounter).toBe(1)

			// Add a user - this modifies the users store content but doesn't affect watched callback
			store.users.add('user1', { name: 'Alice' })
			expect(usersStoreCounter).toBe(1) // Still 1

			// Watch a specific user property - this doesn't trigger users store watched callback
			const userEffect = createEffect(() => {
				store.users.user1?.name.get()
			})
			expect(usersStoreCounter).toBe(1) // Still 1

			// Cleanup user effect
			userEffect()
			expect(usersStoreCounter).toBe(1) // Still active due to usersEffect

			// Cleanup users effect
			usersEffect()
			expect(usersStoreCounter).toBe(0) // Now cleaned up
		})
	})
})
