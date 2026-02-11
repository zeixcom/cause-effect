import { describe, expect, test } from 'bun:test'
import {
	batch,
	createCollection,
	createEffect,
	createScope,
	createState,
	type DiffResult,
	isCollection,
} from '../index.ts'

/* === Tests === */

describe('createCollection', () => {
	test('should create a collection with initial values', () => {
		const col = createCollection(() => () => {}, { value: [1, 2, 3] })

		expect(col.get()).toEqual([1, 2, 3])
		expect(col.length).toBe(3)
		expect(isCollection(col)).toBe(true)
	})

	test('should create an empty collection', () => {
		const col = createCollection<number>(() => () => {})

		expect(col.get()).toEqual([])
		expect(col.length).toBe(0)
	})

	test('should support at(), byKey(), keyAt(), indexOfKey()', () => {
		const col = createCollection(() => () => {}, {
			value: [
				{ id: 'a', name: 'Alice' },
				{ id: 'b', name: 'Bob' },
			],
			keyConfig: item => item.id,
		})

		expect(col.keyAt(0)).toBe('a')
		expect(col.keyAt(1)).toBe('b')
		expect(col.indexOfKey('b')).toBe(1)
		// biome-ignore lint/style/noNonNullAssertion: test
		expect(col.byKey('a')!.get()).toEqual({ id: 'a', name: 'Alice' })
		// biome-ignore lint/style/noNonNullAssertion: test
		expect(col.at(1)!.get()).toEqual({ id: 'b', name: 'Bob' })
	})

	test('should support iteration', () => {
		const col = createCollection(() => () => {}, { value: [10, 20, 30] })

		const values = []
		for (const signal of col) values.push(signal.get())
		expect(values).toEqual([10, 20, 30])
	})

	test('should call start callback on first effect access', () => {
		let started = false
		let cleaned = false

		const col = createCollection(
			() => {
				started = true
				return () => {
					cleaned = true
				}
			},
			{ value: [1] },
		)

		expect(started).toBe(false)

		const dispose = createScope(() => {
			createEffect(() => {
				void col.length
			})
		})

		expect(started).toBe(true)
		expect(cleaned).toBe(false)

		dispose()
		expect(cleaned).toBe(true)
	})

	test('should add items via applyChanges', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection<number>(applyChanges => {
			apply = applyChanges
			return () => {}
		})

		const values: number[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				values.push(col.get())
			})
		})

		expect(values).toEqual([[]])

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({ changed: true, add: { a: 1, b: 2 }, change: {}, remove: {} })

		expect(values.length).toBe(2)
		expect(values[1]).toEqual([1, 2])
		expect(col.length).toBe(2)

		dispose()
	})

	test('should change item values via applyChanges', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection(
			applyChanges => {
				apply = applyChanges
				return () => {}
			},
			{ value: [{ id: 'x', val: 1 }], keyConfig: item => item.id },
		)

		const values: { id: string; val: number }[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				values.push(col.get())
			})
		})

		expect(values[0]).toEqual([{ id: 'x', val: 1 }])

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({
			changed: true,
			add: {},
			change: { x: { id: 'x', val: 42 } },
			remove: {},
		})

		expect(values.length).toBe(2)
		expect(values[1]).toEqual([{ id: 'x', val: 42 }])

		dispose()
	})

	test('should remove items via applyChanges', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection(
			applyChanges => {
				apply = applyChanges
				return () => {}
			},
			{
				value: [
					{ id: 'a', v: 1 },
					{ id: 'b', v: 2 },
					{ id: 'c', v: 3 },
				],
				keyConfig: item => item.id,
			},
		)

		const values: { id: string; v: number }[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				values.push(col.get())
			})
		})

		expect(values[0]).toEqual([
			{ id: 'a', v: 1 },
			{ id: 'b', v: 2 },
			{ id: 'c', v: 3 },
		])

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({ changed: true, add: {}, change: {}, remove: { b: null } })

		expect(values.length).toBe(2)
		expect(values[1]).toEqual([
			{ id: 'a', v: 1 },
			{ id: 'c', v: 3 },
		])
		expect(col.length).toBe(2)

		dispose()
	})

	test('should handle mixed add/change/remove in one applyChanges', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection(
			applyChanges => {
				apply = applyChanges
				return () => {}
			},
			{
				value: [
					{ id: 'a', v: 1 },
					{ id: 'b', v: 2 },
				],
				keyConfig: item => item.id,
			},
		)

		const values: { id: string; v: number }[][] = []
		const dispose = createScope(() => {
			createEffect(() => {
				values.push(col.get())
			})
		})

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({
			changed: true,
			add: { c: { id: 'c', v: 3 } },
			change: { a: { id: 'a', v: 10 } },
			remove: { b: null },
		})

		expect(values.length).toBe(2)
		expect(values[1]).toEqual([
			{ id: 'a', v: 10 },
			{ id: 'c', v: 3 },
		])

		dispose()
	})

	test('should skip applyChanges when changed is false', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection(
			applyChanges => {
				apply = applyChanges
				return () => {}
			},
			{ value: [1] },
		)

		let callCount = 0
		const dispose = createScope(() => {
			createEffect(() => {
				void col.get()
				callCount++
			})
		})

		expect(callCount).toBe(1)

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({ changed: false, add: {}, change: {}, remove: {} })

		expect(callCount).toBe(1)

		dispose()
	})

	test('should support custom key config with string prefix', () => {
		const col = createCollection(() => () => {}, {
			value: [10, 20],
			keyConfig: 'item-',
		})

		expect(col.keyAt(0)).toBe('item-0')
		expect(col.keyAt(1)).toBe('item-1')
		// biome-ignore lint/style/noNonNullAssertion: test
		expect(col.byKey('item-0')!.get()).toBe(10)
	})

	test('should support custom createItem factory', () => {
		let guardCalled = false
		const col = createCollection(() => () => {}, {
			value: [5, 10],
			createItem: (_key, value) =>
				createState(value, {
					guard: (v): v is number => {
						guardCalled = true
						return typeof v === 'number'
					},
				}),
		})

		expect(col.get()).toEqual([5, 10])
		expect(guardCalled).toBe(true)
	})

	test('should support deriveCollection chaining', () => {
		const col = createCollection(() => () => {}, { value: [1, 2, 3] })
		const doubled = col.deriveCollection((v: number) => v * 2)

		expect(doubled.get()).toEqual([2, 4, 6])
		expect(isCollection(doubled)).toBe(true)
	})

	test('should trigger effects on structural changes', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection<string>(applyChanges => {
			apply = applyChanges
			return () => {}
		})

		let effectCount = 0
		const dispose = createScope(() => {
			createEffect(() => {
				void col.length
				effectCount++
			})
		})

		expect(effectCount).toBe(1)

		// biome-ignore lint/style/noNonNullAssertion: test
		apply!({ changed: true, add: { a: 'hello' }, change: {}, remove: {} })

		expect(effectCount).toBe(2)
		expect(col.length).toBe(1)

		dispose()
	})

	test('should batch multiple applyChanges calls', () => {
		let apply: ((changes: DiffResult) => void) | undefined
		const col = createCollection<number>(applyChanges => {
			apply = applyChanges
			return () => {}
		})

		let effectCount = 0
		const dispose = createScope(() => {
			createEffect(() => {
				void col.get()
				effectCount++
			})
		})

		expect(effectCount).toBe(1)

		batch(() => {
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ changed: true, add: { a: 1 }, change: {}, remove: {} })
			// biome-ignore lint/style/noNonNullAssertion: test
			apply!({ changed: true, add: { b: 2 }, change: {}, remove: {} })
		})

		expect(effectCount).toBe(2)
		expect(col.get()).toEqual([1, 2])

		dispose()
	})

	test('should activate via keys() access in effect', () => {
		let started = false
		const col = createCollection(
			() => {
				started = true
				return () => {}
			},
			{ value: [1] },
		)

		expect(started).toBe(false)

		const dispose = createScope(() => {
			createEffect(() => {
				void Array.from(col.keys())
			})
		})

		expect(started).toBe(true)

		dispose()
	})
})
