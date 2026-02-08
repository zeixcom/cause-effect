import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createState,
	createStore,
	isList,
	isStore,
} from '../next.ts'

describe('Store', () => {
	describe('createStore', () => {
		test('should create a store with initial values', () => {
			const user = createStore({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(user.name.get()).toBe('Hannah')
			expect(user.email.get()).toBe('hannah@example.com')
		})

		test('should create nested stores for object properties', () => {
			const user = createStore({
				name: 'Alice',
				preferences: { theme: 'light', notifications: true },
			})
			expect(isStore(user.preferences)).toBe(true)
			expect(user.preferences.theme.get()).toBe('light')
			expect(user.preferences.notifications.get()).toBe(true)
		})

		test('should create lists for array properties', () => {
			const data = createStore({ tags: ['a', 'b', 'c'] })
			expect(isList(data.tags)).toBe(true)
			expect(data.tags.get()).toEqual(['a', 'b', 'c'])
		})

		test('should handle deeply nested objects', () => {
			const config = createStore({
				ui: { theme: { colors: { primary: '#007acc' } } },
			})
			expect(config.ui.theme.colors.primary.get()).toBe('#007acc')
			config.ui.theme.colors.primary.set('#ff6600')
			expect(config.ui.theme.colors.primary.get()).toBe('#ff6600')
		})

		test('should handle empty initial value', () => {
			const empty = createStore({})
			expect(empty.get()).toEqual({})
		})

		test('should have Symbol.toStringTag of "Store"', () => {
			const store = createStore({ a: 1 })
			expect(store[Symbol.toStringTag]).toBe('Store')
		})

		test('should have Symbol.isConcatSpreadable set to false', () => {
			const store = createStore({ a: 1 })
			expect(store[Symbol.isConcatSpreadable]).toBe(false)
		})
	})

	describe('isStore', () => {
		test('should return true for store instances', () => {
			const store = createStore({ a: 1 })
			expect(isStore(store)).toBe(true)
		})

		test('should return false for non-store values', () => {
			expect(isStore(createState(1))).toBe(false)
			expect(isStore(createMemo(() => 1))).toBe(false)
			expect(isStore({})).toBe(false)
			expect(isStore(null)).toBe(false)
		})
	})

	describe('get', () => {
		test('should return the complete store value', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			expect(user.get()).toEqual({
				name: 'Alice',
				email: 'alice@example.com',
			})
		})

		test('should return updated value after property changes', () => {
			const user = createStore({ name: 'Alice', age: 30 })
			user.name.set('Bob')
			expect(user.get()).toEqual({ name: 'Bob', age: 30 })
		})
	})

	describe('set', () => {
		test('should replace entire store value', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			user.set({ name: 'Jane', email: 'jane@example.com' })
			expect(user.name.get()).toBe('Jane')
			expect(user.email.get()).toBe('jane@example.com')
		})

		test('should diff and apply granular changes', () => {
			const user = createStore({ name: 'John', age: 25 })
			let nameRuns = 0
			let ageRuns = 0
			createEffect(() => {
				user.name.get()
				nameRuns++
			})
			createEffect(() => {
				user.age.get()
				ageRuns++
			})
			expect(nameRuns).toBe(1)
			expect(ageRuns).toBe(1)

			// Only change age — name effect should not re-run
			user.set({ name: 'John', age: 26 })
			expect(nameRuns).toBe(1)
			expect(ageRuns).toBe(2)
		})

		test('should not propagate when value is identical', () => {
			const store = createStore({ x: 1 })
			let runs = 0
			createEffect(() => {
				store.get()
				runs++
			})
			expect(runs).toBe(1)

			store.set({ x: 1 })
			expect(runs).toBe(1)
		})
	})

	describe('update', () => {
		test('should modify store using callback', () => {
			const user = createStore({ name: 'John', age: 25 })
			user.update(u => ({ ...u, age: u.age + 1 }))
			expect(user.name.get()).toBe('John')
			expect(user.age.get()).toBe(26)
		})
	})

	describe('add', () => {
		test('should add a new property', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			user.add('email', 'john@example.com')
			expect(user.email?.get()).toBe('john@example.com')
			expect(user.byKey('email')?.get()).toBe('john@example.com')
		})

		test('should throw DuplicateKeyError for existing key', () => {
			const user = createStore({ name: 'John' })
			expect(() => user.add('name', 'Jane')).toThrow()
		})

		test('should be reactive', () => {
			const store = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			let lastValue: { name: string; email?: string } = { name: '' }
			createEffect(() => {
				lastValue = store.get()
			})
			expect(lastValue).toEqual({ name: 'John' })

			store.add('email', 'john@example.com')
			expect(lastValue).toEqual({
				name: 'John',
				email: 'john@example.com',
			})
		})
	})

	describe('remove', () => {
		test('should remove an existing property', () => {
			const user = createStore<{ name: string; email?: string }>({
				name: 'John',
				email: 'john@example.com',
			})
			user.remove('email')
			expect(user.byKey('email')).toBeUndefined()
			expect(user.email).toBeUndefined()
		})

		test('should handle non-existent key gracefully', () => {
			const store = createStore({ name: 'John' })
			expect(() => store.remove('nonexistent')).not.toThrow()
		})

		test('should be reactive', () => {
			const store = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let lastValue: { name: string; email?: string } = {
				name: '',
				email: '',
			}
			let runs = 0
			createEffect(() => {
				lastValue = store.get()
				runs++
			})
			expect(runs).toBe(1)

			store.remove('email')
			expect(lastValue).toEqual({ name: 'John' })
			expect(runs).toBe(2)
		})
	})

	describe('byKey', () => {
		test('should return the signal for a property', () => {
			const user = createStore({ name: 'Alice', age: 30 })
			const nameSignal = user.byKey('name')
			expect(nameSignal?.get()).toBe('Alice')
			expect(nameSignal).toBe(user.name)
		})

		test('should return nested store for object property', () => {
			const app = createStore({ config: { version: '1.0.0' } })
			const configStore = app.byKey('config')
			expect(isStore(configStore)).toBe(true)
			expect(configStore).toBe(app.config)
		})

		test('should return undefined for non-existent key', () => {
			const store = createStore({ name: 'Alice' })
			// @ts-expect-error deliberate access for nonexistent key
			expect(store.byKey('nonexistent')).toBeUndefined()
		})
	})

	describe('keys', () => {
		test('should return an iterator of property keys', () => {
			const store = createStore({ alpha: 1, beta: 2, gamma: 3 })
			expect(Array.from(store.keys())).toEqual(['alpha', 'beta', 'gamma'])
		})

		test('should reflect additions and removals', () => {
			const store = createStore<{ a: number; b?: number }>({ a: 1 })
			expect(Array.from(store.keys())).toEqual(['a'])

			store.add('b', 2)
			expect(Array.from(store.keys())).toEqual(['a', 'b'])

			store.remove('b')
			expect(Array.from(store.keys())).toEqual(['a'])
		})
	})

	describe('Proxy Behavior', () => {
		test('should access properties directly as signals', () => {
			const user = createStore({ name: 'John', age: 30 })
			expect(user.name.get()).toBe('John')
			expect(user.age.get()).toBe(30)

			user.name.set('Alicia')
			expect(user.name.get()).toBe('Alicia')
		})

		test('should return undefined for non-existent properties', () => {
			const user = createStore({ name: 'Alice' })
			// @ts-expect-error accessing non-existent property
			expect(user.nonexistent).toBeUndefined()
		})

		test('should support "in" operator', () => {
			const user = createStore({ name: 'Alice' })
			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
		})

		test('should support Object.keys()', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			expect(Object.keys(user).sort()).toEqual(['email', 'name'])
		})

		test('should support for...in enumeration', () => {
			const user = createStore({
				name: 'Alice',
				email: 'alice@example.com',
			})
			const keys: string[] = []
			for (const key in user) keys.push(key)
			expect(keys.sort()).toEqual(['email', 'name'])
		})

		test('should support Object.getOwnPropertyDescriptor', () => {
			const user = createStore({ name: 'Alice' })
			expect(Object.getOwnPropertyDescriptor(user, 'name')).toEqual({
				enumerable: true,
				configurable: true,
				writable: true,
				value: user.name,
			})
		})

		test('should return undefined descriptor for Symbol properties', () => {
			const store = createStore({ a: 1 })
			expect(
				Object.getOwnPropertyDescriptor(store, Symbol('test')),
			).toBeUndefined()
		})
	})

	describe('Iteration', () => {
		test('should support spread operator', () => {
			const user = createStore({ name: 'John', age: 25 })
			const entries = [...user]
			expect(entries).toHaveLength(2)
			expect(entries[0][0]).toBe('name')
			expect(entries[0][1].get()).toBe('John')
			expect(entries[1][0]).toBe('age')
			expect(entries[1][1].get()).toBe(25)
		})

		test('should maintain property key ordering', () => {
			const config = createStore({ alpha: 1, beta: 2, gamma: 3 })
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

	describe('Reactivity', () => {
		test('should react to property changes via get()', () => {
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
			expect(lastValue).toEqual({
				name: 'Jane',
				email: 'john@example.com',
			})
		})

		test('should support granular property-level subscriptions', () => {
			const user = createStore({
				name: 'John',
				email: 'john@example.com',
			})
			let nameRuns = 0
			createEffect(() => {
				user.name.get()
				nameRuns++
			})
			expect(nameRuns).toBe(1)

			user.email.set('new@example.com')
			expect(nameRuns).toBe(1) // name effect not triggered

			user.name.set('Jane')
			expect(nameRuns).toBe(2)
		})

		test('should propagate nested store changes to parent', () => {
			const user = createStore({
				preferences: { theme: 'light' },
			})
			let runs = 0
			createEffect(() => {
				user.get()
				runs++
			})
			expect(runs).toBe(1)

			user.preferences.theme.set('dark')
			expect(runs).toBe(2)
		})

		test('should react to update()', () => {
			const user = createStore({ name: 'John' })
			let lastValue: { name: string; email?: string } = { name: '' }
			let runs = 0
			createEffect(() => {
				lastValue = user.get()
				runs++
			})
			expect(runs).toBe(1)

			user.update(u => ({ ...u, email: 'john@example.com' }))
			expect(lastValue).toEqual({
				name: 'John',
				email: 'john@example.com',
			})
			expect(runs).toBe(2)
		})

		test('should work with createMemo', () => {
			const user = createStore({ firstName: 'John', lastName: 'Doe' })
			const fullName = createMemo(
				() => `${user.firstName.get()} ${user.lastName.get()}`,
			)
			expect(fullName.get()).toBe('John Doe')

			user.firstName.set('Jane')
			expect(fullName.get()).toBe('Jane Doe')
		})

		test('should work with createMemo on nested stores', () => {
			const config = createStore({ ui: { theme: 'light' } })
			const display = createMemo(() => `Theme: ${config.ui.theme.get()}`)
			expect(display.get()).toBe('Theme: light')

			config.ui.theme.set('dark')
			expect(display.get()).toBe('Theme: dark')
		})
	})

	describe('Serialization', () => {
		test('should round-trip through JSON', () => {
			const data = {
				user: { name: 'Alice', preferences: { theme: 'dark' } },
				settings: { timeout: 5000 },
			}
			const store = createStore(data)
			const parsed = JSON.parse(JSON.stringify(store.get()))
			expect(parsed).toEqual(data)
		})
	})

	describe('options.watched', () => {
		test('should activate on first effect and clean up on last', () => {
			let watchCount = 0
			const store = createStore(
				{ users: {} as Record<string, { name: string }> },
				{
					watched: () => {
						watchCount++
						return () => {
							watchCount--
						}
					},
				},
			)
			expect(watchCount).toBe(0)

			const cleanup1 = createEffect(() => {
				store.get()
			})
			expect(watchCount).toBe(1)

			const cleanup2 = createEffect(() => {
				store.get()
			})
			expect(watchCount).toBe(1) // still 1

			cleanup2()
			expect(watchCount).toBe(1) // still active

			cleanup1()
			expect(watchCount).toBe(0) // cleaned up
		})

		test('should not activate for nested property access only', async () => {
			let activated = false
			const store = createStore(
				{ user: { name: 'John' } },
				{
					watched: () => {
						activated = true
						return () => {
							activated = false
						}
					},
				},
			)

			const cleanup = createEffect(() => {
				store.user.name.get()
			})
			await new Promise(resolve => setTimeout(resolve, 10))
			expect(activated).toBe(false)

			cleanup()
		})

		test('should activate when keys() is called in an effect', () => {
			let watchCount = 0
			const store = createStore<{ a: number; b?: number }>(
				{ a: 1 },
				{
					watched: () => {
						watchCount++
						return () => {
							watchCount--
						}
					},
				},
			)
			expect(watchCount).toBe(0)

			const cleanup = createEffect(() => {
				Array.from(store.keys()).forEach(() => {})
			})
			expect(watchCount).toBe(1)

			cleanup()
			expect(watchCount).toBe(0)
		})
	})

	describe('Input Validation', () => {
		test('should throw for null initial value', () => {
			// @ts-expect-error testing null
			expect(() => createStore(null)).toThrow()
		})

		test('should throw for undefined initial value', () => {
			// @ts-expect-error testing undefined
			expect(() => createStore(undefined)).toThrow()
		})

		test('should throw for non-object initial value', () => {
			// @ts-expect-error testing primitive
			expect(() => createStore('hello')).toThrow()
		})

		test('should throw for null value in add()', () => {
			const store = createStore<{ name: string; email?: string }>({
				name: 'John',
			})
			// @ts-expect-error testing null
			expect(() => store.add('email', null)).toThrow()
		})
	})
})
