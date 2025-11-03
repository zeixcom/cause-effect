import { describe, expect, test } from 'bun:test'
import { CircularDependencyError, diff, UNSET } from '..'

type UnknownRecord = Record<string, unknown & {}>

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
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

			expect(result.changed).toBe(true)
			expect(result.add).toEqual({ b: 'new' })
			expect(Object.keys(result.change)).toHaveLength(0)
			expect(Object.keys(result.remove)).toHaveLength(0)
		})

		test('should detect removals', () => {
			const obj1 = { a: 1, b: 'hello' }
			const obj2 = { a: 1 }
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

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
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

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
			const result = diff(obj1 as UnknownRecord, obj2 as UnknownRecord)

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
		test('should throw error for non-record inputs', () => {
			// @ts-expect-error deliberate invalid input
			expect(() => diff('string', {})).toThrow(
				'diff() requires both arguments to be records (plain objects)',
			)
			// @ts-expect-error deliberate invalid input
			expect(() => diff({}, 'string')).toThrow(
				'diff() requires both arguments to be records (plain objects)',
			)
			// @ts-expect-error deliberate invalid input
			expect(() => diff(null, {})).toThrow(
				'diff() requires both arguments to be records (plain objects)',
			)
		})

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
			maybeUndefined?: string | undefined
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
})
