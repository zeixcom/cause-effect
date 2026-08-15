import { describe, expect, test } from 'bun:test'
import {
	type Collection,
	createCollection,
	createList,
	createState,
	type DerivedList,
	deriveList,
	isCollection,
	isDerivedList,
	isList,
	isMutableList,
	type List,
	type MutableList,
} from '../index.ts'

/* === Tests === */

describe('MutableList — the v2 name of the mutable List type', () => {
	test('createList satisfies both the new and the deprecated name', () => {
		const list: MutableList<string> = createList(['a'])
		const asDeprecated: List<string> = list
		const roundTrip: MutableList<string> = asDeprecated
		expect(roundTrip.add('b')).toBe('1')
		expect(roundTrip.get()).toEqual(['a', 'b'])
	})

	test('isMutableList matches a mutable list', () => {
		const list = createList([1, 2])
		expect(isMutableList(list)).toBe(true)
		if (isMutableList(list)) expect(list.add(3)).toBe('2')
	})

	test('isMutableList rejects non-lists and read-only sequences', () => {
		expect(isMutableList(createState(1))).toBe(false)
		expect(isMutableList(deriveList(() => [1]))).toBe(false)
		expect(isMutableList('list')).toBe(false)
	})

	test('isList stays a working alias of isMutableList', () => {
		const list = createList([1])
		expect(isList(list)).toBe(true)
		expect(isList(deriveList(() => [1]))).toBe(false)
	})
})

describe('DerivedList — the v2-facing name of the Collection type', () => {
	test('every deriveList origin satisfies both names', () => {
		const sync: DerivedList<number> = deriveList(() => [1])
		const asDeprecated: Collection<number> = sync
		const roundTrip: DerivedList<number> = asDeprecated
		expect(roundTrip.get()).toEqual([1])
	})

	test('createCollection still returns the same type', () => {
		const collection: DerivedList<string> = createCollection(() => () => {})
		expect(collection.get()).toEqual([])
	})

	test('isDerivedList matches every read-only sequence origin', () => {
		expect(isDerivedList(deriveList(() => [1]))).toBe(true)
		expect(
			isDerivedList(deriveList(async () => [1], { initial: [] as number[] })),
		).toBe(true)
		expect(isDerivedList(deriveList([], { watched: () => () => {} }))).toBe(
			true,
		)
		expect(isDerivedList(createCollection(() => () => {}))).toBe(true)
	})

	test('isDerivedList rejects mutable lists and non-lists', () => {
		expect(isDerivedList(createList([1]))).toBe(false)
		expect(isDerivedList(createState(1))).toBe(false)
		expect(isDerivedList('collection')).toBe(false)
	})

	test('isCollection stays a working alias of isDerivedList', () => {
		expect(isCollection(createCollection(() => () => {}))).toBe(true)
		expect(isCollection(createList([1]))).toBe(false)
	})
})

describe('guards preserve the tag-based taxonomy', () => {
	test('a list and a derived list are distinguishable in both directions', () => {
		const list = createList([1])
		const derived = deriveList(() => [1])
		expect(isMutableList(list) && !isMutableList(derived)).toBe(true)
		expect(isDerivedList(derived) && !isDerivedList(list)).toBe(true)
	})
})
