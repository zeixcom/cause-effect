import { describe, expect, test } from 'bun:test'
import {
	type Collection,
	createCollection,
	createList,
	createState,
	createStore,
	type DerivedList,
	deriveList,
	deriveStore,
	isCollection,
	isDerivedList,
	isList,
	isMutableList,
	isMutableStore,
	isStore,
	type List,
	type MutableList,
	type MutableStore,
	type Store,
} from '../index.ts'

/* === Tests === */

type Config = { debug: boolean; level?: number }

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

describe('MutableStore — the v2 name of the mutable Store type', () => {
	test('createStore satisfies both the new and the deprecated name', () => {
		const store: MutableStore<Config> = createStore({ debug: false })
		const asDeprecated: Store<Config> = store
		const roundTrip: MutableStore<Config> = asDeprecated
		expect(roundTrip.add('level', 3)).toBe('level')
		expect(roundTrip.get()).toEqual({ debug: false, level: 3 })
	})

	test('isMutableStore matches a mutable store and narrows to its write methods', () => {
		const store = createStore({ a: 1 })
		expect(isMutableStore(store)).toBe(true)
		if (isMutableStore(store)) expect(store.add('b', 2)).toBe('b')
	})

	test('isMutableStore rejects derived stores and non-stores', () => {
		expect(isMutableStore(deriveStore(() => ({ a: 1 })))).toBe(false)
		expect(isMutableStore(createState(1))).toBe(false)
		expect(isMutableStore(createList([1]))).toBe(false)
		expect(isMutableStore('store')).toBe(false)
	})

	test('isStore stays the tag-based guard, matching derived stores too', () => {
		// MutableStore and DerivedStore share the 'Store' tag in 1.x — pinned here so
		// the deprecation of isStore never quietly narrows its runtime behavior.
		expect(isStore(createStore({ a: 1 }))).toBe(true)
		expect(isStore(deriveStore(() => ({ a: 1 })))).toBe(true)
		expect(isStore(createState(1))).toBe(false)
	})
})
