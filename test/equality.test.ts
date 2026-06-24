import { describe, expect, test } from 'bun:test'
import { DEEP_EQUALITY } from '../index.ts'

/* === Tests === */

describe('DEEP_EQUALITY', () => {
	describe('primitives — same type, same value', () => {
		test('equal numbers', () => {
			expect(DEEP_EQUALITY(1, 1)).toBe(true)
		})

		test('equal strings', () => {
			expect(DEEP_EQUALITY('hello', 'hello')).toBe(true)
		})

		test('equal booleans', () => {
			expect(DEEP_EQUALITY(true, true)).toBe(true)
		})

		test('NaN equals NaN via Object.is fast path', () => {
			expect(DEEP_EQUALITY(NaN, NaN)).toBe(true)
		})
	})

	describe('primitives — same type, different value', () => {
		test('different numbers', () => {
			expect(DEEP_EQUALITY(1, 2)).toBe(false)
		})

		test('different strings', () => {
			expect(DEEP_EQUALITY('a', 'b')).toBe(false)
		})

		test('different booleans', () => {
			expect(DEEP_EQUALITY(true, false)).toBe(false)
		})
	})

	describe('cross-type comparisons', () => {
		test('number vs string', () => {
			// @ts-expect-error deliberate mismatch
			expect(DEEP_EQUALITY(1, 'hello')).toBe(false)
		})

		test('number vs object', () => {
			// @ts-expect-error deliberate mismatch
			expect(DEEP_EQUALITY(1, { a: 1 })).toBe(false)
		})

		test('string vs array', () => {
			// @ts-expect-error deliberate mismatch
			expect(DEEP_EQUALITY('abc', ['a', 'b', 'c'])).toBe(false)
		})
	})

	describe('object identity fast path', () => {
		test('same object reference is true', () => {
			const obj = { a: 1, b: { c: 2 } }
			expect(DEEP_EQUALITY(obj, obj)).toBe(true)
		})

		test('same array reference is true', () => {
			const arr = [1, 2, 3]
			expect(DEEP_EQUALITY(arr, arr)).toBe(true)
		})
	})

	describe('flat objects', () => {
		test('structurally equal flat objects', () => {
			expect(DEEP_EQUALITY({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
		})

		test('empty objects', () => {
			expect(DEEP_EQUALITY({}, {})).toBe(true)
		})

		test('differ in one value', () => {
			expect(DEEP_EQUALITY({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false)
		})

		test('differ in key name', () => {
			expect(DEEP_EQUALITY({ a: 1 }, { b: 1 })).toBe(false)
		})

		test('differ in key count (a has more)', () => {
			expect(
				DEEP_EQUALITY({ a: 1, b: 2 } as { a: number; b?: number }, {
					a: 1,
				}),
			).toBe(false)
		})

		test('differ in key count (b has more)', () => {
			expect(
				DEEP_EQUALITY({ a: 1 }, { a: 1, b: 2 } as {
					a: number
					b?: number
				}),
			).toBe(false)
		})
	})

	describe('nested objects', () => {
		test('structurally equal nested objects', () => {
			expect(
				DEEP_EQUALITY({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }),
			).toBe(true)
		})

		test('differ at one level of nesting', () => {
			expect(DEEP_EQUALITY({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
		})

		test('differ in nested key presence', () => {
			expect(
				DEEP_EQUALITY(
					{ a: { b: 1 } },
					{ a: { b: 1, c: 2 } as { b: number; c?: number } },
				),
			).toBe(false)
		})
	})

	describe('arrays', () => {
		test('empty arrays', () => {
			expect(DEEP_EQUALITY([], [])).toBe(true)
		})

		test('equal primitive arrays', () => {
			expect(DEEP_EQUALITY([1, 2, 3], [1, 2, 3])).toBe(true)
		})

		test('differ in length', () => {
			expect(
				DEEP_EQUALITY([1, 2] as number[], [1, 2, 3] as number[]),
			).toBe(false)
		})

		test('differ in one element', () => {
			expect(DEEP_EQUALITY([1, 2, 3], [1, 2, 4])).toBe(false)
		})

		test('equal nested arrays', () => {
			expect(DEEP_EQUALITY([[1, 2], [3]], [[1, 2], [3]])).toBe(true)
		})

		test('differ in nested array element', () => {
			expect(DEEP_EQUALITY([[1, 2], [3]], [[1, 2], [4]])).toBe(false)
		})

		test('array of equal objects', () => {
			expect(
				DEEP_EQUALITY([{ x: 1 }, { x: 2 }], [{ x: 1 }, { x: 2 }]),
			).toBe(true)
		})

		test('array of objects differing in one element', () => {
			expect(
				DEEP_EQUALITY([{ x: 1 }, { x: 2 }], [{ x: 1 }, { x: 9 }]),
			).toBe(false)
		})
	})

	describe('array vs object', () => {
		test('array is not equal to object with same numeric keys', () => {
			expect(
				DEEP_EQUALITY(
					[1, 2] as unknown as Record<string, unknown>,
					{ 0: 1, 1: 2 } as Record<string, unknown>,
				),
			).toBe(false)
		})
	})

	describe('deep trees', () => {
		test('deeply nested equal structure', () => {
			const a = { level1: { level2: { level3: { value: 42 } } } }
			const b = { level1: { level2: { level3: { value: 42 } } } }
			expect(DEEP_EQUALITY(a, b)).toBe(true)
		})

		test('deeply nested structure differing at leaf', () => {
			const a = { level1: { level2: { level3: { value: 42 } } } }
			const b = { level1: { level2: { level3: { value: 99 } } } }
			expect(DEEP_EQUALITY(a, b)).toBe(false)
		})

		test('mixed arrays and objects, equal', () => {
			const a = { items: [{ id: 1 }, { id: 2 }], meta: { count: 2 } }
			const b = { items: [{ id: 1 }, { id: 2 }], meta: { count: 2 } }
			expect(DEEP_EQUALITY(a, b)).toBe(true)
		})

		test('mixed arrays and objects, differ in nested array element', () => {
			const a = { items: [{ id: 1 }, { id: 2 }] }
			const b = { items: [{ id: 1 }, { id: 9 }] }
			expect(DEEP_EQUALITY(a, b)).toBe(false)
		})
	})

	describe('non-plain objects', () => {
		test('same Map reference is true', () => {
			const m = new Map([['a', 1]])
			expect(DEEP_EQUALITY(m, m)).toBe(true)
		})

		test('two distinct Maps with same entries are false (not plain objects)', () => {
			const m1 = new Map([['a', 1]])
			const m2 = new Map([['a', 1]])
			expect(DEEP_EQUALITY(m1, m2)).toBe(false)
		})

		test('two distinct Sets with same values are false (not plain objects)', () => {
			const s1 = new Set([1, 2, 3])
			const s2 = new Set([1, 2, 3])
			expect(DEEP_EQUALITY(s1, s2)).toBe(false)
		})

		test('two distinct class instances are false (not plain objects)', () => {
			class Point {
				x: number
				y: number
				constructor(x: number, y: number) {
					this.x = x
					this.y = y
				}
			}
			expect(
				DEEP_EQUALITY(
					new Point(1, 2) as unknown & {},
					new Point(1, 2) as unknown & {},
				),
			).toBe(false)
		})
	})

	describe('built-in value types', () => {
		// Date and RegExp represent values, not identity — two equal instances
		// must compare equal under DEEP_EQUALITY rather than forcing spurious
		// downstream propagation.
		test('two Dates with the same time are equal', () => {
			const t = 1_700_000_000_000
			expect(DEEP_EQUALITY(new Date(t), new Date(t))).toBe(true)
		})

		test('two Dates with different times are not equal', () => {
			expect(DEEP_EQUALITY(new Date(1), new Date(2))).toBe(false)
		})

		test('two RegExps with the same source and flags are equal', () => {
			expect(DEEP_EQUALITY(/foo/g, /foo/g)).toBe(true)
		})

		test('two RegExPs with different flags are not equal', () => {
			expect(DEEP_EQUALITY(/foo/g, /foo/i)).toBe(false)
		})

		test('two RegExPs with different source are not equal', () => {
			expect(DEEP_EQUALITY(/foo/, /bar/)).toBe(false)
		})
	})

	describe('cyclic structures', () => {
		// Cyclic plain objects must not stack-overflow; structurally equal cycles
		// compare equal.
		test('structurally equal cyclic objects do not overflow and compare equal', () => {
			const a: Record<string, unknown> = { name: 'root' }
			a.self = a
			const b: Record<string, unknown> = { name: 'root' }
			b.self = b
			expect(DEEP_EQUALITY(a, b)).toBe(true)
		})

		test('structurally different cyclic objects compare unequal without overflow', () => {
			const a: Record<string, unknown> = { name: 'a' }
			a.self = a
			const b: Record<string, unknown> = { name: 'b' }
			b.self = b
			expect(DEEP_EQUALITY(a, b)).toBe(false)
		})

		test('cyclic arrays do not overflow', () => {
			const a: unknown[] = [1]
			a[1] = a
			const b: unknown[] = [1]
			b[1] = b
			expect(() => DEEP_EQUALITY(a, b)).not.toThrow()
		})
	})

	describe('aliased (non-cyclic) references — ADR-0016', () => {
		// The cycle guard must be scoped to the current recursion path, not
		// "every object ever visited." An object reachable twice via different,
		// non-cyclic paths (shared/aliased substructure) must still be compared
		// independently each time, not short-circuited to true.
		test('a shared sub-object compared against two different values is not aliased away', () => {
			const shared = { val: 1 }
			const a = { p: shared, q: shared }
			const b = { p: { val: 1 }, q: { val: 2 } }
			expect(DEEP_EQUALITY(a, b)).toBe(false)
		})

		test('array elements aliasing the same default object are compared independently', () => {
			const DEFAULT = { count: 0 }
			const arrA = [DEFAULT, DEFAULT]
			const arrB = [{ count: 0 }, { count: 1 }]
			expect(DEEP_EQUALITY(arrA, arrB)).toBe(false)
		})

		test('an aliased Date is still compared by value on each occurrence', () => {
			const shared = new Date(1)
			const a = { p: shared, q: shared }
			const b = { p: new Date(1), q: new Date(2) }
			expect(DEEP_EQUALITY(a, b)).toBe(false)
		})
	})
})
