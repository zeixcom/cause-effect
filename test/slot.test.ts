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

	test('should forward set through a Slot-to-Slot chain', () => {
		const source = createState(1)
		const inner = createSlot(source)
		const outer = createSlot(inner)

		outer.set(42)
		expect(source.get()).toBe(42)
		expect(outer.get()).toBe(42)
	})

	test('should throw ReadonlySignalError when chain terminates in a read-only signal', () => {
		const source = createState(2)
		const readonly = createMemo(() => source.get() * 2)
		const inner = createSlot(readonly)
		const outer = createSlot(inner)

		expect(() => outer.set(99)).toThrow('[Slot] Signal is read-only')
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

	describe('Consumer disconnect and reconnect', () => {
		test('should return fresh value when new consumer reads after all consumers disconnected', () => {
			const state = createState(1)
			const slot = createSlot(state)

			let seen = 0
			const dispose = createEffect(() => {
				seen = slot.get()
			})
			expect(seen).toBe(1)

			state.set(2)
			expect(seen).toBe(2)

			// All consumers disconnect — State→SlotMemo edge is pruned via cascade
			dispose()

			// State update while unwatched
			state.set(3)

			// New consumer reconnects — should see fresh value 3, not stale 2
			let seen2 = 0
			const dispose2 = createEffect(() => {
				seen2 = slot.get()
			})
			expect(seen2).toBe(3)

			dispose2()
		})

		test('should propagate state updates after consumers disconnect and reconnect', () => {
			const state = createState(1)
			const slot = createSlot(state)

			let runs = 0
			let seen = 0
			const dispose = createEffect(() => {
				seen = slot.get()
				runs++
			})
			expect(runs).toBe(1)
			expect(seen).toBe(1)

			state.set(2)
			expect(runs).toBe(2)
			expect(seen).toBe(2)

			// All consumers disconnect
			dispose()
			state.set(3)

			// New consumer reconnects
			const dispose2 = createEffect(() => {
				seen = slot.get()
				runs++
			})
			// Expect fresh value on connect
			expect(runs).toBe(3)
			expect(seen).toBe(3)

			// Propagation must still work after reconnect
			state.set(4)
			expect(runs).toBe(4)
			expect(seen).toBe(4)

			dispose2()
		})

		test('should propagate through Slot wrapping a Memo after consumer disconnect and reconnect', () => {
			const state = createState(1)
			const derived = createMemo(() => state.get() * 10)
			const slot = createSlot(derived)

			let runs = 0
			let seen = 0
			const dispose = createEffect(() => {
				seen = slot.get()
				runs++
			})
			expect(runs).toBe(1)
			expect(seen).toBe(10)

			state.set(2)
			expect(runs).toBe(2)
			expect(seen).toBe(20)

			// Disconnect and mutate while unwatched
			dispose()
			state.set(3)

			// Reconnect
			const dispose2 = createEffect(() => {
				seen = slot.get()
				runs++
			})
			expect(runs).toBe(3)
			expect(seen).toBe(30)

			// Propagation must continue
			state.set(4)
			expect(runs).toBe(4)
			expect(seen).toBe(40)

			dispose2()
		})
	})

	describe('SlotDescriptor', () => {
		test('should support creating from a `{ get, set }` descriptor', () => {
			const state = createState(1)
			const slot = createSlot({
				get: () => state.get() * 2,
				set: (val: number) => state.set(val / 2),
			})
			
			expect(slot.get()).toBe(2)
			
			let runs = 0
			createEffect(() => {
				slot.get()
				runs++
			})
			expect(runs).toBe(1)
			
			state.set(5)
			expect(runs).toBe(2)
			expect(slot.get()).toBe(10)
			
			slot.set(100)
			expect(state.get()).toBe(50)
			expect(runs).toBe(3)
			expect(slot.get()).toBe(100)
		})

		test('should support read-only `{ get }` descriptor', () => {
			const state = createState(1)
			const slot = createSlot({ get: () => state.get() * 2 })
			expect(slot.get()).toBe(2)
			expect(() => slot.set(100)).toThrow('[Slot] Signal is read-only')
		})
	})
})
