import { describe, expect, test } from 'bun:test'
import {
	createCell,
	createEffect,
	createList,
	createScope,
	createState,
	createStore,
	deriveCell,
	deriveComputed,
	InvalidCallbackError,
	isCell,
	isList,
	isMutableCell,
	isPending,
	isStore,
	type MutableCell,
	NullishSignalValueError,
	PromiseValueError,
	type Signal,
	UnsetSignalValueError,
} from '../index.ts'

/* === Tests === */

describe('createCell', () => {
	test('creates a MutableCell from a value', () => {
		const result = createCell(42)
		expect(isMutableCell(result)).toBe(true)
		expect(result.get()).toBe(42)
		result.set(43)
		expect(result.get()).toBe(43)

		const typedResult: MutableCell<number> = result
		expect(typedResult).toBeDefined()
	})

	test('creates a MutableCell from a non-plain object', () => {
		const date = new Date('2024-01-01')
		const result = createCell(date)
		expect(isMutableCell(result)).toBe(true)
		expect(result.get()).toBe(date)

		const typedResult: MutableCell<Date> = result
		expect(typedResult).toBeDefined()
	})

	test('holds an array as a value rather than converting it to a MutableList', () => {
		const seed = [{ id: 1, name: 'Alice' }]
		const result = createCell(seed)
		expect(isList(result)).toBe(false)
		expect(result.get()).toBe(seed)
	})

	test('holds a record as a value rather than converting it to a MutableStore', () => {
		const seed = { name: 'Alice', age: 30 }
		const result = createCell(seed)
		expect(isStore(result)).toBe(false)
		expect(result.get()).toBe(seed)
	})

	test('holds a function as a value rather than deriving from it', () => {
		const fn = () => 42
		const result = createCell(fn)
		expect(isMutableCell(result)).toBe(true)
		expect(result.get()).toBe(fn)
	})

	test('wraps an existing signal as a value rather than passing it through', () => {
		const state = createState(42)
		const wrapped = createCell(state)
		expect(wrapped).not.toBe(state)
		expect(wrapped.get()).toBe(state)
	})

	test('passes options through to the state', () => {
		const result = createCell(0, {
			guard: (v): v is number => typeof v === 'number' && v >= 0,
		})
		expect(result.get()).toBe(0)
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => result.set(-1 as any)).toThrow()
	})

	test('throws NullishSignalValueError for null', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createCell(null as any)).toThrow(NullishSignalValueError)
	})

	test('throws NullishSignalValueError for undefined', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createCell(undefined as any)).toThrow(NullishSignalValueError)
	})
})

describe('deriveCell', () => {
	test('creates a Signal from a sync callback', () => {
		const count = createState(2)
		const doubled = deriveCell(() => count.get() * 2)
		expect(isCell(doubled)).toBe(true)
		expect(doubled.get()).toBe(4)
		count.set(3)
		expect(doubled.get()).toBe(6)

		const typedResult: Signal<number> = doubled
		expect(typedResult).toBeDefined()
	})

	test('passes the initial value to a sync reducer callback', () => {
		const count = createState(1)
		const total = deriveCell(
			(prev: number | undefined) => (prev ?? 0) + count.get(),
			{ initial: 0 },
		)
		expect(total.get()).toBe(1)
		count.set(2)
		expect(total.get()).toBe(3)
	})

	test('creates a Signal from an async callback that is unset until resolution', () => {
		const cleanup = createScope(() => {
			const result = deriveCell(async () => 'hello')
			expect(isCell(result)).toBe(true)
			expect(() => result.get()).toThrow(UnsetSignalValueError)

			const typedResult: Signal<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('seeds an async derivation with initial and settles later', async () => {
		let resolve!: (value: string) => void
		const result = deriveCell(
			async () => new Promise<string>(r => (resolve = r)),
			{ initial: 'loading' },
		)
		expect(result.get()).toBe('loading')
		expect(isPending(result)).toBe(true)
		resolve('hello')
		await new Promise(r => setTimeout(r, 0))
		expect(result.get()).toBe('hello')
		expect(isPending(result)).toBe(false)
	})

	test('throws PromiseValueError when a non-async callback returns a Promise', () => {
		const result = deriveCell((): Promise<string> => Promise.resolve('hello'))
		expect(isCell(result)).toBe(true) // misclassified before invocation, as documented
		expect(() => result.get()).toThrow(PromiseValueError)
	})

	test('creates an external-push Signal from a seed value and a watched lifecycle', () => {
		const seen: string[] = []
		let push: ((next: string) => void) | undefined
		const dispose = createScope(() => {
			const result = deriveCell('first', {
				watched: (emit: (next: string) => void) => {
					push = emit
					return () => {
						push = undefined
					}
				},
			})
			createEffect(() => {
				seen.push(result.get())
			})
		})
		expect(seen).toEqual(['first'])
		expect(push).toBeTypeOf('function')
		push?.('second')
		expect(seen).toEqual(['first', 'second'])
		dispose()
		expect(push).toBeUndefined()
	})

	test('throws InvalidCallbackError for a seed value without watched', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => deriveCell('seed', {} as any)).toThrow(InvalidCallbackError)
	})
})

describe('isCell', () => {
	test('returns true only for the single-value shape', () => {
		const cleanup = createScope(() => {
			expect(isCell(createState(42))).toBe(true)
			expect(isCell(deriveComputed(() => 42))).toBe(true)
			expect(isCell(deriveCell(() => 42))).toBe(true)
		})
		cleanup()
	})

	test('returns false for other shapes and non-signals', () => {
		expect(isCell(createStore({ a: 1 }))).toBe(false)
		expect(isCell(createList([1, 2, 3]))).toBe(false)
		expect(isCell(42)).toBe(false)
		expect(isCell('hello')).toBe(false)
		expect(isCell({ get: () => 42 })).toBe(false)
		expect(isCell(null)).toBe(false)
		expect(isCell(undefined)).toBe(false)
	})
})

describe('isMutableCell', () => {
	test('returns true only for a mutable single-value signal', () => {
		expect(isMutableCell(createState(42))).toBe(true)
		expect(isMutableCell(createCell(42))).toBe(true)
	})

	test('returns false for other shapes', () => {
		expect(isMutableCell(createStore({ a: 1 }))).toBe(false)
		expect(isMutableCell(createList([1, 2, 3]))).toBe(false)
	})

	test('returns false for read-only signals', () => {
		const cleanup = createScope(() => {
			expect(isMutableCell(deriveComputed(() => 42))).toBe(false)
			expect(isMutableCell(deriveCell(() => 42))).toBe(false)
		})
		cleanup()
	})

	test('returns false for non-signals', () => {
		expect(isMutableCell(42)).toBe(false)
		expect(isMutableCell(null)).toBe(false)
	})
})

describe('Signal compatibility', () => {
	test('all signal factory results implement Signal<T>', () => {
		const cleanup = createScope(() => {
			const signals: Signal<unknown & {}>[] = [
				createCell(42),
				createCell({ a: 1 }),
				createCell([1, 2, 3]),
				deriveCell(() => 'hello'),
			]
			for (const signal of signals) {
				expect(typeof signal.get).toBe('function')
			}
		})
		cleanup()
	})
})
