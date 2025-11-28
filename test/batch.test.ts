import { describe, expect, test } from 'bun:test'
import {
	batch,
	createComputed,
	createEffect,
	createState,
	match,
	resolve,
} from '../'

/* === Tests === */

describe('Batch', () => {
	test('should be triggered only once after repeated state change', () => {
		const cause = createState(0)
		let result = 0
		let count = 0
		createEffect((): undefined => {
			result = cause.get()
			count++
		})
		batch(() => {
			for (let i = 1; i <= 10; i++) {
				cause.set(i)
			}
		})
		expect(result).toBe(10)
		expect(count).toBe(2) // + 1 for effect initialization
	})

	test('should be triggered only once when multiple signals are set', () => {
		const a = createState(3)
		const b = createState(4)
		const c = createState(5)
		const sum = createComputed(() => a.get() + b.get() + c.get())
		let result = 0
		let count = 0
		createEffect(() => {
			const resolved = resolve({ sum })
			match(resolved, {
				ok: ({ sum: res }) => {
					result = res
					count++
				},
				err: () => {},
			})
		})
		batch(() => {
			a.set(6)
			b.set(8)
			c.set(10)
		})
		expect(result).toBe(24)
		expect(count).toBe(2) // + 1 for effect initialization
	})

	test('should prove example from README works', () => {
		// State: define an array of Signal<number>
		const signals = [createState(2), createState(3), createState(5)]

		// Computed: derive a calculation ...
		const sum = createComputed(() => {
			const v = signals.reduce((total, v) => total + v.get(), 0)
			if (!Number.isFinite(v)) throw new Error('Invalid value')
			return v
		})

		let result = 0
		let okCount = 0
		let errCount = 0

		// Effect: switch cases for the result
		createEffect(() => {
			const resolved = resolve({ sum })
			match(resolved, {
				ok: ({ sum: v }) => {
					result = v
					okCount++
					// console.log('Sum:', v)
				},
				err: () => {
					errCount++
					// console.error('Error:', error)
				},
			})
		})

		expect(okCount).toBe(1)
		expect(result).toBe(10)

		// Batch: apply changes to all signals in a single transaction
		batch(() => {
			signals.forEach(signal => signal.update(v => v * 2))
		})

		expect(okCount).toBe(2)
		expect(result).toBe(20)

		// Provoke an error
		signals[0].set(NaN)

		expect(errCount).toBe(1)
		expect(okCount).toBe(2) // should not have changed due to error
		expect(result).toBe(20) // should not have changed due to error
	})
})
