import { describe, expect, test } from 'bun:test'
import { createEffect, createScope, createState } from '../next.ts'

/* === Tests === */

describe('createScope', () => {
	test('should return a dispose function', () => {
		const dispose = createScope(() => {})
		expect(typeof dispose).toBe('function')
	})

	test('should run the callback immediately', () => {
		let ran = false
		createScope(() => {
			ran = true
		})
		expect(ran).toBe(true)
	})

	test('should call returned cleanup on dispose', () => {
		let cleaned = false
		const dispose = createScope(() => {
			return () => {
				cleaned = true
			}
		})
		expect(cleaned).toBe(false)
		dispose()
		expect(cleaned).toBe(true)
	})

	test('should dispose child effects', () => {
		const source = createState(0)
		let count = 0
		const dispose = createScope(() => {
			createEffect((): undefined => {
				source.get()
				count++
			})
		})
		expect(count).toBe(1)
		source.set(1)
		expect(count).toBe(2)
		dispose()
		source.set(2)
		expect(count).toBe(2) // effect should no longer run
	})

	test('should dispose multiple child effects', () => {
		const a = createState(0)
		const b = createState(0)
		let countA = 0
		let countB = 0
		const dispose = createScope(() => {
			createEffect((): undefined => {
				a.get()
				countA++
			})
			createEffect((): undefined => {
				b.get()
				countB++
			})
		})
		expect(countA).toBe(1)
		expect(countB).toBe(1)
		dispose()
		a.set(1)
		b.set(1)
		expect(countA).toBe(1)
		expect(countB).toBe(1)
	})

	test('should call returned cleanup and dispose child effects', () => {
		const source = createState(0)
		let effectCount = 0
		let cleaned = false
		const dispose = createScope(() => {
			createEffect((): undefined => {
				source.get()
				effectCount++
			})
			return () => {
				cleaned = true
			}
		})
		expect(effectCount).toBe(1)
		expect(cleaned).toBe(false)
		dispose()
		expect(cleaned).toBe(true)
		source.set(1)
		expect(effectCount).toBe(1)
	})

	test('should handle nested scopes independently', () => {
		const source = createState(0)
		let outerCount = 0
		let innerCount = 0
		let innerDispose!: () => void
		const outerDispose = createScope(() => {
			createEffect((): undefined => {
				source.get()
				outerCount++
			})
			innerDispose = createScope(() => {
				createEffect((): undefined => {
					source.get()
					innerCount++
				})
			})
		})
		expect(outerCount).toBe(1)
		expect(innerCount).toBe(1)
		source.set(1)
		expect(outerCount).toBe(2)
		expect(innerCount).toBe(2)

		// disposing inner scope should not affect outer
		innerDispose()
		source.set(2)
		expect(outerCount).toBe(3)
		expect(innerCount).toBe(2)

		// disposing outer scope should have no further effect
		outerDispose()
		source.set(3)
		expect(outerCount).toBe(3)
		expect(innerCount).toBe(2)
	})

	test('should dispose nested scopes when parent is disposed', () => {
		const source = createState(0)
		let innerCount = 0
		const outerDispose = createScope(() => {
			createScope(() => {
				createEffect((): undefined => {
					source.get()
					innerCount++
				})
			})
		})
		expect(innerCount).toBe(1)
		source.set(1)
		expect(innerCount).toBe(2)

		// disposing outer should also dispose inner
		outerDispose()
		source.set(2)
		expect(innerCount).toBe(2)
	})

	test('should call nested cleanup functions on parent dispose', () => {
		let outerCleaned = false
		let innerCleaned = false
		const dispose = createScope(() => {
			createScope(() => {
				return () => {
					innerCleaned = true
				}
			})
			return () => {
				outerCleaned = true
			}
		})
		expect(outerCleaned).toBe(false)
		expect(innerCleaned).toBe(false)
		dispose()
		expect(outerCleaned).toBe(true)
		expect(innerCleaned).toBe(true)
	})

	test('should be safe to call dispose multiple times', () => {
		let cleanCount = 0
		const dispose = createScope(() => {
			return () => {
				cleanCount++
			}
		})
		dispose()
		expect(cleanCount).toBe(1)
		dispose()
		// cleanup should only run once since it's nulled after first run
		expect(cleanCount).toBe(1)
	})

	test('should handle scope with no cleanup return', () => {
		const dispose = createScope(() => {
			// no return
		})
		expect(() => dispose()).not.toThrow()
	})
})
