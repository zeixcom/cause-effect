import { describe, expect, test } from 'bun:test'
import {
	abort,
	type Cell,
	createCell,
	createComputed,
	createEffect,
	createList,
	createMemo,
	createMutableSignal,
	createScope,
	createSignal,
	createSlot,
	createState,
	createStore,
	createTask,
	deriveCell,
	deriveSignal,
	InvalidCallbackError,
	InvalidSignalValueError,
	isCell,
	isComputed,
	isList,
	isMemo,
	isMutableCell,
	isMutableSignal,
	isSignal,
	isState,
	isStore,
	isTask,
	type List,
	type Memo,
	type MutableCell,
	PromiseValueError,
	type Signal,
	type State,
	type Store,
	type Task,
	UnsetSignalValueError,
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

	test('throws PromiseValueError when a non-async callback returns a Promise', () => {
		const result = createComputed(
			(): Promise<string> => Promise.resolve('hello'),
		)
		expect(isMemo(result)).toBe(true) // misclassified before invocation, as documented
		expect(() => result.get()).toThrow(PromiseValueError)
	})
})

describe('deriveCell', () => {
	test('sync function derives a Memo, returned as Signal', () => {
		const count = createState(2)
		const doubled = deriveCell(() => count.get() * 2)
		expect(isMemo(doubled)).toBe(true)
		expect(doubled.get()).toBe(4)

		const typedResult: Signal<number> = doubled
		expect(typedResult).toBeDefined()
	})

	test('async function derives a Task, returned as Signal', () => {
		const cleanup = createScope(() => {
			const result = deriveCell(async () => 'hello', { initial: '' })
			expect(isTask(result)).toBe(true)

			const typedResult: Signal<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('async function initial is optional, unlike deriveList/deriveStore', () => {
		const cleanup = createScope(() => {
			const result = deriveCell(async () => 'hello')
			expect(() => result.get()).toThrow(UnsetSignalValueError)
		})
		cleanup()
	})

	test('seed value with watched derives a Sensor, returned as Signal', () => {
		const cleanup = createScope(() => {
			let push: (next: number) => void = () => {}
			const result = deriveCell(0, {
				watched: set => {
					push = set
					return () => {}
				},
			})
			const seen: number[] = []
			createEffect(() => {
				seen.push(result.get())
			})
			push(1)
			expect(seen).toEqual([0, 1])

			const typedResult: Signal<number> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('zero-arg async callback infers the resolved value type, not Promise<T>', () => {
		const cleanup = createScope(() => {
			const result = deriveCell(async () => new Map<string, number>())
			// If the overload order regresses, `result` unifies to
			// `Signal<Promise<Map<string, number>>>` and this assignment fails to compile.
			const typedResult: Signal<Map<string, number>> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('throws InvalidCallbackError when the seed form omits watched', () => {
		expect(() =>
			// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
			deriveCell(0, {} as any),
		).toThrow(InvalidCallbackError)
	})

	test('sync/async forms accept the same watched(invalidate) lifecycle as createMemo/createTask', () => {
		const cleanup = createScope(() => {
			let invalidate: () => void = () => {}
			let calls = 0
			const result = deriveCell(
				() => {
					calls++
					return calls
				},
				{
					watched: inv => {
						invalidate = inv
						return () => {}
					},
				},
			)
			createEffect(() => {
				result.get()
			})
			expect(calls).toBe(1)
			invalidate()
			expect(calls).toBe(2)
		})
		cleanup()
	})

	test('interoperates with isPending/abort like a Task built with createTask', () => {
		const cleanup = createScope(() => {
			const result = deriveCell(async () => 'hello', { initial: '' })
			expect(() => abort(result)).not.toThrow()
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

describe('createCell', () => {
	test('creates a single-value State, like createState', () => {
		const result = createCell(42)
		expect(isState(result)).toBe(true)
		expect(result.get()).toBe(42)

		const typedResult: State<number> = result
		expect(typedResult).toBeDefined()
	})

	test('passes options through to createState', () => {
		const result = createCell(0, {
			guard: (v): v is number => typeof v === 'number' && v >= 0,
		})
		expect(result.get()).toBe(0)
		expect(() => result.set(-1)).toThrow()
	})

	test('takes the value verbatim — no shape conversion', () => {
		// An array is held as an array value, not converted to a List; a record
		// is held as a record value, not converted to a Store. Unlike createSignal.
		const array = createCell([1, 2])
		expect(isState(array)).toBe(true)
		expect(isList(array)).toBe(false)
		expect(array.get()).toEqual([1, 2])

		const record = createCell({ a: 1 })
		expect(isState(record)).toBe(true)
		expect(isStore(record)).toBe(false)
		expect(record.get()).toEqual({ a: 1 })
	})

	test('return type narrows to MutableCell<T>, not the wider Signal<T>', () => {
		const result = createCell(42)
		const typedResult: MutableCell<number> = result
		expect(typedResult).toBeDefined()
	})
})

describe('isCell', () => {
	test('returns true for State, Memo, Task, and Sensor', () => {
		const cleanup = createScope(() => {
			expect(isCell(createState(1))).toBe(true)
			expect(isCell(createMemo(() => 1))).toBe(true)
			expect(isCell(createTask(async () => 1))).toBe(true)
			expect(isCell(deriveCell(1, { watched: () => () => {} }))).toBe(true)
		})
		cleanup()
	})

	test('returns false for List, Store, and non-signals', () => {
		expect(isCell(createList([1, 2]))).toBe(false)
		expect(isCell(createStore({ a: 1 }))).toBe(false)
		expect(isCell(42)).toBe(false)
		expect(isCell(null)).toBe(false)
	})

	test('narrows to Cell<T>', () => {
		const value: unknown = createState(1)
		if (isCell<number>(value)) {
			const typed: Cell<number> = value
			expect(typed.get()).toBe(1)
		}
	})
})

describe('isMutableCell', () => {
	test('returns true for State, false for Memo/Task/List/Store', () => {
		const cleanup = createScope(() => {
			expect(isMutableCell(createState(1))).toBe(true)
			expect(isMutableCell(createMemo(() => 1))).toBe(false)
			expect(isMutableCell(createTask(async () => 1))).toBe(false)
			expect(isMutableCell(createList([1, 2]))).toBe(false)
			expect(isMutableCell(createStore({ a: 1 }))).toBe(false)
		})
		cleanup()
	})
})

describe('deprecated single-value names', () => {
	test('deriveSignal stays a working alias of deriveCell', () => {
		const count = createState(2)
		const viaAlias = deriveSignal(() => count.get() * 2)
		expect(isMemo(viaAlias)).toBe(true)
		expect(viaAlias.get()).toBe(4)
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
			expect(isSignal(createSlot(createState(1)))).toBe(true)
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
				createCell({ a: 1 }),
				createCell([1, 2, 3]),
				createSignal(() => 'hello'),
			]
			for (const signal of signals) {
				expect(typeof signal.get).toBe('function')
			}
		})
		cleanup()
	})
})
