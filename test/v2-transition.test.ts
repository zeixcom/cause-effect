import { describe, expect, test } from 'bun:test'
import {
	type Collection,
	type CollectionCallback,
	type CollectionChanges,
	type CollectionSource,
	createCell,
	createCollection,
	createEffect,
	createList,
	createScope,
	createSignal,
	createState,
	createStore,
	type DeriveCellOptions,
	type DeriveCollectionCallback,
	type DerivedList,
	type DeriveSignalOptions,
	deriveCell,
	deriveList,
	deriveSignal,
	deriveStore,
	isCollection,
	isDerivedList,
	isList,
	isMemo,
	isMutableList,
	isMutableStore,
	isState,
	isStore,
	isTask,
	type List,
	type ListCallback,
	type ListChanges,
	type ListSource,
	type MutableList,
	type MutableStore,
	type PerItemCallback,
	type Signal,
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

describe('ListSource/ListCallback/ListChanges/PerItemCallback — terminal 2.0 names, bridged early', () => {
	test('ListSource round-trips through the deprecated CollectionSource alias', () => {
		const source: ListSource<number> = createList([1, 2])
		const asDeprecated: CollectionSource<number> = source
		const roundTrip: ListSource<number> = asDeprecated
		expect(deriveList(roundTrip, n => n * 2).get()).toEqual([2, 4])
	})

	test('ListChanges round-trips through the deprecated CollectionChanges alias', () => {
		const changes: ListChanges<number> = { add: [1, 2] }
		const asDeprecated: CollectionChanges<number> = changes
		const roundTrip: ListChanges<number> = asDeprecated
		expect(roundTrip.add).toEqual([1, 2])
	})

	test('ListCallback round-trips through the deprecated CollectionCallback alias and drives deriveList', () => {
		let push: ((changes: ListChanges<number>) => void) | undefined
		const watched: ListCallback<number> = apply => {
			push = apply
			return () => {}
		}
		const asDeprecated: CollectionCallback<number> = watched
		const roundTrip: ListCallback<number> = asDeprecated
		const list = deriveList<number>([], { watched: roundTrip })
		const dispose = createScope(() => {
			createEffect(() => {
				list.get()
			})
		})
		push?.({ add: [1, 2, 3] })
		expect(list.get()).toEqual([1, 2, 3])
		dispose()
	})

	test('PerItemCallback round-trips through the deprecated DeriveCollectionCallback alias and drives deriveList', () => {
		const source = createList([1, 2, 3])
		const doubler: PerItemCallback<number, number> = (n: number) => n * 2
		const asDeprecated: DeriveCollectionCallback<number, number> = doubler
		const roundTrip: PerItemCallback<number, number> = asDeprecated
		expect(deriveList(source, roundTrip).get()).toEqual([2, 4, 6])
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

describe('createCell/deriveCell — the terminal v2 names of the single-value factories', () => {
	// ADR-0018's Revision (2026-08-17) renamed the narrow single-value shape from `Signal`
	// to `Cell`: `Signal` returns to its 1.x structural umbrella meaning. The 1.5.0 bridge
	// names `createSignal`/`deriveSignal` are deprecated aliases of the terminal names.
	test('deriveCell returns a Signal for every origin', () => {
		const cleanup = createScope(() => {
			const sync: Signal<number> = deriveCell(() => 1)
			expect(sync.get()).toBe(1)
			expect(isMemo(sync)).toBe(true)

			const async_: Signal<string> = deriveCell(async () => 'hello', {
				initial: '',
			})
			expect(isTask(async_)).toBe(true)
		})
		cleanup()
	})

	test('createCell is the single-value alias of createState — no shape dispatch', () => {
		const count = createCell(42)
		expect(isState(count)).toBe(true)
		expect(count.get()).toBe(42)

		// The value is taken verbatim: an array is held as an array value, not a List.
		const array = createCell([1, 2])
		expect(isState(array)).toBe(true)
		expect(isList(array)).toBe(false)
		expect(array.get()).toEqual([1, 2])
	})

	test('createSignal keeps its shape dispatch — unchanged by the flip', () => {
		expect(isState(createSignal(42))).toBe(true)
		expect(isList(createSignal([1, 2]))).toBe(true)
		expect(isStore(createSignal({ a: 1 }))).toBe(true)
	})

	test('deriveSignal stays a working alias of deriveCell', () => {
		const viaAlias: Signal<number> = deriveSignal(() => 2)
		expect(viaAlias.get()).toBe(2)
	})

	test('DeriveCellOptions round-trips through the deprecated DeriveSignalOptions alias', () => {
		const options: DeriveSignalOptions<number> = { initial: 0 }
		const asCanonical: DeriveCellOptions<number> = options
		const roundTrip: DeriveSignalOptions<number> = asCanonical
		expect(roundTrip.initial).toBe(0)
	})
})
