import { describe, expect, mock, test } from 'bun:test'
import { createEffect, createRef, isMemo, isRef } from '../next.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Ref', () => {
	describe('createRef', () => {
		test('should return the reference value from get()', () => {
			const obj = { name: 'test' }
			const ref = createRef(obj, () => () => {})

			let received: typeof obj | undefined
			const dispose = createEffect(() => {
				received = ref.get()
			})
			expect(received).toBe(obj)
			dispose()
		})

		test('should have Symbol.toStringTag of "Ref"', () => {
			const ref = createRef({ x: 1 }, () => () => {})
			expect(ref[Symbol.toStringTag]).toBe('Ref')
		})
	})

	describe('isRef', () => {
		test('should identify ref signals', () => {
			expect(isRef(createRef({ x: 1 }, () => () => {}))).toBe(true)
		})

		test('should return false for non-ref values', () => {
			expect(isRef(42)).toBe(false)
			expect(isRef(null)).toBe(false)
			expect(isRef({})).toBe(false)
			expect(isMemo(createRef({ x: 1 }, () => () => {}))).toBe(false)
		})
	})

	describe('notify', () => {
		test('should re-run effects when notify is called', () => {
			const obj = { status: 'offline' }
			let notifyFn!: () => void

			const ref = createRef(obj, notify => {
				notifyFn = notify
				return () => {}
			})

			let effectCount = 0
			let lastStatus = ''
			createEffect(() => {
				lastStatus = ref.get().status
				effectCount++
			})

			expect(effectCount).toBe(1)
			expect(lastStatus).toBe('offline')

			obj.status = 'online'
			expect(effectCount).toBe(1) // no notify yet

			notifyFn()
			expect(effectCount).toBe(2)
			expect(lastStatus).toBe('online')
		})

		test('should trigger multiple effect runs on multiple notifies', () => {
			const obj = { size: 100 }
			let notifyFn!: () => void

			const ref = createRef(obj, notify => {
				notifyFn = notify
				return () => {}
			})

			const callback = mock(() => {})
			createEffect(() => {
				ref.get()
				callback()
			})

			expect(callback).toHaveBeenCalledTimes(1)

			notifyFn()
			expect(callback).toHaveBeenCalledTimes(2)

			notifyFn()
			expect(callback).toHaveBeenCalledTimes(3)
		})

		test('should notify multiple effects', () => {
			const obj = { connected: false }
			let notifyFn!: () => void

			const ref = createRef(obj, notify => {
				notifyFn = notify
				return () => {}
			})

			const mock1 = mock(() => {})
			const mock2 = mock(() => {})

			createEffect(() => {
				ref.get()
				mock1()
			})
			createEffect(() => {
				ref.get()
				mock2()
			})

			expect(mock1).toHaveBeenCalledTimes(1)
			expect(mock2).toHaveBeenCalledTimes(1)

			obj.connected = true
			notifyFn()

			expect(mock1).toHaveBeenCalledTimes(2)
			expect(mock2).toHaveBeenCalledTimes(2)
		})
	})

	describe('Lazy Activation', () => {
		test('should only call start when first effect subscribes', async () => {
			let counter = 0
			let intervalId: Timer | undefined

			const ref = createRef(new Date(), notify => {
				intervalId = setInterval(() => {
					counter++
					notify()
				}, 10)
				return () => {
					clearInterval(intervalId)
					intervalId = undefined
				}
			})

			// No subscribers yet
			expect(counter).toBe(0)
			await wait(50)
			expect(counter).toBe(0)
			expect(intervalId).toBeUndefined()

			// First subscriber activates
			const dispose = createEffect(() => {
				ref.get()
			})

			await wait(50)
			expect(counter).toBeGreaterThan(0)
			expect(intervalId).toBeDefined()

			// Last subscriber removed — cleanup runs
			dispose()
			const counterAfterStop = counter

			await wait(50)
			expect(counter).toBe(counterAfterStop)
			expect(intervalId).toBeUndefined()
		})

		test('should call start only once for multiple subscribers', () => {
			let startCount = 0
			let stopCount = 0

			const ref = createRef({ x: 1 }, () => {
				startCount++
				return () => {
					stopCount++
				}
			})

			const dispose1 = createEffect(() => {
				ref.get()
			})
			expect(startCount).toBe(1)

			const dispose2 = createEffect(() => {
				ref.get()
			})
			expect(startCount).toBe(1)

			dispose1()
			expect(stopCount).toBe(0) // still has subscriber

			dispose2()
			expect(stopCount).toBe(1)
		})

		test('should reactivate after all subscribers leave and new one arrives', () => {
			let startCount = 0
			let stopCount = 0

			const ref = createRef({ x: 1 }, () => {
				startCount++
				return () => {
					stopCount++
				}
			})

			const dispose1 = createEffect(() => {
				ref.get()
			})
			expect(startCount).toBe(1)

			dispose1()
			expect(stopCount).toBe(1)

			const dispose2 = createEffect(() => {
				ref.get()
			})
			expect(startCount).toBe(2)

			dispose2()
			expect(stopCount).toBe(2)
		})
	})

	describe('Input Validation', () => {
		test('should throw NullishSignalValueError for null or undefined value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createRef(null, () => () => {})
			}).toThrow('[Ref] Signal value cannot be null or undefined')

			expect(() => {
				// @ts-expect-error - Testing invalid input
				createRef(undefined, () => () => {})
			}).toThrow('[Ref] Signal value cannot be null or undefined')
		})

		test('should throw InvalidCallbackError for non-function start', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createRef({ x: 1 }, null)
			}).toThrow('[Ref] Callback null is invalid')
		})

		test('should throw InvalidCallbackError for async start callback', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createRef({ x: 1 }, async () => () => {})
			}).toThrow()
		})
	})
})
