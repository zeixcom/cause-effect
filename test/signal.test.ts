import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createList,
	createMemo,
	createScope,
	createSignal,
	createState,
	createStore,
	deriveSignal,
	InvalidCallbackError,
	isList,
	isMutableSignal,
	isPending,
	isSignal,
	isStore,
	type MutableSignal,
	NullishSignalValueError,
	PromiseValueError,
	type Signal,
	UnsetSignalValueError,
} from '../index.ts'

/* === Tests === */

describe('createSignal', () => {
	test('creates a MutableSignal from a value', () => {
		const result = createSignal(42)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(42)
		result.set(43)
		expect(result.get()).toBe(43)

		const typedResult: MutableSignal<number> = result
		expect(typedResult).toBeDefined()
	})

	test('creates a MutableSignal from a non-plain object', () => {
		const date = new Date('2024-01-01')
		const result = createSignal(date)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(date)

		const typedResult: MutableSignal<Date> = result
		expect(typedResult).toBeDefined()
	})

	test('holds an array as a value rather than converting it to a MutableList', () => {
		const seed = [{ id: 1, name: 'Alice' }]
		const result = createSignal(seed)
		expect(isList(result)).toBe(false)
		expect(result.get()).toBe(seed)
	})

	test('holds a record as a value rather than converting it to a MutableStore', () => {
		const seed = { name: 'Alice', age: 30 }
		const result = createSignal(seed)
		expect(isStore(result)).toBe(false)
		expect(result.get()).toBe(seed)
	})

	test('holds a function as a value rather than deriving from it', () => {
		const fn = () => 42
		const result = createSignal(fn)
		expect(isMutableSignal(result)).toBe(true)
		expect(result.get()).toBe(fn)
	})

	test('wraps an existing signal as a value rather than passing it through', () => {
		const state = createState(42)
		const wrapped = createSignal(state)
		expect(wrapped).not.toBe(state)
		expect(wrapped.get()).toBe(state)
	})

	test('passes options through to the state', () => {
		const result = createSignal(0, {
			guard: (v): v is number => typeof v === 'number' && v >= 0,
		})
		expect(result.get()).toBe(0)
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => result.set(-1 as any)).toThrow()
	})

	test('throws NullishSignalValueError for null', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createSignal(null as any)).toThrow(NullishSignalValueError)
	})

	test('throws NullishSignalValueError for undefined', () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
		expect(() => createSignal(undefined as any)).toThrow(
			NullishSignalValueError,
		)
	})
})

describe('deriveSignal', () => {
	test('creates a Signal from a sync callback', () => {
		const count = createState(2)
		const doubled = deriveSignal(() => count.get() * 2)
		expect(isSignal(doubled)).toBe(true)
		expect(doubled.get()).toBe(4)
		count.set(3)
		expect(doubled.get()).toBe(6)

		const typedResult: Signal<number> = doubled
		expect(typedResult).toBeDefined()
	})

	test('passes the initial value to a sync reducer callback', () => {
		const count = createState(1)
		const total = deriveSignal(
			(prev: number | undefined) => (prev ?? 0) + count.get(),
			{ initial: 0 },
		)
		expect(total.get()).toBe(1)
		count.set(2)
		expect(total.get()).toBe(3)
	})

	test('creates a Signal from an async callback that is unset until resolution', () => {
		const cleanup = createScope(() => {
			const result = deriveSignal(async () => 'hello')
			expect(isSignal(result)).toBe(true)
			expect(() => result.get()).toThrow(UnsetSignalValueError)

			const typedResult: Signal<string> = result
			expect(typedResult).toBeDefined()
		})
		cleanup()
	})

	test('seeds an async derivation with initial and settles later', async () => {
		let resolve!: (value: string) => void
		const result = deriveSignal(
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
		const result = deriveSignal((): Promise<string> => Promise.resolve('hello'))
		expect(isSignal(result)).toBe(true) // misclassified before invocation, as documented
		expect(() => result.get()).toThrow(PromiseValueError)
	})

	test('creates an external-push Signal from a seed value and a watched lifecycle', () => {
		const seen: string[] = []
		let push: ((next: string) => void) | undefined
		const dispose = createScope(() => {
			const result = deriveSignal('first', {
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
		expect(() => deriveSignal('seed', {} as any)).toThrow(InvalidCallbackError)
	})
})

describe('isSignal', () => {
	test('returns true only for the single-value shape', () => {
		const cleanup = createScope(() => {
			expect(isSignal(createState(42))).toBe(true)
			expect(isSignal(createMemo(() => 42))).toBe(true)
			expect(isSignal(deriveSignal(() => 42))).toBe(true)
		})
		cleanup()
	})

	test('returns false for other shapes and non-signals', () => {
		expect(isSignal(createStore({ a: 1 }))).toBe(false)
		expect(isSignal(createList([1, 2, 3]))).toBe(false)
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
		expect(isMutableSignal(createSignal(42))).toBe(true)
	})

	test('returns false for other shapes', () => {
		expect(isMutableSignal(createStore({ a: 1 }))).toBe(false)
		expect(isMutableSignal(createList([1, 2, 3]))).toBe(false)
	})

	test('returns false for read-only signals', () => {
		const cleanup = createScope(() => {
			expect(isMutableSignal(createMemo(() => 42))).toBe(false)
			expect(isMutableSignal(deriveSignal(() => 42))).toBe(false)
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
				deriveSignal(() => 'hello'),
			]
			for (const signal of signals) {
				expect(typeof signal.get).toBe('function')
			}
		})
		cleanup()
	})
})
