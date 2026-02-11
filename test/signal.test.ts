import { describe, expect, test } from 'bun:test'
import {
	createComputed,
	createList,
	createMemo,
	createMutableSignal,
	createScope,
	createSignal,
	createState,
	createStore,
	createTask,
	InvalidSignalValueError,
	isComputed,
	isList,
	isMemo,
	isMutableSignal,
	isSignal,
	isState,
	isStore,
	isTask,
	type List,
	type Memo,
	type Signal,
	type State,
	type Store,
	type Task,
} from '../index.ts'

/* === Tests === */

describe('createComputed', () => {
	test('creates a Memo from a sync callback', () => {
		const count = createState(2)
		const doubled = createComputed(() => count.get() * 2)
		expect(isMemo(doubled)).toBe(true)
		expect(doubled.get()).toBe(4)

		const typedResult: Memo<number> = doubled
		expect(typedResult).toBeDefined()
	})

	test('creates a Task from an async callback', () => {
		const cleanup = createScope(() => {
			const result = createComputed(async () => 'hello')
			expect(isTask(result)).toBe(true)

			const typedResult: Task<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})
})

describe('createSignal', () => {
	test('converts a primitive to State', () => {
		const result = createSignal(42)
		expect(isState(result)).toBe(true)
		expect(result.get()).toBe(42)

		const typedResult: State<number> = result
		expect(typedResult).toBeDefined()
	})

	test('converts a non-plain object to State', () => {
		const date = new Date('2024-01-01')
		const result = createSignal(date)
		expect(isState(result)).toBe(true)
		expect(result.get()).toBe(date)

		const typedResult: State<Date> = result
		expect(typedResult).toBeDefined()
	})

	test('converts a record to Store', () => {
		const result = createSignal({ name: 'Alice', age: 30 })
		expect(isStore(result)).toBe(true)
		expect(result.name.get()).toBe('Alice')
		expect(result.age.get()).toBe(30)

		const typedResult: Store<{ name: string; age: number }> = result
		expect(typedResult).toBeDefined()
	})

	test('converts an array to List', () => {
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

	test('converts an empty array to List', () => {
		const result = createSignal([])
		expect(isList(result)).toBe(true)
		expect(result.length).toBe(0)
	})

	test('converts a sync function to Memo', () => {
		const result = createSignal(() => Math.random())
		expect(isMemo(result)).toBe(true)
		expect(typeof result.get()).toBe('number')

		const typedResult: Memo<number> = result
		expect(typedResult).toBeDefined()
	})

	test('converts an async function to Task', () => {
		const cleanup = createScope(() => {
			const result = createSignal(async () => 'hello')
			expect(isTask(result)).toBe(true)

			const typedResult: Task<string> = result
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
	test('converts a primitive to State', () => {
		const result = createMutableSignal(42)
		expect(isState(result)).toBe(true)
		expect(result.get()).toBe(42)
	})

	test('converts a record to Store', () => {
		const result = createMutableSignal({ name: 'Alice' })
		expect(isStore(result)).toBe(true)
	})

	test('converts an array to List', () => {
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

describe('isComputed', () => {
	test('returns true for Memo', () => {
		expect(isComputed(createMemo(() => 42))).toBe(true)
	})

	test('returns true for Task', () => {
		const cleanup = createScope(() => {
			expect(isComputed(createTask(async () => 42))).toBe(true)
		})
		cleanup()
	})

	test('returns false for State', () => {
		expect(isComputed(createState(42))).toBe(false)
	})

	test('returns false for non-signals', () => {
		expect(isComputed(42)).toBe(false)
		expect(isComputed('hello')).toBe(false)
		expect(isComputed(null)).toBe(false)
	})
})

describe('isSignal', () => {
	test('returns true for all signal types', () => {
		const cleanup = createScope(() => {
			expect(isSignal(createState(42))).toBe(true)
			expect(isSignal(createMemo(() => 42))).toBe(true)
			expect(isSignal(createTask(async () => 42))).toBe(true)
			expect(isSignal(createStore({ a: 1 }))).toBe(true)
			expect(isSignal(createList([1, 2, 3]))).toBe(true)
		})
		cleanup()
	})

	test('returns false for non-signals', () => {
		expect(isSignal(42)).toBe(false)
		expect(isSignal('hello')).toBe(false)
		expect(isSignal({ get: () => 42 })).toBe(false)
		expect(isSignal(null)).toBe(false)
		expect(isSignal(undefined)).toBe(false)
	})
})

describe('isMutableSignal', () => {
	test('returns true for State, Store, and List', () => {
		expect(isMutableSignal(createState(42))).toBe(true)
		expect(isMutableSignal(createStore({ a: 1 }))).toBe(true)
		expect(isMutableSignal(createList([1, 2, 3]))).toBe(true)
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
