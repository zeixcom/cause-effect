import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createMemo,
	createSlot,
	createState,
} from '../index.ts'
import { InvalidSignalValueError, NullishSignalValueError } from '../src/errors'

describe('Slot', () => {
	test('should replace delegated signal and re-subscribe sinks', () => {
		const local = createState(1)
		const parent = createState(10)
		const derived = createMemo(() => parent.get())
		const slot = createSlot(local)

		const target = {}
		Object.defineProperty(target, 'value', slot)

		let runs = 0
		let seen = 0
		createEffect(() => {
			seen = (target as { value: number }).value
			runs++
		})

		expect(runs).toBe(1)
		expect(seen).toBe(1)

		slot.replace(derived)
		expect(runs).toBe(2)
		expect(seen).toBe(10)

		// Old delegated signal should no longer trigger downstream sinks
		local.set(2)
		expect(runs).toBe(2)

		parent.set(11)
		expect(runs).toBe(3)
		expect(seen).toBe(11)
	})

	test('should forward property set to writable delegated signal', () => {
		const source = createState(2)
		const slot = createSlot(source)
		const target = {}
		Object.defineProperty(target, 'value', slot)
		;(target as { value: number }).value = 3

		expect(source.get()).toBe(3)
		expect((target as { value: number }).value).toBe(3)
	})

	test('should throw on set when delegated signal is read-only', () => {
		const source = createState(2)
		const readonly = createMemo(() => source.get() * 2)
		const slot = createSlot(source)
		const target = {}
		Object.defineProperty(target, 'value', slot)
		slot.replace(readonly)

		expect(() => {
			;(target as { value: number }).value = 7
		}).toThrow('[Slot] Signal is read-only')
	})

	test('should keep replace handle outside property descriptor', () => {
		const source = createState(1)
		const slot = createSlot(source)
		const target = {}
		Object.defineProperty(target, 'value', slot)

		const descriptor = Object.getOwnPropertyDescriptor(target, 'value')
		expect(descriptor).toBeDefined()
		expect(typeof descriptor?.get).toBe('function')
		expect(typeof descriptor?.set).toBe('function')
		expect((descriptor as unknown as { replace?: unknown }).replace).toBe(
			undefined,
		)
		expect(typeof slot.replace).toBe('function')
	})

	test('should batch multiple replacements into one downstream rerun', () => {
		const a = createState(1)
		const b = createState(2)
		const c = createState(3)
		const slot = createSlot(a)
		const target = {}
		Object.defineProperty(target, 'value', slot)

		let runs = 0
		createEffect(() => {
			void (target as { value: number }).value
			runs++
		})
		expect(runs).toBe(1)

		batch(() => {
			slot.replace(b)
			slot.replace(c)
		})
		expect(runs).toBe(2)
	})

	test('should validate initial signal and replacement signal', () => {
		expect(() => {
			// @ts-expect-error: deliberate error test
			createSlot(null)
		}).toThrow(NullishSignalValueError)

		const slot = createSlot(createState(1))
		expect(() => {
			// @ts-expect-error: deliberate error test
			slot.replace(42)
		}).toThrow(InvalidSignalValueError)
	})
})
