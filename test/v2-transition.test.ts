import { describe, expect, test } from 'bun:test'
import {
	createCollection,
	createList,
	createState,
	createStore,
	deriveList,
	deriveStore,
	isList,
	isMutableList,
	isMutableSignal,
	isMutableStore,
	isSignal,
	isStore,
	type List,
	type MutableList,
	type MutableSignal,
	type MutableStore,
	type Signal,
} from '../index.ts'

/* === Tests ===
 *
 * ADR-0018 collapses the 1.x nine-type taxonomy into six types indexed by shape ×
 * mutability. `Symbol.toStringTag` carries only the shape ('Signal' | 'List' | 'Store'),
 * so a guard for the readonly base (`isList`, `isStore`) matches both the mutable and the
 * readonly member of a shape, and a `isMutable*` guard additionally requires write access.
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
		expect(isList(createCollection({ watched: () => () => {} }))).toBe(true)
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
		expect(isMutableList(createCollection({ watched: () => () => {} }))).toBe(
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

describe('Signal — readonly base and mutable extension share one tag', () => {
	test('createState satisfies both Signal and MutableSignal', () => {
		const state: MutableSignal<number> = createState(1)
		const asBase: Signal<number> = state
		expect(asBase.get()).toBe(1)
	})

	test('isSignal matches only the single-value shape', () => {
		expect(isSignal(createState(1))).toBe(true)
		expect(isSignal(createList([1]))).toBe(false)
		expect(isSignal(createStore({ a: 1 }))).toBe(false)
	})

	test('isMutableSignal matches only the mutable single-value shape', () => {
		expect(isMutableSignal(createState(1))).toBe(true)
		expect(isMutableSignal(createList([1]))).toBe(false)
	})
})
