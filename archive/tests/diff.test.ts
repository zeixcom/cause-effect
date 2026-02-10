import { describe, expect, test } from 'bun:test'
import {
	CircularDependencyError,
	diff,
	isEqual,
	UNSET,
	type UnknownRecord,
} from '../../index.ts'

describe('diff', () => {
	describe('basic object diffing', () => {
		test('should detect no changes for identical objects', () => {
			const obj1 = { a: 1, b: 'hello' }
			const obj2 = { a: 1, b: 'hello' }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(false)
			expect(Object.keys(result.add)).toHaveLength(0)
			expect(Object.keys(result.change)).toHaveLength(0)
			expect(Object.keys(result.remove)).toHaveLength(0)
		})

		test('should detect additions', () => {
			const obj1 = { a: 1 }
			const obj2 = { a: 1, b: 'new' }
			const result = diff<{ a: number; b?: string }>(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ b: 'new' })
			expect(Object.keys(result.change)).toHaveLength(0)
			expect(Object.keys(result.remove)).toHaveLength(0)
		})

		test('should detect removals', () => {
			const obj1 = { a: 1, b: 'hello' }
			const obj2 = { a: 1 }
			const result = diff<{ a: number; b?: string }>(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(Object.keys(result.add)).toHaveLength(0)
			expect(Object.keys(result.change)).toHaveLength(0)
			expect(result.remove).toEqual({ b: UNSET })
		})

		test('should detect changes', () => {
			const obj1 = { a: 1, b: 'hello' }
			const obj2 = { a: 2, b: 'hello' }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(Object.keys(result.add)).toHaveLength(0)
			expect(result.change).toEqual({ a: 2 })
			expect(Object.keys(result.remove)).toHaveLength(0)
		})

		test('should detect multiple changes', () => {
			const obj1 = { a: 1, b: 'hello', c: true }
			const obj2 = { a: 2, d: 'new', c: true }
			const result = diff<{
				a: number
				b?: string
				c: boolean
				d?: string
			}>(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ d: 'new' })
			expect(result.change).toEqual({ a: 2 })
			expect(result.remove).toEqual({ b: UNSET })
		})
	})

	describe('primitive value handling', () => {
		test('should handle string changes', () => {
			const obj1 = { text: 'hello' }
			const obj2 = { text: 'world' }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ text: 'world' })
		})

		test('should handle number changes including special values', () => {
			const obj1 = { num: 42, nan: NaN, zero: -0 }
			const obj2 = { num: 43, nan: NaN, zero: +0 }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ num: 43, zero: +0 })
		})

		test('should handle boolean changes', () => {
			const obj1 = { flag: true }
			const obj2 = { flag: false }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ flag: false })
		})
	})

	describe('array handling', () => {
		test('should detect no changes in identical arrays', () => {
			const obj1 = { arr: [1, 2, 3] }
			const obj2 = { arr: [1, 2, 3] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(false)
		})

		test('should detect changes in arrays', () => {
			const obj1 = { arr: [1, 2, 3] }
			const obj2 = { arr: [1, 2, 4] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ arr: [1, 2, 4] })
		})

		test('should detect length changes in arrays', () => {
			const obj1 = { arr: [1, 2, 3] }
			const obj2 = { arr: [1, 2] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ arr: [1, 2] })
		})

		test('should handle empty arrays', () => {
			const obj1 = { arr: [] as number[] }
			const obj2 = { arr: [1] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ arr: [1] })
		})

		test('should handle arrays with complex objects', () => {
			const obj1 = { arr: [{ id: 1, name: 'a' }] }
			const obj2 = { arr: [{ id: 1, name: 'b' }] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ arr: [{ id: 1, name: 'b' }] })
		})

		test('should handle nested arrays', () => {
			const obj1 = {
				matrix: [
					[1, 2],
					[3, 4],
				],
			}
			const obj2 = {
				matrix: [
					[1, 2],
					[3, 5],
				],
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({
				matrix: [
					[1, 2],
					[3, 5],
				],
			})
		})
	})

	describe('nested object handling', () => {
		test('should detect no changes in nested objects', () => {
			const obj1 = {
				user: { id: 1, profile: { name: 'John', age: 30 } },
			}
			const obj2 = {
				user: { id: 1, profile: { name: 'John', age: 30 } },
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(false)
		})

		test('should detect changes in nested objects', () => {
			const obj1 = {
				user: { id: 1, profile: { name: 'John', age: 30 } },
			}
			const obj2 = {
				user: { id: 1, profile: { name: 'Jane', age: 30 } },
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({
				user: { id: 1, profile: { name: 'Jane', age: 30 } },
			})
		})

		test('should handle deeply nested structures', () => {
			const obj1 = {
				a: { b: { c: { d: { e: 'deep' } } } },
			}
			const obj2 = {
				a: { b: { c: { d: { e: 'deeper' } } } },
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({
				a: { b: { c: { d: { e: 'deeper' } } } },
			})
		})
	})

	describe('type change handling', () => {
		test('should handle changes from primitive to object', () => {
			const obj1 = { value: 'string' }
			const obj2 = { value: { type: 'object' } }
			const result = diff<{ value: string | { type: string } }>(
				obj1,
				obj2,
			)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ value: { type: 'object' } })
		})

		test('should handle changes from array to object', () => {
			const obj1 = { data: [1, 2, 3] }
			const obj2 = { data: { 0: 1, 1: 2, 2: 3 } }
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ data: { 0: 1, 1: 2, 2: 3 } })
		})

		test('should handle changes from object to array', () => {
			const obj1 = { data: { a: 1, b: 2 } }
			const obj2 = { data: [1, 2] }
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ data: [1, 2] })
		})
	})

	describe('special object types', () => {
		test('should handle Date objects', () => {
			const date1 = new Date('2023-01-01')
			const date2 = new Date('2023-01-02')
			const obj1 = { timestamp: date1 }
			const obj2 = { timestamp: date2 }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ timestamp: date2 })
		})

		test('should handle RegExp objects', () => {
			const regex1 = /hello/g
			const regex2 = /world/g
			const obj1 = { pattern: regex1 }
			const obj2 = { pattern: regex2 }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ pattern: regex2 })
		})

		test('should handle identical special objects', () => {
			const date = new Date('2023-01-01')
			const obj1 = { timestamp: date }
			const obj2 = { timestamp: date }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(false)
		})
	})

	describe('edge cases and error handling', () => {
		test('should handle empty objects', () => {
			const result = diff({}, {})
			expect(result.changed).toBe(false)
		})

		test('should detect circular references and throw error', () => {
			const circular1: UnknownRecord = { a: 1 }
			circular1.self = circular1

			const circular2: UnknownRecord = { a: 1 }
			circular2.self = circular2

			expect(() => diff(circular1, circular2)).toThrow(
				CircularDependencyError,
			)
		})

		test('should handle objects with Symbol keys', () => {
			const sym = Symbol('test')
			const obj1 = {
				[sym]: 'value1',
				normal: 'prop',
			}
			const obj2 = {
				[sym]: 'value2',
				normal: 'prop',
			}

			// Since Object.keys() doesn't include symbols,
			// the diff should not detect the symbol property change
			const result = diff(obj1, obj2)
			expect(result.changed).toBe(false)
		})

		test('should handle objects with non-enumerable properties', () => {
			const obj1 = { a: 1 }
			const obj2 = { a: 1 }

			Object.defineProperty(obj1, 'hidden', {
				value: 'secret1',
				enumerable: false,
			})

			Object.defineProperty(obj2, 'hidden', {
				value: 'secret2',
				enumerable: false,
			})

			// Since Object.keys() doesn't include non-enumerable properties,
			// the diff should not detect the hidden property change
			const result = diff(obj1, obj2)
			expect(result.changed).toBe(false)
		})
	})

	describe('performance edge cases', () => {
		test('should handle large objects efficiently', () => {
			const createLargeObject = (size: number, seed: number = 0) => {
				const obj: Record<string, number> = {}
				for (let i = 0; i < size; i++) {
					obj[`prop${i}`] = i + seed
				}
				return obj
			}

			const obj1 = createLargeObject(1000)
			const obj2 = createLargeObject(1000, 1) // Same structure, different values

			const start = performance.now()
			const result = diff(obj1, obj2)
			const duration = performance.now() - start

			expect(result.changed).toBe(true)
			expect(Object.keys(result.change)).toHaveLength(1000)
			expect(duration).toBeLessThan(100) // Should complete within 100ms
		})

		test('should handle deeply nested structures without stack overflow', () => {
			// biome-ignore lint/suspicious/noExplicitAny: testing purposes
			const createDeepObject = (depth: number): any => {
				let obj: UnknownRecord = { value: 'leaf' }
				for (let i = 0; i < depth; i++) {
					obj = { [`level${i}`]: obj }
				}
				return obj
			}

			const obj1 = createDeepObject(100)
			const obj2 = createDeepObject(100)
			obj2.level99.level98.level97.value = 'changed'

			const result = diff(obj1, obj2)
			expect(result.changed).toBe(true)
		})
	})

	describe('optional keys handling', () => {
		type OptionalKeysType = {
			required: string
			optional?: number
			maybeUndefined?: string
		}

		test('should handle optional keys correctly', () => {
			const obj1: OptionalKeysType = {
				required: 'test',
			}
			const obj2: OptionalKeysType = {
				required: 'test',
				optional: 42,
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ optional: 42 })
		})

		test('should handle undefined optional keys', () => {
			const obj1: OptionalKeysType = {
				required: 'test',
				maybeUndefined: 'defined',
			}
			const obj2: OptionalKeysType = {
				required: 'test',
				maybeUndefined: undefined,
			}
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ maybeUndefined: undefined })
		})
	})

	describe('array normalization to records', () => {
		test('should correctly normalize arrays to records for comparison', () => {
			const obj1 = { items: ['a', 'b', 'c'] }
			const obj2 = { items: ['a', 'x', 'c'] }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ items: ['a', 'x', 'c'] })
		})

		test('should handle sparse arrays correctly', () => {
			const sparse1: string[] = []
			sparse1[0] = 'a'
			sparse1[2] = 'c'

			const sparse2: string[] = []
			sparse2[0] = 'a'
			sparse2[1] = 'b'
			sparse2[2] = 'c'

			const obj1 = { sparse: sparse1 }
			const obj2 = { sparse: sparse2 }
			const result = diff(obj1, obj2)

			expect(result.changed).toBe(true)
			expect(result.change).toEqual({ sparse: sparse2 })
		})
	})

	describe('isEqual function', () => {
		describe('primitives and fast paths', () => {
			test('should handle identical values', () => {
				expect(isEqual(1, 1)).toBe(true)
				expect(isEqual('hello', 'hello')).toBe(true)
				expect(isEqual(true, true)).toBe(true)
				expect(isEqual(null, null)).toBe(true)
				expect(isEqual(undefined, undefined)).toBe(true)
			})

			test('should handle different primitives', () => {
				expect(isEqual(1, 2)).toBe(false)
				expect(isEqual('hello', 'world')).toBe(false)
				expect(isEqual(true, false)).toBe(false)
				expect(isEqual(null, undefined)).toBe(false)
			})

			test('should handle special number values', () => {
				expect(isEqual(NaN, NaN)).toBe(true)
				expect(isEqual(-0, +0)).toBe(false)
				expect(isEqual(Infinity, Infinity)).toBe(true)
				expect(isEqual(-Infinity, Infinity)).toBe(false)
			})

			test('should handle type mismatches', () => {
				// @ts-expect-error deliberate type mismatch
				expect(isEqual(1, '1')).toBe(false)
				// @ts-expect-error deliberate type mismatch
				expect(isEqual(true, 1)).toBe(false)
				expect(isEqual(null, 0)).toBe(false)
				expect(isEqual(undefined, '')).toBe(false)
			})

			test('should handle same object reference', () => {
				const obj = { a: 1 }
				expect(isEqual(obj, obj)).toBe(true)

				const arr = [1, 2, 3]
				expect(isEqual(arr, arr)).toBe(true)
			})
		})

		describe('objects', () => {
			test('should compare objects with same content', () => {
				expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
				expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
			})

			test('should detect different object content', () => {
				expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
				expect(isEqual({ a: 1 }, { b: 1 })).toBe(false)
				expect(isEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
			})

			test('should handle nested objects', () => {
				const obj1 = { user: { name: 'John', age: 30 } }
				const obj2 = { user: { name: 'John', age: 30 } }
				const obj3 = { user: { name: 'Jane', age: 30 } }

				expect(isEqual(obj1, obj2)).toBe(true)
				expect(isEqual(obj1, obj3)).toBe(false)
			})

			test('should handle empty objects', () => {
				expect(isEqual({}, {})).toBe(true)
				expect(isEqual({}, { a: 1 })).toBe(false)
			})
		})

		describe('arrays', () => {
			test('should compare arrays with same content', () => {
				expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true)
				expect(isEqual([], [])).toBe(true)
			})

			test('should detect different array content', () => {
				expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false)
				expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
				expect(isEqual([1, 2, 3], [3, 2, 1])).toBe(false)
			})

			test('should handle nested arrays', () => {
				const arr1 = [
					[1, 2],
					[3, 4],
				]
				const arr2 = [
					[1, 2],
					[3, 4],
				]
				const arr3 = [
					[1, 2],
					[3, 5],
				]

				expect(isEqual(arr1, arr2)).toBe(true)
				expect(isEqual(arr1, arr3)).toBe(false)
			})

			test('should handle arrays with objects', () => {
				const arr1 = [{ a: 1 }, { b: 2 }]
				const arr2 = [{ a: 1 }, { b: 2 }]
				const arr3 = [{ a: 2 }, { b: 2 }]

				expect(isEqual(arr1, arr2)).toBe(true)
				expect(isEqual(arr1, arr3)).toBe(false)
			})
		})

		describe('mixed types', () => {
			test('should handle array vs object', () => {
				expect(isEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
				expect(isEqual({ length: 2 }, [1, 2])).toBe(false)
			})

			test('should handle object vs primitive', () => {
				// @ts-expect-error deliberate type mismatch
				expect(isEqual({ a: 1 }, 'object')).toBe(false)
				// @ts-expect-error deliberate type mismatch
				expect(isEqual(42, { value: 42 })).toBe(false)
			})

			test('should handle complex mixed structures', () => {
				const obj1 = {
					data: [1, 2, { nested: true }],
					meta: { count: 3 },
				}
				const obj2 = {
					data: [1, 2, { nested: true }],
					meta: { count: 3 },
				}
				const obj3 = {
					data: [1, 2, { nested: false }],
					meta: { count: 3 },
				}

				expect(isEqual(obj1, obj2)).toBe(true)
				expect(isEqual(obj1, obj3)).toBe(false)
			})
		})

		describe('edge cases', () => {
			test('should handle circular references', () => {
				const circular1: UnknownRecord = { a: 1 }
				circular1.self = circular1

				const circular2: UnknownRecord = { a: 1 }
				circular2.self = circular2

				expect(() => isEqual(circular1, circular2)).toThrow(
					CircularDependencyError,
				)
			})

			test('should handle special objects', () => {
				const date1 = new Date('2023-01-01')
				const date2 = new Date('2023-01-01')
				const date3 = new Date('2023-01-02')

				// Different Date objects with same time should be false (reference equality for special objects)
				expect(isEqual(date1, date1)).toBe(true) // same reference
				expect(isEqual(date1, date2)).toBe(false) // different references
				expect(isEqual(date1, date3)).toBe(false)
			})

			test('should handle null and undefined edge cases', () => {
				expect(isEqual(null, null)).toBe(true)
				expect(isEqual(undefined, undefined)).toBe(true)
				expect(isEqual(null, undefined)).toBe(false)
				expect(isEqual({}, null)).toBe(false)
				expect(isEqual([], undefined)).toBe(false)
			})
		})

		describe('performance comparison', () => {
			test('should demonstrate isEqual vs Object.is difference', () => {
				// Objects with same content but different references
				const obj1 = {
					user: { name: 'John', age: 30 },
					items: [1, 2, 3],
				}
				const obj2 = {
					user: { name: 'John', age: 30 },
					items: [1, 2, 3],
				}

				// Object.is fails for content equality
				expect(Object.is(obj1, obj2)).toBe(false)

				// isEqual succeeds for content equality
				expect(isEqual(obj1, obj2)).toBe(true)

				// Both work for reference equality
				expect(Object.is(obj1, obj1)).toBe(true)
				expect(isEqual(obj1, obj1)).toBe(true)

				// Both work for primitive equality
				expect(Object.is(42, 42)).toBe(true)
				expect(isEqual(42, 42)).toBe(true)
			})
		})
	})

	describe('non-plain object type safety', () => {
		test('should handle Symbol objects without throwing TypeError', () => {
			const symbol = Symbol('test')
			const obj = { a: 1 }

			// These should not throw after we fix the bug
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(symbol, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, symbol)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(symbol, obj)).not.toThrow()
		})

		test('should report additions when diffing from Symbol to valid object', () => {
			const symbol = Symbol('test')
			const obj = { a: 1, b: 'hello' }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(symbol, obj)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ a: 1, b: 'hello' })
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({})
		})

		test('should report removals when diffing from valid object to Symbol', () => {
			const obj = { a: 1, b: 'hello' }
			const symbol = Symbol('test')

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(obj, symbol)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({})
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({ a: 1, b: 'hello' })
		})

		test('should handle Symbol to Symbol diff with no changes', () => {
			const symbol = Symbol('test')

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(symbol, symbol)

			expect(result.changed).toBe(false)
			expect(result.add).toEqual({})
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({})
		})

		test('should handle different Symbols as changed', () => {
			const symbol1 = Symbol('test1')
			const symbol2 = Symbol('test2')

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(symbol1, symbol2)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({})
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({})
		})

		test('should handle Date objects without throwing TypeError', () => {
			const date = new Date('2023-01-01')
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(date, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, date)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(date, obj)).not.toThrow()
		})

		test('should report additions when diffing from Date to valid object', () => {
			const date = new Date('2023-01-01')
			const obj = { a: 1, b: 'hello' }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(date, obj)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ a: 1, b: 'hello' })
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({})
		})

		test('should report removals when diffing from valid object to Date', () => {
			const obj = { a: 1, b: 'hello' }
			const date = new Date('2023-01-01')

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(obj, date)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({})
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({ a: 1, b: 'hello' })
		})

		test('should handle Map objects without throwing TypeError', () => {
			const map = new Map([['key', 'value']])
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(map, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, map)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(map, obj)).not.toThrow()
		})

		test('should report additions when diffing from Map to valid object', () => {
			const map = new Map([['key', 'value']])
			const obj = { x: 10, y: 20 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result = diff(map, obj)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ x: 10, y: 20 })
			expect(result.change).toEqual({})
			expect(result.remove).toEqual({})
		})

		test('should handle Set objects without throwing TypeError', () => {
			const set = new Set([1, 2, 3])
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(set, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, set)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(set, obj)).not.toThrow()
		})

		test('should handle Promise objects without throwing TypeError', () => {
			const promise = Promise.resolve('test')
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(promise, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, promise)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(promise, obj)).not.toThrow()
		})

		test('should handle RegExp objects without throwing TypeError', () => {
			const regex = /test/g
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(regex, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, regex)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(regex, obj)).not.toThrow()
		})

		test('should handle Function objects without throwing TypeError', () => {
			const func = () => 'test'
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(func, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, func)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(func, obj)).not.toThrow()
		})

		test('should handle Error objects without throwing TypeError', () => {
			const error = new Error('test error')
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(error, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, error)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(error, obj)).not.toThrow()
		})

		test('should handle WeakMap objects without throwing TypeError', () => {
			const weakMap = new WeakMap()
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(weakMap, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, weakMap)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(weakMap, obj)).not.toThrow()
		})

		test('should handle WeakSet objects without throwing TypeError', () => {
			const weakSet = new WeakSet()
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(weakSet, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, weakSet)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(weakSet, obj)).not.toThrow()
		})

		test('should handle ArrayBuffer objects without throwing TypeError', () => {
			const buffer = new ArrayBuffer(8)
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(buffer, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, buffer)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(buffer, obj)).not.toThrow()
		})

		test('should handle class instances without throwing TypeError', () => {
			class TestClass {
				constructor(public value: string) {}
			}
			const instance = new TestClass('test')
			const obj = { a: 1 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(instance, obj)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => diff(obj, instance)).not.toThrow()
			// @ts-expect-error Testing runtime behavior with non-plain object types
			expect(() => isEqual(instance, obj)).not.toThrow()
		})

		test('should report additions/removals with mixed valid and invalid objects', () => {
			const func = () => 'test'
			const obj1 = { a: 1 }
			const obj2 = { b: 2 }

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result1 = diff(func, obj1)
			expect(result1.changed).toBe(true)
			expect(result1.add).toEqual({ a: 1 })
			expect(result1.remove).toEqual({})

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result2 = diff(obj2, func)
			expect(result2.changed).toBe(true)
			expect(result2.add).toEqual({})
			expect(result2.remove).toEqual({ b: 2 })

			// @ts-expect-error Testing runtime behavior with non-plain object types
			const result3 = diff(func, func)
			expect(result3.changed).toBe(false)
			expect(result3.add).toEqual({})
			expect(result3.remove).toEqual({})
		})
	})
})

