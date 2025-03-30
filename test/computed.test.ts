import { describe, test, expect } from 'bun:test'
import { state, computed, UNSET, isComputed, isState } from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const increment = (n: number) => Number.isFinite(n) ? n + 1 : UNSET

/* === Tests === */

describe('Computed', function () {

	test('should identify computed signals with isComputed()', () => {
		const count = state(42)
		const doubled = count.map(v => v * 2)
		expect(isComputed(doubled)).toBe(true)
		expect(isState(doubled)).toBe(false)
	})

	test('should compute a function', function() {
		const derived = computed(() => 1 + 2)
		expect(derived.get()).toBe(3)
	})

	test('should compute function dependent on a signal', function() {
		const derived = state(42).map(v => ++v)
		expect(derived.get()).toBe(43)
	})

	test('should compute function dependent on an updated signal', function() {
		const cause = state(42)
		const derived = cause.map(v => ++v)
		cause.set(24)
		expect(derived.get()).toBe(25)
	})

	test('should compute function dependent on an async signal', async function() {
		const status = state('pending')
		const promised = computed(async () => {
			await wait(100)
			status.set('success')
			return 42
		})
		const derived = promised.map(increment)
		expect(derived.get()).toBe(UNSET)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(derived.get()).toBe(43)
		expect(status.get()).toBe('success')
	})

	test('should handle errors from an async signal gracefully', async function() {
		const status = state('pending')
		const error = state('')
		const promised = computed(async () => {
			await wait(100)
			status.set('error')
			error.set('error occurred')
			return 0
		})
		const derived = promised.map(increment)
		expect(derived.get()).toBe(UNSET)
		expect(status.get()).toBe('pending')
		await wait(110)
		expect(error.get()).toBe('error occurred')
		expect(status.get()).toBe('error')
	})

	test('should compute async signals in parallel without waterfalls', async function() {
		const a = computed(async () => {
			await wait(100)
			return 10
		})
		const b = computed(async () => {
			await wait(100)
			return 20
		})
		const c = computed(() => {
			const aValue = a.get()
			const bValue = b.get()
			return (aValue === UNSET || bValue === UNSET)
				? UNSET
				: aValue + bValue
		})
		expect(c.get()).toBe(UNSET)
		await wait(110)
		expect(c.get()).toBe(30)
	})

	test('should compute function dependent on a chain of computed states dependent on a signal', function() {
		const derived = state(42)
			.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v)
		expect(derived.get()).toBe(87)
	})

	test('should compute function dependent on a chain of computed states dependent on an updated signal', function() {
		const cause = state(42)
		const derived = cause
			.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v)
		cause.set(24)
		expect(derived.get()).toBe(51)
	})

	test('should drop X->B->X updates', function () {
		let count = 0
		const x = state(2)
		const a = x.map(v => --v)
		const b = computed(() => x.get() + a.get())
		const c = b.map(v => {
			count++
			return 'c: ' + v
		})
		expect(c.get()).toBe('c: 3')
		expect(count).toBe(1)
		x.set(4)
		expect(c.get()).toBe('c: 7')
		expect(count).toBe(2)
	})

	test('should only update every signal once (diamond graph)', function() {
		let count = 0
		const x = state('a')
		const a = x.map(v => v)
		const b = x.map(v => v)
		const c = computed(() => {
			count++
			return a.get() + ' ' + b.get()
		})
		expect(c.get()).toBe('a a')
		expect(count).toBe(1)
		x.set('aa')
		// flush()
		expect(c.get()).toBe('aa aa')
		expect(count).toBe(2)
	})

	test('should only update every signal once (diamond graph + tail)', function() {
		let count = 0
		const x = state('a')
		const a = x.map(v => v)
		const b = x.map(v => v)
		const c = computed(() => a.get() + ' ' + b.get())
		const d = c.map(v => {
			count++
			return v
		})
		expect(d.get()).toBe('a a')
		expect(count).toBe(1)
		x.set('aa')
		expect(d.get()).toBe('aa aa')
		expect(count).toBe(2)
	})

	test('should update multiple times after multiple state changes', function() {
		const a = state(3)
		const b = state(4)
		let count = 0
		const sum = computed(() => {
			count++
			return a.get() + b.get()
		})
		expect(sum.get()).toBe(7)
		a.set(6)
		expect(sum.get()).toBe(10)
		b.set(8)
		expect(sum.get()).toBe(14)
		expect(count).toBe(3)
	})

	/*
	 * Note for the next two tests:
	 * 
	 * Due to the lazy evaluation strategy, unchanged computed signals may propagate
	 * change notifications one additional time before stabilizing. This is a
	 * one-time performance cost that allows for efficient memoization and
	 * error handling in most cases.
	 */
	test('should bail out if result is the same', function() {
		let count = 0
		const x = state('a')
		const b = x.map(() => 'foo').map(v => {
			count++
			return v
		})
		expect(b.get()).toBe('foo')
		expect(count).toBe(1)
		x.set('aa')
		x.set('aaa')
		x.set('aaaa')
		expect(b.get()).toBe('foo')
		expect(count).toBe(2)
	})

	test('should block if result remains unchanged', function() {
		let count = 0
		const x = state(42)
		const c = x.map(v => v % 2)
			.map(v => v ? 'odd' : 'even')
			.map(v => {
				count++
				return `c: ${v}`
			})
		expect(c.get()).toBe('c: even')
		expect(count).toBe(1)
		x.set(44)
		x.set(46)
		x.set(48)
		expect(c.get()).toBe('c: even')
		expect(count).toBe(2)
	})

	test('should detect and throw error for circular dependencies', function() {
		const a = state(1)
		const b = computed(() => c.get() + 1)
		const c = computed(() => b.get() + a.get())
		expect(() => {
			b.get() // This should trigger the circular dependency
		}).toThrow('Circular dependency in computed detected')
		expect(a.get()).toBe(1)
	})

	test('should propagate error if an error occurred', function() {
		let okCount = 0
		let errCount = 0
		const x = state(0)
		const a = x.map(v => {
			if (v === 1) throw new Error('Calculation error')
			return 1
		})
		const c = a.map({
			ok: v => v ? 'success' : 'failure',
			err: () => {
				errCount++
				return 'recovered'
			},
		}).map(v => {
			okCount++
			return `c: ${v}`
		})
		expect(a.get()).toBe(1)
		expect(c.get()).toBe('c: success')
		expect(okCount).toBe(1)
		try {
			x.set(1)
			expect(a.get()).toBe(1)
			expect(true).toBe(false); // This line should not be reached
		} catch (error) {
			expect(error.message).toBe('Calculation error')
		} finally {
			expect(c.get()).toBe('c: recovered')
			expect(okCount).toBe(2)
			expect(errCount).toBe(1)
		}
	})

	test('should return a computed signal with .map()', function() {
		const cause = state(42)
		const derived = cause.map(v => ++v)
		const double = derived.map(v => v * 2)
		expect(isComputed(double)).toBe(true)
		expect(double.get()).toBe(86)
	})

	test('should create an effect that reacts on async computed changes with .tap()', async function() {
		const cause = state(42)
		const derived = computed(async () => {
			await wait(100)
			return cause.get() + 1
		})
		let okCount = 0
		let nilCount = 0
		let result: number = 0
		derived.tap({
			ok: v => {
				result = v
				okCount++
			},
			nil: () => {
				nilCount++
			}
		})
		cause.set(43)
		expect(okCount).toBe(0)
		expect(nilCount).toBe(1)
		expect(result).toBe(0)

		await wait(110)
		expect(okCount).toBe(1) // not +1 because initial state never made it here
		expect(nilCount).toBe(1)
		expect(result).toBe(44)
	})

	test('should handle complex computed signal with error and async dependencies', async function() {
		const toggleState = state(true)
		const errorProne = toggleState.map(v => {
			if (v) throw new Error('Intentional error')
			return 42
		})
		const asyncValue = computed(async () => {
			await wait(50)
			return 10
		})
		let okCount = 0
		let nilCount = 0
		let errCount = 0
		let result: number = 0
		const complexComputed = computed(() => {
			try {
				const x = errorProne.get()
				const y = asyncValue.get()
				if (y === UNSET) { // not ready yet
					nilCount++
					return 0
				} else { // happy path
					okCount++
					return x + y
				}
			} catch (error) { // error path
				errCount++
				return -1
			}
		})
	
		for (let i = 0; i < 10; i++) {
			toggleState.set(!!(i % 2))
			await wait(10)
			result = complexComputed.get()
			// console.log(`i: ${i}, result: ${result}`)
		}
	
		expect(nilCount).toBeGreaterThanOrEqual(3)
		expect(okCount).toBeGreaterThanOrEqual(2)
		expect(errCount).toBeGreaterThanOrEqual(5)
		expect(okCount + errCount + nilCount).toBe(10)
	})

	test('should handle signal changes during async computation', async function() {
		const source = state(1)
		let computationCount = 0
		const derived = source.map(async value => {
			computationCount++
			await wait(100)
			return value
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)
		expect(computationCount).toBe(1)

		// Change source before first computation completes
		source.set(2)
		await wait(210)
		expect(derived.get()).toBe(2)
		expect(computationCount).toBe(2)
	})

	test('should handle multiple rapid changes during async computation', async function() {
		const source = state(1)
		let computationCount = 0
		const derived = source.map(async value => {
			computationCount++
			await wait(100)
			return value
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)
		expect(computationCount).toBe(1)

		// Make multiple rapid changes
		source.set(2)
		source.set(3)
		source.set(4)
		await wait(210)

		// Should have computed twice (initial + final change)
		expect(derived.get()).toBe(4)
		expect(computationCount).toBe(2)
	})

	test('should handle errors in aborted computations', async function() {
		const source = state(1)
		const derived = source.map(async value => {
			await wait(100)
			if (value === 2) throw new Error('Intentional error')
			return value
		})

		// Start first computation
		expect(derived.get()).toBe(UNSET)

		// Change to error state before first computation completes
		source.set(2)
		await wait(210)

		// Should have aborted first computation and handled error in second
		expect(() => derived.get()).toThrow('Intentional error')
	})
})