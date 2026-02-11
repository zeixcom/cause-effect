import { describe, expect, mock, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createSensor,
	isMemo,
	isSensor,
	SKIP_EQUALITY,
	UnsetSignalValueError,
} from '../index.ts'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Sensor', () => {
	describe('createSensor', () => {
		test('should have Symbol.toStringTag of "Sensor"', () => {
			const sensor = createSensor<number>(() => () => {})
			expect(sensor[Symbol.toStringTag]).toBe('Sensor')
		})

		test('should throw UnsetSignalValueError when read outside an effect', () => {
			const sensor = createSensor<number>(set => {
				set(42)
				return () => {}
			})
			expect(() => sensor.get()).toThrow(UnsetSignalValueError)
		})

		test('should activate and return value when read inside an effect', () => {
			let started = false
			const sensor = createSensor<number>(set => {
				started = true
				set(42)
				return () => {}
			})

			expect(started).toBe(false)

			let received: number | undefined
			createEffect(() => {
				received = sensor.get()
			})

			expect(started).toBe(true)
			expect(received).toBe(42)
		})
	})

	describe('isSensor', () => {
		test('should identify sensor signals', () => {
			expect(isSensor(createSensor<number>(() => () => {}))).toBe(true)
		})

		test('should return false for non-sensor values', () => {
			expect(isSensor(42)).toBe(false)
			expect(isSensor(null)).toBe(false)
			expect(isSensor({})).toBe(false)
			expect(isMemo(createSensor<number>(() => () => {}))).toBe(false)
		})
	})

	describe('start/link ordering', () => {
		test('synchronous set() inside start should be visible to activating effect', () => {
			// Start fires before link: synchronous set() updates node.value
			// without propagation (no sinks yet). The activating effect reads
			// the updated value directly after link completes.
			const sensor = createSensor<number>(
				set => {
					set(10)
					return () => {}
				},
				{ value: 0 },
			)

			const doubled = createMemo(() => sensor.get() * 2)

			let result = 0
			createEffect(() => {
				result = doubled.get()
			})

			// The memo should see 10 (from start's set), not 0 (initial value)
			expect(result).toBe(20)
		})
	})

	describe('set callback', () => {
		test('should update value and trigger effects', () => {
			let setFn!: (v: number) => void
			const sensor = createSensor<number>(set => {
				setFn = set
				set(0)
				return () => {}
			})

			let effectCount = 0
			let received = 0
			createEffect(() => {
				received = sensor.get()
				effectCount++
			})

			expect(received).toBe(0)
			expect(effectCount).toBe(1)

			setFn(10)
			expect(received).toBe(10)
			expect(effectCount).toBe(2)
		})

		test('should notify multiple effects', () => {
			let setFn!: (v: string) => void
			const sensor = createSensor<string>(set => {
				setFn = set
				set('initial')
				return () => {}
			})

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

			setFn('updated')
			expect(mock1).toHaveBeenCalledTimes(2)
			expect(mock2).toHaveBeenCalledTimes(2)
		})
	})

	describe('Lazy Activation', () => {
		test('should only call start when first effect subscribes', async () => {
			let counter = 0
			let intervalId: Timer | undefined

			const sensor = createSensor<number>(set => {
				set(0)
				intervalId = setInterval(() => {
					counter++
					set(counter)
				}, 10)
				return () => {
					clearInterval(intervalId)
					intervalId = undefined
				}
			})

			expect(counter).toBe(0)
			await wait(50)
			expect(counter).toBe(0)
			expect(intervalId).toBeUndefined()

			const dispose = createEffect(() => {
				sensor.get()
			})

			await wait(50)
			expect(counter).toBeGreaterThan(0)
			expect(intervalId).toBeDefined()

			dispose()
			const counterAfterStop = counter

			await wait(50)
			expect(counter).toBe(counterAfterStop)
			expect(intervalId).toBeUndefined()
		})

		test('should call start only once for multiple subscribers', () => {
			let startCount = 0
			let cleanupCount = 0

			const sensor = createSensor<number>(set => {
				startCount++
				set(1)
				return () => {
					cleanupCount++
				}
			})

			const dispose1 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(1)

			const dispose2 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(1)

			dispose1()
			expect(cleanupCount).toBe(0) // still has subscriber

			dispose2()
			expect(cleanupCount).toBe(1)
		})

		test('should reactivate after all subscribers leave and new one arrives', () => {
			let startCount = 0
			let cleanupCount = 0

			const sensor = createSensor<number>(set => {
				startCount++
				set(startCount)
				return () => {
					cleanupCount++
				}
			})

			const dispose1 = createEffect(() => {
				sensor.get()
			})
			expect(startCount).toBe(1)

			dispose1()
			expect(cleanupCount).toBe(1)

			let received = 0
			const dispose2 = createEffect(() => {
				received = sensor.get()
			})
			expect(startCount).toBe(2)
			expect(received).toBe(2)

			dispose2()
			expect(cleanupCount).toBe(2)
		})
	})

	describe('options.equals', () => {
		test('should skip update when value is equal by default', () => {
			let setFn!: (v: number) => void
			const sensor = createSensor<number>(set => {
				setFn = set
				set(5)
				return () => {}
			})

			let effectCount = 0
			createEffect(() => {
				sensor.get()
				effectCount++
			})
			expect(effectCount).toBe(1)

			setFn(5) // same value
			expect(effectCount).toBe(1)

			setFn(6)
			expect(effectCount).toBe(2)
		})

		test('should use custom equality function', () => {
			let setFn!: (v: { x: number }) => void
			const sensor = createSensor<{ x: number }>(
				set => {
					setFn = set
					set({ x: 1 })
					return () => {}
				},
				{ equals: (a, b) => a?.x === b?.x },
			)

			let effectCount = 0
			createEffect(() => {
				sensor.get()
				effectCount++
			})
			expect(effectCount).toBe(1)

			setFn({ x: 1 }) // structurally equal
			expect(effectCount).toBe(1)

			setFn({ x: 2 })
			expect(effectCount).toBe(2)
		})
	})

	describe('options.guard', () => {
		test('should validate values from set callback', () => {
			let setFn!: (v: number) => void
			const sensor = createSensor<number>(
				set => {
					setFn = set
					set(1)
					return () => {}
				},
				{ guard: (v): v is number => typeof v === 'number' && v > 0 },
			)

			createEffect(() => {
				sensor.get()
			})

			expect(() => setFn(5)).not.toThrow()
			expect(() => setFn(-1)).toThrow()
			expect(() => setFn(0)).toThrow()
		})
	})

	describe('options.value', () => {
		test('should use initial value before activation', () => {
			const sensor = createSensor<number>(() => () => {}, { value: 99 })

			let received: number | undefined
			createEffect(() => {
				received = sensor.get()
			})
			expect(received).toBe(99)
		})
	})

	describe('SKIP_EQUALITY', () => {
		test('should always return false', () => {
			expect(SKIP_EQUALITY()).toBe(false)
			expect(SKIP_EQUALITY(1, 1)).toBe(false)
		})

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

		test('should validate values passed through set()', () => {
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

		test('should throw NullishSignalValueError for null initial value', () => {
			expect(() => {
				// @ts-expect-error - Testing invalid input
				createSensor<number>(() => () => {}, { value: null })
			}).toThrow('[Sensor] Signal value cannot be null or undefined')
		})
	})
})
