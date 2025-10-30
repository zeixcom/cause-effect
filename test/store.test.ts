import { describe, expect, test } from 'bun:test'
import {
	computed,
	effect,
	isStore,
	state,
	store,
	UNSET,
	type UnknownStore,
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
		})
	})

	describe('property access and modification', () => {
		test('properties are state signals', () => {
			const user = store({ name: 'Hannah', age: 25 })

			// Properties should behave like state signals
			expect(user.name.get()).toBe('Hannah')
			expect(user.age.get()).toBe(25)

			user.name.set('Alice')
			user.age.set(30)

			expect(user.name.get()).toBe('Alice')
			expect(user.age.get()).toBe(30)
		})

		test('properties support update method', () => {
			const user = store({ email: 'HANNAH@EXAMPLE.COM' })

			user.email.update(email => email.toLowerCase())

			expect(user.email.get()).toBe('hannah@example.com')
		})

		test('throws error when accessing non-existent property', () => {
			const user = store({ name: 'Hannah' })

			// @ts-expect-error test non-existent property
			expect(() => user.nonExistent).toThrow(
				"Property 'nonExistent' does not exist on store",
			)
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
			expect(user.preferences.theme.get()).toBe('dark')
			expect(user.preferences.notifications.get()).toBe(true)
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

	describe('has() method', () => {
		test('checks property existence without tracking', () => {
			const user = store({ name: 'Hannah' })

			expect(user.has('name')).toBe(true)
			expect(user.has('email')).toBe(false)
		})

		test('has() is non-tracking', () => {
			const user = store({ name: 'Hannah' })
			let effectRuns = 0

			effect(() => {
				user.has('name') // This should not cause tracking
				effectRuns++
			})

			user.name.set('Alice') // This should not trigger the effect
			expect(effectRuns).toBe(1) // Should only run once initially
		})
	})

	describe('add() method', () => {
		test('adds new properties', () => {
			const user = store({ name: 'Hannah' })

			const updatedUser = user.add('email', 'hannah@example.com')

			expect(updatedUser as unknown).toBe(user as unknown) // Returns same instance
			expect(user.has('email')).toBe(true)
			expect((user as unknown as UnknownStore).email.get()).toBe(
				'hannah@example.com',
			)
		})

		test('adds nested object properties', () => {
			const user = store({ name: 'Hannah' })

			user.add('preferences', { theme: 'dark' })

			expect(isStore((user as unknown as UnknownStore).preferences)).toBe(
				true,
			)
			expect(
				(
					(user as unknown as UnknownStore)
						.preferences as unknown as UnknownStore
				).theme.get(),
			).toBe('dark')
		})

		test('throws error when adding existing property', () => {
			const user = store({ name: 'Hannah' })

			expect(() => user.add('name', 'Alice')).toThrow(
				"Property 'name' already exists",
			)
		})
	})

	describe('delete() method', () => {
		test('deletes existing properties', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })

			const updatedUser = user.delete('email')

			expect(updatedUser as unknown).toBe(user as unknown) // Returns same instance
			expect(user.has('email')).toBe(false)
			expect(() => (user as unknown as UnknownStore).email).toThrow(
				"Property 'email' does not exist on store",
			)
		})

		test('throws error when deleting non-existent property', () => {
			const user = store({ name: 'Hannah' })

			expect(() =>
				(user as unknown as UnknownStore).delete('email'),
			).toThrow("Property 'email' does not exist")
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

		test('property-level reactivity works', () => {
			const user = store({ name: 'Hannah', email: 'hannah@example.com' })
			let lastName = ''
			let nameEffectRuns = 0

			effect(() => {
				lastName = user.name.get()
				nameEffectRuns++
			})

			// Change name should trigger effect
			user.name.set('Alice')
			expect(lastName).toBe('Alice')
			expect(nameEffectRuns).toBe(2) // Initial + update

			// Change email should NOT trigger name effect
			user.email.set('alice@example.com')
			expect(nameEffectRuns).toBe(2) // Should still be 2
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

		test('structural changes (add/delete) are reactive', () => {
			const user = store({ name: 'Hannah' })
			let lastValue = {}
			let effectRuns = 0

			effect(() => {
				lastValue = user.get()
				effectRuns++
			})

			// Add property
			user.add('email', 'hannah@example.com')
			expect(lastValue).toEqual({
				name: 'Hannah',
				email: 'hannah@example.com',
			})
			expect(effectRuns).toBe(2)

			// Delete property - reactivity behavior shows 4 total runs
			;(user as unknown as UnknownStore).delete('email')
			expect(lastValue).toEqual({
				name: 'Hannah',
			})
			expect(effectRuns).toBe(4)
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

	describe('error handling', () => {
		test('rejects function values', () => {
			expect(() => {
				store({ func: () => 'hello' })
			}).toThrow(
				'Functions are not allowed as store property values (property: func)',
			)
		})

		test('rejects function values in add()', () => {
			const user = store({ name: 'Hannah' })

			expect(() => {
				user.add('func', () => 'hello')
			}).toThrow(
				'Functions are not allowed as store property values (property: func)',
			)
		})

		test('rejects function values in nested objects', () => {
			expect(() => {
				store({
					config: {
						handler: () => 'hello',
					},
				})
			}).toThrow(
				'Functions are not allowed as store property values (property: handler)',
			)
		})
	})

	describe('arrays and edge cases', () => {
		test('handles arrays as leaf values', () => {
			const data = store({ items: [1, 2, 3] })

			expect(data.items.get()).toEqual([1, 2, 3])
			data.items.set([4, 5, 6])
			expect(data.items.get()).toEqual([4, 5, 6])
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
				undef: undefined as unknown as unknown & {},
			})

			expect(data.str.get()).toBe('hello')
			expect(data.num.get()).toBe(42)
			expect(data.bool.get()).toBe(true)
			expect(data.undef.get()).toBeUndefined()
		})
	})

	describe('memory management', () => {
		test('cleanup works when deleting properties', () => {
			const user = store({ name: 'Hannah', temp: 'value' })

			// Delete should clean up internal state
			user.delete('temp')

			expect(user.has('temp')).toBe(false)
			expect(() => (user as unknown as UnknownStore).temp).toThrow()
		})
	})

	describe('proxy behavior', () => {
		test('ownKeys returns property keys', () => {
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

		test('has operator works', () => {
			const user = store({ name: 'Hannah' })

			expect('name' in user).toBe(true)
			expect('email' in user).toBe(false)
			expect('get' in user).toBe(true)
			expect('has' in user).toBe(true)
		})
	})
})
