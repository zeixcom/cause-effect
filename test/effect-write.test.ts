import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createList,
	createMemo,
	createScope,
	createSensor,
	createSlot,
	createState,
	createStore,
	createTask,
	deriveList,
	deriveStore,
	EffectWriteError,
	isPending,
	match,
	untrack,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

// ADR-0019: a public mutator called synchronously during an effect body throws
// EffectWriteError. External input entering the graph through watched/emit is
// exempt — an effect's first read may activate a sensor, task, or external-push
// composite and receive values. Detection is best-effort: writes in
// asynchronous continuations and effect cleanups escape the guard.

describe('EffectWriteError', () => {
	describe('Signal mutators', () => {
		test('set() during an effect throws', () => {
			const count = createState(0)
			expect(() => createEffect(() => count.set(1))).toThrow(EffectWriteError)
			expect(count.get()).toBe(0)
		})

		test('update() during an effect throws', () => {
			const count = createState(0)
			expect(() => createEffect(() => count.update(v => v + 1))).toThrow(
				EffectWriteError,
			)
		})

		test('the error names the mutator and points at untrack', () => {
			const count = createState(0)
			let message = ''
			try {
				createEffect(() => count.set(1))
			} catch (err) {
				message = (err as Error).message
			}
			expect(message).toContain('[Signal.set]')
			expect(message).toContain('untrack')
		})
	})

	describe('List mutators', () => {
		const cases: [
			string,
			(list: ReturnType<typeof createList<number>>) => void,
		][] = [
			['set', list => list.set([2])],
			['update', list => list.update(arr => [...arr])],
			['add', list => list.add(2)],
			['remove', list => list.remove('0')],
			['replace', list => list.replace('0', 9)],
			['sort', list => list.sort()],
			['splice', list => list.splice(0, 1)],
		]

		for (const [name, mutate] of cases) {
			test(`List.${name}() during an effect throws`, () => {
				const list = createList<number>([1])
				expect(() => createEffect(() => mutate(list))).toThrow(EffectWriteError)
			})
		}
	})

	describe('Store mutators', () => {
		test('set() during an effect throws', () => {
			const store = createStore({ a: 1 })
			expect(() => createEffect(() => store.set({ a: 2 }))).toThrow(
				EffectWriteError,
			)
		})

		test('update() during an effect throws', () => {
			const store = createStore({ a: 1 })
			expect(() =>
				createEffect(() => store.update(prev => ({ ...prev, a: 2 }))),
			).toThrow(EffectWriteError)
		})

		test('add() during an effect throws', () => {
			const store = createStore<{ a: number; b?: number }>({ a: 1 })
			expect(() =>
				createEffect(() => {
					store.add('b', 2)
				}),
			).toThrow(EffectWriteError)
		})

		test('remove() during an effect throws', () => {
			const store = createStore({ a: 1, b: 2 })
			expect(() => createEffect(() => store.remove('b'))).toThrow(
				EffectWriteError,
			)
		})

		test('a child property set() during an effect throws', () => {
			const store = createStore({ a: 1 })
			expect(() => createEffect(() => store.a.set(2))).toThrow(EffectWriteError)
		})
	})

	describe('Slot', () => {
		test('Slot.set during an effect throws', () => {
			const slot = createSlot(createState('a'))
			expect(() => createEffect(() => slot.set('b'))).toThrow(EffectWriteError)
		})
	})

	describe('Effect contexts that throw', () => {
		test('inside a match() sync handler, routed to the err branch', () => {
			const src = createState(1)
			const count = createState(0)
			let captured: unknown
			createEffect(() => {
				match(src, {
					ok: v => count.set(v),
					err: e => {
						captured = e
					},
				})
			})
			// match routes a handler exception to `err` rather than letting it
			// propagate — the write is still rejected
			expect(captured).toBeInstanceOf(EffectWriteError)
			expect(count.get()).toBe(0)
		})

		test('inside batch() called from an effect', () => {
			const count = createState(0)
			expect(() =>
				createEffect(() => {
					batch(() => count.set(1))
				}),
			).toThrow(EffectWriteError)
		})

		test('inside a nested effect body', () => {
			const count = createState(0)
			expect(() =>
				createEffect(() => {
					createEffect(() => count.set(1))
				}),
			).toThrow(EffectWriteError)
		})

		test('the write is rejected, not committed', () => {
			const count = createState(0)
			expect(() =>
				createEffect(() => {
					count.set(5)
				}),
			).toThrow(EffectWriteError)
			expect(count.get()).toBe(0)
		})
	})

	describe('Emit paths are exempt', () => {
		test('sensor emit during the first read inside an effect', () => {
			const sensor = createSensor<number>({
				watched: emit => {
					emit(1) // synchronous, during the effect's first read
					return () => {}
				},
			})
			let value = 0
			createEffect(() => {
				value = sensor.get()
			})
			expect(value).toBe(1)
		})

		test('task pending flip during the first read inside an effect', async () => {
			const task = createTask<number>(
				async () => {
					await wait(10)
					return 42
				},
				{ initial: 0 },
			)
			let observed = 0
			createEffect(() => {
				task.get()
				if (isPending(task)) observed++
			})
			expect(observed).toBe(1)
			await wait(20)
			expect(task.get()).toBe(42)
		})

		test('external-push deriveList emit during the first read inside an effect', () => {
			const list = deriveList([1], {
				watched: emit => {
					emit({ add: [2] }) // synchronous, during the effect's first read
					return () => {}
				},
			})
			let length = 0
			createEffect(() => {
				length = list.length
			})
			expect(length).toBe(2)
		})

		test('external-push deriveStore emit during the first read inside an effect', () => {
			const store = deriveStore(
				{ a: 0 },
				{
					watched: emit => {
						emit({ a: 1 }) // synchronous, during the effect's first read
						return () => {}
					},
				},
			)
			let a = -1
			createEffect(() => {
				a = store.get().a
			})
			expect(a).toBe(1)
		})
	})

	describe('Escape hatches', () => {
		test('untrack suspends the guard for a deliberate feedback loop', () => {
			const count = createState(0)
			createEffect(() => {
				untrack(() => count.set(1))
			})
			expect(count.get()).toBe(1)
		})

		test('a write in an effect cleanup escapes the guard', () => {
			const count = createState(0)
			let cleanupRan = false
			createEffect(() => {
				const v = count.get()
				return () => {
					cleanupRan = true
					count.set(v + 100)
				}
			})
			count.set(1)
			expect(cleanupRan).toBe(true)
			// The cleanup write landed and the re-run observed it (the first
			// run read 0, so the cleanup wrote 100)
			expect(count.get()).toBe(100)
		})

		test('a write in a microtask continuation escapes the guard', async () => {
			const count = createState(0)
			let caught: unknown
			createEffect(() => {
				Promise.resolve().then(() => {
					try {
						count.set(1)
					} catch (err) {
						caught = err
					}
				})
			})
			await wait(0)
			expect(caught).toBeUndefined()
			expect(count.get()).toBe(1)
		})
	})

	describe('Outside the guard', () => {
		test('a write in a scope setup body is allowed', () => {
			const count = createState(0)
			createScope(() => {
				count.set(1)
			})
			expect(count.get()).toBe(1)
		})

		test('a write in a memo body is allowed (effects only)', () => {
			const a = createState(1)
			const b = createState(0)
			const probe = createMemo(() => {
				b.set(a.get())
				return a.get()
			})
			expect(probe.get()).toBe(1)
			expect(b.get()).toBe(1)
		})
	})
})
