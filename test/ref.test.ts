import { describe, expect, mock, test } from 'bun:test'
import {
	createEffect,
	createSensor,
	isSensor,
	SKIP_EQUALITY,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Sensor (mutable object observation pattern)', () => {
	describe('createSensor with SKIP_EQUALITY', () => {
		test('should return the reference value from get()', () => {
			const obj = { name: 'test' }
			const sensor = createSensor<typeof obj>(
				set => {
					set(obj)
					return () => {}
				},
				{ value: obj, equals: SKIP_EQUALITY },
			)

			let received: typeof obj | undefined
			const dispose = createEffect(() => {
				received = sensor.get()
			})
			expect(received).toBe(obj)
			dispose()
		})

		test('should have Symbol.toStringTag of "Sensor"', () => {
			const sensor = createSensor<{ x: number }>(
				set => {
					set({ x: 1 })
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)
			expect(sensor[Symbol.toStringTag]).toBe('Sensor')
		})

		test('should be identified by isSensor', () => {
			const sensor = createSensor<{ x: number }>(
				set => {
					set({ x: 1 })
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)
			expect(isSensor(sensor)).toBe(true)
		})
	})

	describe('SKIP_EQUALITY', () => {
		test('should always return false', () => {
			expect(SKIP_EQUALITY()).toBe(false)
			// biome-ignore lint/suspicious/noExplicitAny: testing with arbitrary values
			expect((SKIP_EQUALITY as any)(1, 1)).toBe(false)
		})
	})

	describe('notify via set() with same reference', () => {
		test('should re-run effects when set is called with same reference', () => {
			const obj = { status: 'offline' }
			let setFn!: (next: typeof obj) => void

			const sensor = createSensor<typeof obj>(
				set => {
					setFn = set
					set(obj)
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)

			let effectCount = 0
			let lastStatus = ''
			createEffect(() => {
				lastStatus = sensor.get().status
				effectCount++
			})

			expect(effectCount).toBe(1)
			expect(lastStatus).toBe('offline')

			obj.status = 'online'
			expect(effectCount).toBe(1) // no set yet

			setFn(obj) // same reference, but SKIP_EQUALITY ensures propagation
			expect(effectCount).toBe(2)
			expect(lastStatus).toBe('online')
		})

		test('should trigger multiple effect runs on multiple set calls', () => {
			const obj = { size: 100 }
			let setFn!: (next: typeof obj) => void

			const sensor = createSensor<typeof obj>(
				set => {
					setFn = set
					set(obj)
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)

			const callback = mock(() => {})
			createEffect(() => {
				sensor.get()
				callback()
			})

			expect(callback).toHaveBeenCalledTimes(1)

			setFn(obj)
			expect(callback).toHaveBeenCalledTimes(2)

			setFn(obj)
			expect(callback).toHaveBeenCalledTimes(3)
		})

		test('should notify multiple effects', () => {
			const obj = { connected: false }
			let setFn!: (next: typeof obj) => void

			const sensor = createSensor<typeof obj>(
				set => {
					setFn = set
					set(obj)
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)

			const mock1 = mock(() => {})
			const mock2 = mock(() => {})

			createEffect(() => {
				sensor.get()
				mock1()
			})
			createEffect(() => {
				sensor.get()
				mock2()
			})

			expect(mock1).toHaveBeenCalledTimes(1)
			expect(mock2).toHaveBeenCalledTimes(1)

			obj.connected = true
			setFn(obj)

			expect(mock1).toHaveBeenCalledTimes(2)
			expect(mock2).toHaveBeenCalledTimes(2)
		})
	})

	describe('Lazy Activation', () => {
		test('should only call start when first effect subscribes', async () => {
			let counter = 0
			let intervalId: Timer | undefined
			const dateObj = new Date()

			const sensor = createSensor<Date>(
				set => {
					set(dateObj)
					intervalId = setInterval(() => {
						counter++
						set(dateObj) // same reference, triggers via SKIP_EQUALITY
					}, 10)
					return () => {
						clearInterval(intervalId)
						intervalId = undefined
					}
				},
				{ value: dateObj, equals: SKIP_EQUALITY },
			)

			// No subscribers yet
			expect(counter).toBe(0)
			await wait(50)
			expect(counter).toBe(0)
			expect(intervalId).toBeUndefined()

			// First subscriber activates
			const dispose = createEffect(() => {
				sensor.get()
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
			const obj = { x: 1 }

			const sensor = createSensor<typeof obj>(
				set => {
					startCount++
					set(obj)
					return () => {
						stopCount++
					}
				},
				{ value: obj, equals: SKIP_EQUALITY },
			)

			const dispose1 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(1)

			const dispose2 = createEffect(() => {
				sensor.get()
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
			const obj = { x: 1 }

			const sensor = createSensor<typeof obj>(
				set => {
					startCount++
					set(obj)
					return () => {
						stopCount++
					}
				},
				{ value: obj, equals: SKIP_EQUALITY },
			)

			const dispose1 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(1)

			dispose1()
			expect(stopCount).toBe(1)

			const dispose2 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(2)

			dispose2()
			expect(stopCount).toBe(2)
		})
	})

	describe('options.value (initial value)', () => {
		test('should not throw UnsetSignalValueError when options.value is provided', () => {
			const obj = { x: 1 }
			const sensor = createSensor<typeof obj>(
				() => {
					// start callback does NOT call set() immediately
					return () => {}
				},
				{ value: obj, equals: SKIP_EQUALITY },
			)

			let received: typeof obj | undefined
			const dispose = createEffect(() => {
				received = sensor.get()
			})
			expect(received).toBe(obj)
			dispose()
		})
	})

	describe('Input Validation', () => {
		test('should throw InvalidCallbackError for non-function start', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createSensor(null)
			}).toThrow('[Sensor] Callback null is invalid')
		})

		test('should throw InvalidCallbackError for async start callback', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createSensor(async () => () => {})
			}).toThrow()
		})

		test('should validate values passed through set() even with SKIP_EQUALITY', () => {
			let setFn!: (next: unknown) => void

			const sensor = createSensor<{ x: number }>(
				set => {
					setFn = set as (next: unknown) => void
					set({ x: 1 })
					return () => {}
				},
				{ equals: SKIP_EQUALITY },
			)

			createEffect(() => {
				sensor.get()
			})

			expect(() => {
				// biome-ignore lint/suspicious/noExplicitAny: testing invalid input
				setFn(null as any)
			}).toThrow('[Sensor] Signal value cannot be null or undefined')
		})
	})
})
