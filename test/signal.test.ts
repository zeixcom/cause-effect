import { describe, expect, test } from 'bun:test'
import {
	type Computed,
	computed,
	isComputed,
	isState,
	isStore,
	type Signal,
	type State,
	type Store,
	state,
	store,
	toMutableSignal,
	toSignal,
} from '../'

/* === Tests === */

describe('toSignal', () => {
	describe('type inference and runtime behavior', () => {
		test('converts array to Store<Record<string, T>>', () => {
			const arr = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
			]
			const result = toSignal(arr)

			// Runtime behavior
			expect(isStore(result)).toBe(true)
			expect(result['0'].get()).toEqual({ id: 1, name: 'Alice' })
			expect(result['1'].get()).toEqual({ id: 2, name: 'Bob' })

			// Type inference test - now correctly returns Store<Record<string, {id: number, name: string}>>
			const typedResult: Store<
				Record<string, { id: number; name: string }>
			> = result
			expect(typedResult).toBeDefined()
		})

		test('converts empty array to Store<Record<string, never>>', () => {
			const arr: never[] = []
			const result = toSignal(arr)

			// Runtime behavior
			expect(isStore(result)).toBe(true)
			expect(Object.keys(result).length).toBe(0)
		})

		test('converts record to Store<T>', () => {
			const record = { name: 'Alice', age: 30 }
			const result = toSignal(record)

			// Runtime behavior
			expect(isStore(result)).toBe(true)
			expect(result.name.get()).toBe('Alice')
			expect(result.age.get()).toBe(30)

			// Type inference test - should be Store<{name: string, age: number}>
			const typedResult: Store<{ name: string; age: number }> = result
			expect(typedResult).toBeDefined()
		})

		test('passes through existing Store unchanged', () => {
			const originalStore = store({ count: 5 })
			const result = toSignal(originalStore)

			// Runtime behavior
			expect(result).toBe(originalStore) // Should be the same instance
			expect(isStore(result)).toBe(true)
			expect(result.count.get()).toBe(5)

			// Type inference test - should remain Store<{count: number}>
			const typedResult: Store<{ count: number }> = result
			expect(typedResult).toBeDefined()
		})

		test('passes through existing State unchanged', () => {
			const originalState = state(42)
			const result = toSignal(originalState)

			// Runtime behavior
			expect(result).toBe(originalState) // Should be the same instance
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(42)

			// Type inference test - should remain State<number>
			const typedResult: State<number> = result
			expect(typedResult).toBeDefined()
		})

		test('passes through existing Computed unchanged', () => {
			const originalComputed = computed(() => 'hello world')
			const result = toSignal(originalComputed)

			// Runtime behavior
			expect(result).toBe(originalComputed) // Should be the same instance
			expect(isComputed(result)).toBe(true)
			expect(result.get()).toBe('hello world')

			// Type inference test - should remain Computed<string>
			const typedResult: Computed<string> = result
			expect(typedResult).toBeDefined()
		})

		test('converts function to Computed<T>', () => {
			const fn = () => Math.random()
			const result = toSignal(fn)

			// Runtime behavior - functions are correctly converted to Computed
			expect(isComputed(result)).toBe(true)
			expect(typeof result.get()).toBe('number')

			// Type inference test - should be Computed<number>
			const typedResult: Computed<number> = result
			expect(typedResult).toBeDefined()
		})

		test('converts primitive to State<T>', () => {
			const num = 42
			const result = toSignal(num)

			// Runtime behavior - primitives are correctly converted to State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(42)

			// Type inference test - should be State<number>
			const typedResult: State<number> = result
			expect(typedResult).toBeDefined()
		})

		test('converts object to State<T>', () => {
			const obj = new Date('2024-01-01')
			const result = toSignal(obj)

			// Runtime behavior - objects are correctly converted to State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(obj)

			// Type inference test - should be State<Date>
			const typedResult: State<Date> = result
			expect(typedResult).toBeDefined()
		})
	})

	describe('edge cases', () => {
		test('handles nested arrays', () => {
			const nestedArr = [
				[1, 2],
				[3, 4],
			]
			const result = toSignal(nestedArr)

			expect(isStore(result)).toBe(true)
			// With current incorrect behavior, nested arrays are treated as array values
			const firstElement = result['0'].get()
			const secondElement = result['1'].get()

			// The actual behavior - nested arrays become plain objects
			expect(firstElement).toEqual({ '0': 1, '1': 2 })
			expect(secondElement).toEqual({ '0': 3, '1': 4 })
		})

		test('handles arrays with mixed types', () => {
			const mixedArr = [1, 'hello', { key: 'value' }]
			const result = toSignal(mixedArr)

			expect(isStore(result)).toBe(true)
			expect(result['0'].get()).toBe(1)
			expect(result['1'].get()).toBe('hello')
			expect(result['2'].get()).toEqual({ key: 'value' })
		})

		test('handles sparse arrays', () => {
			const sparseArr = new Array(3)
			sparseArr[1] = 'middle'
			const result = toSignal(sparseArr)

			expect(isStore(result)).toBe(true)
			expect('0' in result).toBe(false)
			expect(result['1'].get()).toBe('middle')
			expect('2' in result).toBe(false)
		})
	})
})

