import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createList,
	createMemo,
	createState,
	createStore,
} from '../index.ts'

/* === Tests === */

describe('batch', () => {
	test('should trigger effect only once after repeated state changes', () => {
		const source = createState(0)
		let result = 0
		let count = 0
		createEffect((): undefined => {
			result = source.get()
			count++
		})
		expect(count).toBe(1)
		batch(() => {
			for (let i = 1; i <= 10; i++) source.set(i)
		})
		expect(result).toBe(10)
		expect(count).toBe(2)
	})

	test('should trigger effect only once when multiple states change', () => {
		const a = createState(3)
		const b = createState(4)
		const c = createState(5)
		const sum = createMemo(() => a.get() + b.get() + c.get())
		let result = 0
		let count = 0
		createEffect((): undefined => {
			result = sum.get()
			count++
		})
		expect(result).toBe(12)
		expect(count).toBe(1)
		batch(() => {
			a.set(6)
			b.set(8)
			c.set(10)
		})
		expect(result).toBe(24)
		expect(count).toBe(2)
	})

	test('should batch store property updates', () => {
		const user = createStore({ name: 'Alice', age: 30 })
		let result = ''
		let count = 0
		createEffect((): undefined => {
			result = `${user.name.get()} (${user.age.get()})`
			count++
		})
		expect(result).toBe('Alice (30)')
		expect(count).toBe(1)
		batch(() => {
			user.name.set('Bob')
			user.age.set(25)
		})
		expect(result).toBe('Bob (25)')
		expect(count).toBe(2)
	})

	test('should batch list mutations', () => {
		const list = createList([1, 2, 3])
		let result = 0
		let count = 0
		createEffect((): undefined => {
			result = list.get().reduce((sum, v) => sum + v, 0)
			count++
		})
		expect(result).toBe(6)
		expect(count).toBe(1)
		batch(() => {
			list.add(4)
			list.add(5)
		})
		expect(result).toBe(15)
		expect(count).toBe(2)
	})

	test('should batch mixed signal type updates', () => {
		const count = createState(1)
		const items = createList([10, 20])
		const config = createStore({ multiplier: 2 })
		let result = 0
		let runs = 0
		createEffect((): undefined => {
			const sum = items.get().reduce((s, v) => s + v, 0)
			result = (count.get() + sum) * config.multiplier.get()
			runs++
		})
		expect(result).toBe(62) // (1 + 30) * 2
		expect(runs).toBe(1)
		batch(() => {
			count.set(5)
			items.add(30)
			config.multiplier.set(3)
		})
		expect(result).toBe(195) // (5 + 60) * 3
		expect(runs).toBe(2)
	})

	test('should support nested batches', () => {
		const a = createState(1)
		const b = createState(2)
		let result = 0
		let count = 0
		createEffect((): undefined => {
			result = a.get() + b.get()
			count++
		})
		expect(count).toBe(1)
		batch(() => {
			a.set(10)
			batch(() => {
				b.set(20)
			})
			// inner batch should not flush yet
			expect(count).toBe(1)
		})
		expect(result).toBe(30)
		expect(count).toBe(2)
	})
})
