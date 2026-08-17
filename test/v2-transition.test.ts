import { describe, expect, test } from 'bun:test'
import {
	type Cell,
	createCell,
	createEffect,
	createList,
	createScope,
	createState,
	createStore,
	deriveComputed,
	deriveList,
	deriveStore,
	isCell,
	isList,
	isMutableCell,
	isMutableList,
	isMutableSignal,
	isMutableStore,
	isSignal,
	isStore,
	type List,
	type ListCallback,
	type ListChanges,
	type ListSource,
	type MutableCell,
	type MutableList,
	type MutableStore,
	type PerItemCallback,
	type Signal,
} from '../index.ts'

/* === Tests ===
 *
 * ADR-0018 collapses the 1.x nine-type taxonomy into six types indexed by shape ×
 * mutability. `Symbol.toStringTag` carries only the shape ('Cell' | 'List' | 'Store'),
 * so a guard for the readonly base (`isList`, `isStore`) matches both the mutable and the
 * readonly member of a shape, and a `isMutable*` guard additionally requires write access.
 *
 * ADR-0018's Revision 2026-08-17 adds a second transition on top of the first: the
 * single-value shape, initially named `Signal`, is renamed to `Cell` (`isCell`/`isMutableCell`,
 * tag `'Cell'`). `Signal` is restored to its pre-ADR-0018 meaning — the structural umbrella
 * that matches `Cell`, `List`, or `Store` alike by `get()` alone, not by tag. `createSignal`/
 * `deriveSignal` become `createCell`/`deriveCell`; `isSignal`/`isMutableSignal` go back to
 * being umbrella guards rather than narrow ones.
 */

describe('List — readonly base and mutable extension share one tag', () => {
	test('createList satisfies both List and MutableList', () => {
		const list: MutableList<string> = createList(['a'])
		const asBase: List<string> = list
		expect(asBase.get()).toEqual(['a'])
		expect(list.add('b')).toBe('1')
		expect(list.get()).toEqual(['a', 'b'])
	})

	test('isList matches both the mutable and the readonly sequence', () => {
		expect(isList(createList([1]))).toBe(true)
		expect(isList(deriveList(() => [1]))).toBe(true)
		expect(isList(deriveList([], { watched: () => () => {} }))).toBe(true)
	})

	test('isList rejects non-lists', () => {
		expect(isList(createState(1))).toBe(false)
		expect(isList('list')).toBe(false)
		expect(isList(null)).toBe(false)
	})

	test('isMutableList matches only the mutable sequence', () => {
		const list = createList([1, 2])
		expect(isMutableList(list)).toBe(true)
		if (isMutableList(list)) expect(list.add(3)).toBe('2')
	})

	test('isMutableList rejects a readonly sequence', () => {
		expect(isMutableList(deriveList(() => [1]))).toBe(false)
		expect(isMutableList(deriveList([], { watched: () => () => {} }))).toBe(
			false,
		)
	})

	test('a mutable and a readonly list are distinguishable in both directions', () => {
		const list = createList([1])
		const derived = deriveList(() => [1])
		expect(isMutableList(list) && !isMutableList(derived)).toBe(true)
		expect(isList(derived) && isList(list)).toBe(true)
	})
})

describe('Store — readonly base and mutable extension share one tag', () => {
	test('createStore satisfies MutableStore, and is readable through Store', () => {
		const store: MutableStore<{ a: number }> = createStore({ a: 1 })
		expect(store.get()).toEqual({ a: 1 })
		expect(isStore(store)).toBe(true)
	})

	test('isStore matches both the mutable and the readonly record', () => {
		expect(isStore(createStore({ a: 1 }))).toBe(true)
		expect(isStore(deriveStore(() => ({ a: 1 })))).toBe(true)
	})

	test('isMutableStore matches only the mutable record', () => {
		expect(isMutableStore(createStore({ a: 1 }))).toBe(true)
		expect(isMutableStore(deriveStore(() => ({ a: 1 })))).toBe(false)
	})
})

describe('Cell — readonly base and mutable extension share one tag', () => {
	test('createState satisfies both Cell and MutableCell', () => {
		const state: MutableCell<number> = createState(1)
		const asBase: Cell<number> = state
		expect(asBase.get()).toBe(1)
	})

	test('createCell is the narrow single-value factory', () => {
		const cell: MutableCell<number> = createCell(1)
		expect(cell.get()).toBe(1)
		cell.set(2)
		expect(cell.get()).toBe(2)
	})

	test('isCell matches only the single-value shape, not List or Store', () => {
		expect(isCell(createState(1))).toBe(true)
		expect(isCell(createList([1]))).toBe(false)
		expect(isCell(createStore({ a: 1 }))).toBe(false)
	})

	test('isMutableCell matches only the mutable single-value shape', () => {
		expect(isMutableCell(createState(1))).toBe(true)
		expect(isMutableCell(createList([1]))).toBe(false)
		expect(isMutableCell(deriveComputed(() => 1))).toBe(false)
	})
})

describe('Signal — restored umbrella meaning, matching Cell/List/Store alike', () => {
	test('isSignal matches any shape by get() alone, not by tag', () => {
		expect(isSignal(createState(1))).toBe(true)
		expect(isSignal(createList([1]))).toBe(true)
		expect(isSignal(createStore({ a: 1 }))).toBe(true)
	})

	test('isSignal rejects non-signal values', () => {
		expect(isSignal(42)).toBe(false)
		expect(isSignal(null)).toBe(false)
		expect(isSignal({})).toBe(false)
	})

	test('isMutableSignal matches a writable Cell, List, or Store alike', () => {
		expect(isMutableSignal(createState(1))).toBe(true)
		expect(isMutableSignal(createList([1]))).toBe(true)
		expect(isMutableSignal(createStore({ a: 1 }))).toBe(true)
		expect(isMutableSignal(deriveComputed(() => 1))).toBe(false)
	})

	test('a Signal-typed reference accepts any shape structurally', () => {
		const cellRef: Signal<number> = createState(1)
		const listRef: Signal<number[]> = createList([1])
		const storeRef: Signal<{ a: number }> = createStore({ a: 1 })
		expect(cellRef.get()).toBe(1)
		expect(listRef.get()).toEqual([1])
		expect(storeRef.get()).toEqual({ a: 1 })
	})
})

describe('ListSource/ListCallback/ListChanges/PerItemCallback — terminal 2.0 names', () => {
	test('ListSource drives the per-item form of deriveList', () => {
		const source: ListSource<number> = createList<number>([1, 2])
		expect(deriveList(source, n => n * 2).get()).toEqual([2, 4])
	})

	test('ListChanges and ListCallback drive the external-push form of deriveList', () => {
		let push: ((changes: ListChanges<number>) => void) | undefined
		const watched: ListCallback<number> = apply => {
			push = apply
			return () => {}
		}
		const list = deriveList<number>([], { watched })
		const dispose = createScope(() => {
			createEffect(() => {
				list.get()
			})
		})
		push?.({ add: [1, 2, 3] })
		expect(list.get()).toEqual([1, 2, 3])
		dispose()
	})

	test('PerItemCallback drives the per-item form of deriveList', () => {
		const source = createList([1, 2, 3])
		const doubler: PerItemCallback<number, number> = (n: number) => n * 2
		expect(deriveList(source, doubler).get()).toEqual([2, 4, 6])
	})
})
