import { describe, expect, test } from 'bun:test'
import {
	createMemo,
	createState,
	isMemo,
	isState,
	UnsetSignalValueError,
} from '../next.ts'

/* === Tests === */

describe('Memo', () => {
	describe('createMemo', () => {
		test('should compute a derived value', () => {
			const derived = createMemo(() => 1 + 2)
			expect(derived.get()).toBe(3)
		})

		test('should have Symbol.toStringTag of "Memo"', () => {
			const memo = createMemo(() => 0)
			expect(memo[Symbol.toStringTag]).toBe('Memo')
		})

		test('should evaluate lazily on first get()', () => {
			let computed = false
			const memo = createMemo(() => {
				computed = true
				return 42
			})
			expect(computed).toBe(false)
			memo.get()
			expect(computed).toBe(true)
		})

		test('should throw UnsetSignalValueError if callback returns undefined', () => {
			const memo = createMemo(() => undefined as unknown as number)
			expect(() => memo.get()).toThrow(UnsetSignalValueError)
		})
	})

	describe('isMemo', () => {
		test('should identify memo signals', () => {
			expect(isMemo(createMemo(() => 0))).toBe(true)
		})

		test('should return false for non-memo values', () => {
			expect(isMemo(42)).toBe(false)
			expect(isMemo(null)).toBe(false)
			expect(isMemo({})).toBe(false)
			expect(isState(createMemo(() => 0))).toBe(false)
		})
	})

	describe('Dependency Tracking', () => {
		test('should recompute when a dependency changes', () => {
			const source = createState(42)
			const derived = createMemo(() => source.get() + 1)
			expect(derived.get()).toBe(43)
			source.set(24)
			expect(derived.get()).toBe(25)
		})

		test('should track through a chain of memos', () => {
			const x = createState(42)
			const a = createMemo(() => x.get() + 1)
			const b = createMemo(() => a.get() * 2)
			const c = createMemo(() => b.get() + 1)
			expect(c.get()).toBe(87)
			x.set(24)
			expect(c.get()).toBe(51)
		})

		test('should recompute after multiple state changes', () => {
			const a = createState(3)
			const b = createState(4)
			let count = 0
			const sum = createMemo(() => {
				count++
				return a.get() + b.get()
			})
			expect(sum.get()).toBe(7)
			a.set(6)
			expect(sum.get()).toBe(10)
			b.set(8)
			expect(sum.get()).toBe(14)
			expect(count).toBe(3)
		})
	})

	describe('Memoization', () => {
		test('should skip downstream recomputation when result is unchanged', () => {
			let count = 0
			const x = createState('a')
			const a = createMemo(() => {
				x.get()
				return 'foo'
			})
			const b = createMemo(() => {
				count++
				return a.get()
			})
			expect(b.get()).toBe('foo')
			expect(count).toBe(1)
			x.set('aa')
			x.set('aaa')
			expect(b.get()).toBe('foo')
			expect(count).toBe(1)
		})

		test('should not propagate when intermediate result is unchanged', () => {
			let count = 0
			const x = createState(42)
			const a = createMemo(() => x.get() % 2)
			const b = createMemo(() => (a.get() ? 'odd' : 'even'))
			const c = createMemo(() => {
				count++
				return `c: ${b.get()}`
			})
			expect(c.get()).toBe('c: even')
			expect(count).toBe(1)
			x.set(44)
			x.set(46)
			expect(c.get()).toBe('c: even')
			expect(count).toBe(1)
		})
	})

	describe('Diamond Graph', () => {
		test('should compute each memo only once', () => {
			let count = 0
			const x = createState('a')
			const a = createMemo(() => x.get())
			const b = createMemo(() => x.get())
			const c = createMemo(() => {
				count++
				return `${a.get()} ${b.get()}`
			})
			expect(c.get()).toBe('a a')
			expect(count).toBe(1)
			x.set('aa')
			expect(c.get()).toBe('aa aa')
			expect(count).toBe(2)
		})

		test('should compute each memo only once with tail', () => {
			let count = 0
			const x = createState('a')
			const a = createMemo(() => x.get())
			const b = createMemo(() => x.get())
			const c = createMemo(() => `${a.get()} ${b.get()}`)
			const d = createMemo(() => {
				count++
				return c.get()
			})
			expect(d.get()).toBe('a a')
			expect(count).toBe(1)
			x.set('aa')
			expect(d.get()).toBe('aa aa')
			expect(count).toBe(2)
		})

		test('should drop X->B->X updates', () => {
			let count = 0
			const x = createState(2)
			const a = createMemo(() => x.get() - 1)
			const b = createMemo(() => x.get() + a.get())
			const c = createMemo(() => {
				count++
				return `c: ${b.get()}`
			})
			expect(c.get()).toBe('c: 3')
			expect(count).toBe(1)
			x.set(4)
			expect(c.get()).toBe('c: 7')
			expect(count).toBe(2)
		})
	})

	describe('Error Handling', () => {
		test('should detect and throw for circular dependencies', () => {
			const a = createState(1)
			const b = createMemo(() => c.get() + 1)
			const c = createMemo((): number => b.get() + a.get())
			expect(() => b.get()).toThrow('[Memo] Circular dependency detected')
		})

		test('should propagate errors from computation', () => {
			const x = createState(0)
			const a = createMemo(() => {
				if (x.get() === 1) throw new Error('Computation failed')
				return 1
			})
			expect(a.get()).toBe(1)
			x.set(1)
			expect(() => a.get()).toThrow('Computation failed')
		})

		test('should allow downstream memos to recover from errors', () => {
			const x = createState(0)
			let errCount = 0
			const a = createMemo(() => {
				if (x.get() === 1) throw new Error('Computation failed')
				return 1
			})
			const b = createMemo(() => {
				try {
					return `ok: ${a.get()}`
				} catch (_e) {
					errCount++
					return 'recovered'
				}
			})

			expect(b.get()).toBe('ok: 1')
			x.set(1)
			expect(b.get()).toBe('recovered')
			expect(errCount).toBe(1)

			x.set(0)
			expect(b.get()).toBe('ok: 1')
		})
	})

	describe('options.value (prev)', () => {
		test('should pass initial value as prev to first computation', () => {
			let receivedPrev: number | undefined
			const memo = createMemo(
				prev => {
					receivedPrev = prev
					return prev + 1
				},
				{ value: 10 },
			)
			expect(memo.get()).toBe(11)
			expect(receivedPrev).toBe(10)
		})

		test('should pass undefined as prev when no initial value', () => {
			let receivedPrev: unknown = 999
			const memo = createMemo((prev: number | undefined) => {
				receivedPrev = prev
				return 42
			})
			memo.get()
			expect(receivedPrev).toBeUndefined()
		})

		test('should pass previous computed value on recomputation', () => {
			const source = createState(5)
			let receivedPrev: number | undefined
			const memo = createMemo(
				prev => {
					receivedPrev = prev
					return source.get() * 2
				},
				{ value: 0 },
			)

			expect(memo.get()).toBe(10)
			expect(receivedPrev).toBe(0)

			source.set(3)
			expect(memo.get()).toBe(6)
			expect(receivedPrev).toBe(10)
		})

		test('should work as a reducer', () => {
			const increment = createState(0)
			const sum = createMemo(
				prev => {
					const inc = increment.get()
					return inc === 0 ? prev : prev + inc
				},
				{ value: 0 },
			)

			expect(sum.get()).toBe(0)
			increment.set(5)
			expect(sum.get()).toBe(5)
			increment.set(3)
			expect(sum.get()).toBe(8)
		})

		test('should preserve prev value across errors', () => {
			const shouldError = createState(false)
			const counter = createState(1)
			const memo = createMemo(
				prev => {
					if (shouldError.get()) throw new Error('fail')
					return prev + counter.get()
				},
				{ value: 10 },
			)

			expect(memo.get()).toBe(11) // 10 + 1
			counter.set(5)
			expect(memo.get()).toBe(16) // 11 + 5

			shouldError.set(true)
			expect(() => memo.get()).toThrow('fail')

			shouldError.set(false)
			counter.set(2)
			expect(memo.get()).toBe(18) // 16 + 2
		})
	})

	describe('options.equals', () => {
		test('should use custom equality to skip propagation', () => {
			const source = createState(1)
			let downstream = 0
			const memo = createMemo(() => ({ x: source.get() % 2 }), {
				value: { x: -1 },
				equals: (a, b) => a.x === b.x,
			})
			const tail = createMemo(() => {
				downstream++
				return memo.get()
			})

			tail.get()
			expect(downstream).toBe(1)

			source.set(3) // still odd, structurally equal
			tail.get()
			expect(downstream).toBe(1)

			source.set(2) // now even, different
			tail.get()
			expect(downstream).toBe(2)
		})
	})

	describe('options.guard', () => {
		test('should validate initial value against guard', () => {
			expect(() => {
				createMemo(() => 42, {
					value: -1,
					guard: (v): v is number => typeof v === 'number' && v >= 0,
				})
			}).toThrow('[Memo] Signal value -1 is invalid')
		})

		test('should accept initial value that passes guard', () => {
			const memo = createMemo(prev => prev + 1, {
				value: 0,
				guard: (v): v is number => typeof v === 'number' && v >= 0,
			})
			expect(memo.get()).toBe(1)
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for non-function callback', () => {
			// @ts-expect-error - Testing invalid input
			expect(() => createMemo(null)).toThrow(
				'[Memo] Callback null is invalid',
			)
			// @ts-expect-error - Testing invalid input
			expect(() => createMemo(42)).toThrow(
				'[Memo] Callback 42 is invalid',
			)
			// @ts-expect-error - Testing invalid input
			expect(() => createMemo('str')).toThrow(
				'[Memo] Callback "str" is invalid',
			)
		})

		test('should throw InvalidCallbackError for async callback', () => {
			expect(() => createMemo(async () => 42)).toThrow()
		})

		test('should throw NullishSignalValueError for null initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createMemo(() => 42, { value: null })
			}).toThrow('[Memo] Signal value cannot be null or undefined')
		})
	})
})