describe('toMutableSignal', () => {
	describe('type inference and runtime behavior', () => {
		test('converts array to Store<Record<string, T>>', () => {
			const arr = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
			]
			const result = toMutableSignal(arr)

			// Runtime behavior
			expect(isStore(result)).toBe(true)
			expect(result['0'].get()).toEqual({ id: 1, name: 'Alice' })
			expect(result['1'].get()).toEqual({ id: 2, name: 'Bob' })

			// Type inference test - now correctly returns Store<Record<string, {id: number, name: string}>>
			const typedResult: Store<
				Record<string, { id: number; name: string }>
			> = result
			expect(typedResult).toBeDefined()
		})

		test('converts record to Store<T>', () => {
			const record = { name: 'Alice', age: 30 }
			const result = toMutableSignal(record)

			// Runtime behavior
			expect(isStore(result)).toBe(true)
			expect(result.name.get()).toBe('Alice')
			expect(result.age.get()).toBe(30)

			// Type inference test - should be Store<{name: string, age: number}>
			const typedResult: Store<{ name: string; age: number }> = result
			expect(typedResult).toBeDefined()
		})

		test('passes through existing Store unchanged', () => {
			const originalStore = store({ count: 5 })
			const result = toMutableSignal(originalStore)

			// Runtime behavior
			expect(result).toBe(originalStore) // Should be the same instance
			expect(isStore(result)).toBe(true)
			expect(result.count.get()).toBe(5)
		})

		test('passes through existing State unchanged', () => {
			const originalState = state(42)
			const result = toMutableSignal(originalState)

			// Runtime behavior
			expect(result).toBe(originalState) // Should be the same instance
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(42)

			// Type inference test - should be State<number>
			const typedResult: State<number> = result
			expect(typedResult).toBeDefined()
		})

		test('converts primitive to State<T>', () => {
			const num = 42
			const result = toMutableSignal(num)

			// Runtime behavior - primitives are correctly converted to State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(42)
		})

		test('converts object to State<T> (not Store)', () => {
			const obj = new Date('2024-01-01')
			const result = toMutableSignal(obj)

			// Runtime behavior - objects are correctly converted to State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(obj)

			// Type inference test - should be State<Date>
			const typedResult: State<Date> = result
			expect(typedResult).toBeDefined()
		})
	})

	describe('differences from toSignal', () => {
		test('does not accept functions (only mutable signals)', () => {
			// toMutableSignal should not have a function overload
			// This test documents the expected behavior difference
			const fn = () => 'test'
			const result = toMutableSignal(fn)

			// Should treat function as a regular value and create State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(fn)
		})

		test('does not accept Computed signals', () => {
			// toMutableSignal should not accept Computed signals
			const comp = computed(() => 'computed value')
			const result = toMutableSignal(comp)

			// Should treat Computed as a regular object and create State
			expect(isState(result)).toBe(true)
			expect(result.get()).toBe(comp)
		})
	})
})

describe('Signal compatibility', () => {
	test('all results implement Signal<T> interface', () => {
		const arraySignal = toSignal([1, 2, 3])
		const recordSignal = toSignal({ a: 1, b: 2 })
		const primitiveSignal = toSignal(42)
		const functionSignal = toSignal(() => 'hello')
		const stateSignal = toSignal(state(true))

		// All should have get() method
		expect(typeof arraySignal.get).toBe('function')
		expect(typeof recordSignal.get).toBe('function')
		expect(typeof primitiveSignal.get).toBe('function')
		expect(typeof functionSignal.get).toBe('function')
		expect(typeof stateSignal.get).toBe('function')

		// All should be assignable to Signal<T>
		const signals: Signal<unknown & {}>[] = [
			arraySignal,
			recordSignal,
			primitiveSignal,
			functionSignal,
			stateSignal,
		]
		expect(signals.length).toBe(5)
	})
})

