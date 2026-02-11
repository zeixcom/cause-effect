import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createScope,
	createState,
	untrack,
} from '../index.ts'

/* === Tests === */

describe('untrack', () => {
	test('should return the value of the callback', () => {
		const result = untrack(() => 42)
		expect(result).toBe(42)
	})

	test('should read a signal without tracking it', () => {
		const tracked = createState('tracked')
		const untracked = createState('untracked')
		let count = 0
		createEffect((): undefined => {
			tracked.get()
			untrack(() => untracked.get())
			count++
		})
		expect(count).toBe(1)

		// changing tracked signal should re-run the effect
		tracked.set('changed')
		expect(count).toBe(2)

		// changing untracked signal should not re-run the effect
		untracked.set('changed')
		expect(count).toBe(2)
	})

	test('should not track dependencies in memos', () => {
		const a = createState(1)
		const b = createState(2)
		const sum = createMemo(() => a.get() + untrack(() => b.get()))
		expect(sum.get()).toBe(3)

		// changing a should recompute
		a.set(10)
		expect(sum.get()).toBe(12)

		// changing b should not recompute (stale value of b used)
		b.set(20)
		expect(sum.get()).toBe(12)
	})

	test('should prevent dependency pollution from subcomponent creation', () => {
		const parentSignal = createState('parent')
		let parentRuns = 0
		let childRuns = 0

		const dispose = createScope(() => {
			createEffect((): undefined => {
				parentSignal.get()
				parentRuns++

				// Simulate subcomponent: create local state + effect
				// Without untrack, childSignal.get() in the child effect
				// would link to the parent effect during initial run
				untrack(() => {
					const childSignal = createState('child')
					createEffect((): undefined => {
						childSignal.get()
						childRuns++
					})
					childSignal.set('updated')
				})
			})
		})

		expect(parentRuns).toBe(1)
		expect(childRuns).toBe(2) // initial + update

		// parent should re-run when its own signal changes
		parentSignal.set('changed')
		expect(parentRuns).toBe(2)

		dispose()
	})

	test('should prevent parent effect from re-running on child signal changes', () => {
		const show = createState(true)
		let parentRuns = 0
		let childValue = ''

		const dispose = createScope(() => {
			createEffect((): undefined => {
				parentRuns++
				if (show.get()) {
					// Subcomponent with its own reactive state
					untrack(() => {
						const label = createState('hello')
						createEffect((): undefined => {
							childValue = label.get()
						})
						label.set('world')
					})
				}
			})
		})

		expect(parentRuns).toBe(1)
		expect(childValue).toBe('world')

		// toggling show re-runs parent (it's tracked)
		show.set(false)
		expect(parentRuns).toBe(2)

		dispose()
	})

	test('should nest correctly', () => {
		const a = createState(1)
		const b = createState(2)
		const c = createState(3)
		let count = 0
		createEffect((): undefined => {
			a.get()
			untrack(() => {
				b.get()
				untrack(() => {
					c.get()
				})
			})
			count++
		})
		expect(count).toBe(1)

		a.set(10)
		expect(count).toBe(2)

		b.set(20)
		expect(count).toBe(2)

		c.set(30)
		expect(count).toBe(2)
	})

	test('should restore tracking after untrack completes', () => {
		const before = createState('before')
		const during = createState('during')
		const after = createState('after')
		let count = 0
		createEffect((): undefined => {
			before.get()
			untrack(() => during.get())
			after.get()
			count++
		})
		expect(count).toBe(1)

		before.set('x')
		expect(count).toBe(2)

		during.set('x')
		expect(count).toBe(2)

		after.set('x')
		expect(count).toBe(3)
	})
})
