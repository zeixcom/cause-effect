import { describe, expect, test } from 'bun:test'
import {
	createComputed,
	createList,
	createMemo,
	createMutableSignal,
	createScope,
	createSignal,
	createSlot,
	createState,
	createStore,
	createTask,
	InvalidSignalValueError,
	isList,
	isMutableSignal,
	isSignal,
	isStore,
	type List,
	type MutableSignal,
	type MutableStore,
	PromiseValueError,
	type Signal,
} from '../index.ts'

/* === Tests === */

describe('createComputed', () => {
	test('creates a Signal from a sync callback', () => {
		const count = createState(2)
		const doubled = createComputed(() => count.get() * 2)
		expect(isSignal(doubled)).toBe(true)
		expect(doubled.get()).toBe(4)

		const typedResult: Signal<number> = doubled
		expect(typedResult).toBeDefined()
	})

	test('creates a Signal from an async callback', () => {
		const cleanup = createScope(() => {
			const result = createComputed(async () => 'hello')
			expect(isSignal(result)).toBe(true)

			const typedResult: Signal<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('throws PromiseValueError when a non-async callback returns a Promise', () => {
		const result = createComputed(
			(): Promise<string> => Promise.resolve('hello'),
		)
		expect(isSignal(result)).toBe(true) // misclassified before invocation, as documented
		expect(() => result.get()).toThrow(PromiseValueError)
	})
})

describe('createSignal', () => {
	test('converts a primitive to a MutableSignal', () => {
		const result = createSignal(42)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(42)

		const typedResult: MutableSignal<number> = result
		expect(typedResult).toBeDefined()
	})

	test('converts a non-plain object to a MutableSignal', () => {
		const date = new Date('2024-01-01')
		const result = createSignal(date)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(date)

		const typedResult: MutableSignal<Date> = result
		expect(typedResult).toBeDefined()
	})

	test('converts a record to a MutableStore', () => {
		const result = createSignal({ name: 'Alice', age: 30 })
		expect(isStore(result)).toBe(true)
		expect(result.name.get()).toBe('Alice')
		expect(result.age.get()).toBe(30)

		const typedResult: MutableStore<{ name: string; age: number }> = result
		expect(typedResult).toBeDefined()
	})

	test('converts an array to a MutableList', () => {
		const result = createSignal([
			{ id: 1, name: 'Alice' },
			{ id: 2, name: 'Bob' },
		])
		expect(isList(result)).toBe(true)
		expect(result.at(0)?.get()).toEqual({ id: 1, name: 'Alice' })
		expect(result.at(1)?.get()).toEqual({ id: 2, name: 'Bob' })

		const typedResult: List<{ id: number; name: string }> = result
		expect(typedResult).toBeDefined()
	})

	test('converts an empty array to a MutableList', () => {
		const result = createSignal([])
		expect(isList(result)).toBe(true)
		expect(result.length).toBe(0)
	})

	test('converts a sync function to a readonly Signal', () => {
		const result = createSignal(() => Math.random())
		expect(isSignal(result)).toBe(true)
		expect(typeof result.get()).toBe('number')

		const typedResult: Signal<number> = result
		expect(typedResult).toBeDefined()
	})

	test('converts an async function to a readonly Signal', () => {
		const cleanup = createScope(() => {
			const result = createSignal(async () => 'hello')
			expect(isSignal(result)).toBe(true)

			const typedResult: Signal<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('passes through an existing signal without wrapping', () => {
		const state = createState(42)
		expect(createSignal(state)).toBe(state)

		const memo = createMemo(() => 'hello')
		expect(createSignal(memo)).toBe(memo)

		const store = createStore({ a: 1 })
		expect(createSignal(store)).toBe(store)

		const list = createList([1, 2, 3])
		expect(createSignal(list)).toBe(list)
	})

	test('throws InvalidSignalValueError for null', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createSignal(null as any)).toThrow(InvalidSignalValueError)
	})

	test('throws InvalidSignalValueError for undefined', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createSignal(undefined as any)).toThrow(
			InvalidSignalValueError,
		)
	})
})

describe('createMutableSignal', () => {
	test('converts a primitive to a MutableSignal', () => {
		const result = createMutableSignal(42)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(42)
	})

	test('converts a record to a MutableStore', () => {
		const result = createMutableSignal({ name: 'Alice' })
		expect(isStore(result)).toBe(true)
	})

	test('converts an array to a MutableList', () => {
		const result = createMutableSignal([1, 2, 3])
		expect(isList(result)).toBe(true)
	})

	test('passes through an existing mutable signal without wrapping', () => {
		const state = createState(42)
		expect(createMutableSignal(state)).toBe(state)

		const store = createStore({ a: 1 })
		expect(createMutableSignal(store)).toBe(store)

		const list = createList([1, 2, 3])
		expect(createMutableSignal(list)).toBe(list)
	})

	test('throws InvalidSignalValueError for null', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createMutableSignal(null as any)).toThrow(
			InvalidSignalValueError,
		)
	})

	test('throws InvalidSignalValueError for a function', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createMutableSignal((() => 42) as any)).toThrow(
			InvalidSignalValueError,
		)
	})

	test('throws InvalidSignalValueError for a read-only signal', () => {
		const memo = createMemo(() => 42)
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createMutableSignal(memo as any)).toThrow(
			InvalidSignalValueError,
		)
	})
})

describe('isSignal', () => {
	test('returns true only for the single-value shape', () => {
		const cleanup = createScope(() => {
			expect(isSignal(createState(42))).toBe(true)
			expect(isSignal(createMemo(() => 42))).toBe(true)
			expect(isSignal(createTask(async () => 42))).toBe(true)
		})
		cleanup()
	})

	test('returns false for other shapes and non-signals', () => {
		expect(isSignal(createStore({ a: 1 }))).toBe(false)
		expect(isSignal(createList([1, 2, 3]))).toBe(false)
		expect(isSignal(createSlot(createState(1)))).toBe(false)
		expect(isSignal(42)).toBe(false)
		expect(isSignal('hello')).toBe(false)
		expect(isSignal({ get: () => 42 })).toBe(false)
		expect(isSignal(null)).toBe(false)
		expect(isSignal(undefined)).toBe(false)
	})
})

describe('isMutableSignal', () => {
	test('returns true only for a mutable single-value signal', () => {
		expect(isMutableSignal(createState(42))).toBe(true)
	})

	test('returns false for other shapes', () => {
		expect(isMutableSignal(createStore({ a: 1 }))).toBe(false)
		expect(isMutableSignal(createList([1, 2, 3]))).toBe(false)
	})

	test('returns false for read-only signals', () => {
		const cleanup = createScope(() => {
			expect(isMutableSignal(createMemo(() => 42))).toBe(false)
			expect(isMutableSignal(createTask(async () => 42))).toBe(false)
		})
		cleanup()
	})

	test('returns false for non-signals', () => {
		expect(isMutableSignal(42)).toBe(false)
		expect(isMutableSignal(null)).toBe(false)
	})
})

describe('Signal compatibility', () => {
	test('all signal factory results implement Signal<T>', () => {
		const cleanup = createScope(() => {
			const signals: Signal<unknown & {}>[] = [
				createSignal(42),
				createSignal({ a: 1 }),
				createSignal([1, 2, 3]),
				createSignal(() => 'hello'),
			]
			for (const signal of signals) {
				expect(typeof signal.get).toBe('function')
			}
		})
		cleanup()
	})
})