describe('sparse array handling', () => {
	test('should properly diff sparse array representations', () => {
		// Simulate what happens in store: sparse array [10, 30, 50] with keys ["0", "2", "4"]
		// is represented as a regular array [10, 30, 50] when passed to diff()
		const oldSparseArray: Record<number, number> = [10, 30, 50] // What current() returns for sparse store
		const newDenseArray: Record<number, number> = [100, 200, 300] // What user wants to set

		const result = diff(oldSparseArray, newDenseArray)

		// The problem: diff sees this as simple value changes at indices 0, 1, 2
		// But the store actually has sparse keys "0", "2", "4"
		// So when reconcile tries to apply changes, only indices 0 and 2 work
		expect(result.change).toEqual({
			'0': 100, // This works (key "0" exists)
			'1': 200, // This fails (key "1" doesn't exist in sparse structure)
			'2': 300, // This works (key "2" exists)
		})
		expect(result.add).toEqual({})
		expect(result.remove).toEqual({})
		expect(result.changed).toBe(true)
	})

	test('should handle array-to-object conversion when context suggests sparse structure', () => {
		// This test demonstrates the core issue: we need context about the original structure
		// to properly handle sparse array replacement
		const oldSparseAsObject = { '0': 10, '2': 30, '4': 50 } // Actual sparse structure
		const newDenseArray: Record<number, number> = [100, 200, 300] // User input

		const result = diff(oldSparseAsObject, newDenseArray)

		// This should remove old sparse keys and add new dense keys
		expect(result.remove).toEqual({
			'4': UNSET, // Key "4" should be removed (key "2" gets reused)
		})
		expect(result.add).toEqual({
			'1': 200, // Key "1" should be added
		})
		expect(result.change).toEqual({
			'0': 100, // Key "0" changes value from 10 to 100
			'2': 300, // Key "2" changes value from 30 to 300
		})
		expect(result.changed).toBe(true)
	})
})