describe('Type precision tests', () => {
	test('array type should infer element type correctly', () => {
		// Test that arrays infer the correct element type
		const stringArray = ['a', 'b', 'c']
		const stringArraySignal = toSignal(stringArray)

		// Should be Store<Record<string, string>>
		expect(stringArraySignal['0'].get()).toBe('a')

		const numberArray = [1, 2, 3]
		const numberArraySignal = toSignal(numberArray)

		// Should be Store<Record<string, number>>
		expect(typeof numberArraySignal['0'].get()).toBe('number')
	})

	test('complex object arrays maintain precise typing', () => {
		interface User {
			id: number
			name: string
			email: string
		}

		const users: User[] = [
			{ id: 1, name: 'Alice', email: 'alice@example.com' },
			{ id: 2, name: 'Bob', email: 'bob@example.com' },
		]

		const usersSignal = toSignal(users)

		// Should maintain User type for each element
		const firstUser = usersSignal['0'].get()
		expect(firstUser.id).toBe(1)
		expect(firstUser.name).toBe('Alice')
		expect(firstUser.email).toBe('alice@example.com')
	})

	describe('Type inference issues', () => {
		test('demonstrates current type inference problem', () => {
			// Current issue: when passing an array, T is inferred as the array type
			// instead of the element type, causing type compatibility problems
			const items = [{ id: 1 }, { id: 2 }]
			const result = toSignal(items)

			// This should work but may have type issues in external libraries
			// The return type should be Store<Record<string, {id: number}>>
			// But currently it might be inferred as Store<Record<string, {id: number}[]>>

			// Let's verify the actual behavior
			expect(isStore(result)).toBe(true)
			expect(result['0'].get()).toEqual({ id: 1 })
			expect(result['1'].get()).toEqual({ id: 2 })

			// Type assertion test - this should now work with correct typing
			const typedResult: Store<Record<string, { id: number }>> = result
			expect(typedResult).toBeDefined()

			// Simulate external library usage where P[K] represents element type
			interface ExternalLibraryConstraint<P extends Record<string, any>> {
				process<K extends keyof P>(signal: Signal<P[K]>): void
			}

			// This should work if types are correct
			const processor: ExternalLibraryConstraint<
				Record<string, { id: number }>
			> = {
				process: <K extends keyof Record<string, { id: number }>>(
					signal: Signal<Record<string, { id: number }>[K]>,
				) => {
					// Process the signal
					const value = signal.get()
					expect(value).toHaveProperty('id')
				},
			}

			// This call should work without type errors
			processor.process(result['0'])
		})

		test('verifies fixed type inference for external library compatibility', () => {
			// This test ensures the fix for the type inference issue works
			// Fixed: toSignal<T extends unknown & {}>(value: T[]): Store<Record<string, T>>
			// Now T = {id: number} (element type), T[] = {id: number}[] (array of elements)
			// Return type: Store<Record<string, {id: number}>> (correct)

			const items = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
			]
			const signal = toSignal(items)

			// Type should be Store<Record<string, {id: number, name: string}>>
			// Each property signal should be Signal<{id: number, name: string}>
			const firstItemSignal = signal['0']
			const secondItemSignal = signal['1']

			// Runtime behavior works correctly
			expect(isStore(signal)).toBe(true)
			expect(firstItemSignal.get()).toEqual({ id: 1, name: 'Alice' })
			expect(secondItemSignal.get()).toEqual({ id: 2, name: 'Bob' })

			// Type inference should now work correctly:
			const properlyTyped: Store<
				Record<string, { id: number; name: string }>
			> = signal
			expect(properlyTyped).toBeDefined()

			// These should work without type errors in external libraries
			// that expect Signal<P[K]> where P[K] is the individual element type
			interface ExternalAPI<P extends Record<string, unknown & {}>> {
				process<K extends keyof P>(key: K, signal: Signal<P[K]>): P[K]
			}

			const api: ExternalAPI<
				Record<string, { id: number; name: string }>
			> = {
				process: (_key, signal) => signal.get(),
			}

			// These calls should work with proper typing now
			const result1 = api.process('0', firstItemSignal)
			const result2 = api.process('1', secondItemSignal)

			expect(result1).toEqual({ id: 1, name: 'Alice' })
			expect(result2).toEqual({ id: 2, name: 'Bob' })

			// Verify the types are precise
			expect(typeof result1.id).toBe('number')
			expect(typeof result1.name).toBe('string')
		})
	})
})
