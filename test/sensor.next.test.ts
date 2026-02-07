import { expect, mock, test } from 'bun:test'
import { createEffect, createSensor } from '../next.ts'

test('Sensor - returns Sensor type', () => {
	const sensor = createSensor<{ x: number }>(() => () => {})
	expect(sensor[Symbol.toStringTag]).toBe('Sensor')
})

test('Sensor - value is undefined before activation', () => {
	const sensor = createSensor<number>(set => {
		set(42)
		return () => {}
	})

	// Reading outside an effect does not activate the sensor
	expect(sensor.get()).toBeUndefined()
})

test('Sensor - activates on first subscriber and sets value', () => {
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

test('Sensor - reactive updates via set callback', () => {
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

	setFn(20)
	expect(received).toBe(20)
	expect(effectCount).toBe(3)
})

test('Sensor - skips update when value is equal', () => {
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

test('Sensor - custom equals function', () => {
	let setFn!: (v: { x: number }) => void
	const sensor = createSensor<{ x: number }>(
		set => {
			setFn = set
			set({ x: 1 })
			return () => {}
		},
		{
			equals: (a: unknown, b: unknown) =>
				!!(a && b) && (a as { x: number }).x === (b as { x: number }).x,
		},
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

test('Sensor - guard validates values', () => {
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

test('Sensor - cleanup called when last subscriber removed', () => {
	let cleanupCalled = false
	const sensor = createSensor<number>(set => {
		set(1)
		return () => {
			cleanupCalled = true
		}
	})

	const dispose = createEffect(() => {
		sensor.get()
	})
	expect(cleanupCalled).toBe(false)

	dispose()
	expect(cleanupCalled).toBe(true)
})

test('Sensor - start only called on first subscriber', () => {
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
	expect(startCount).toBe(1) // not called again

	dispose1()
	expect(cleanupCount).toBe(0) // still has subscriber

	dispose2()
	expect(cleanupCount).toBe(1) // last subscriber removed
})

test('Sensor - multiple effects react to updates', () => {
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

test('Sensor - lazy activation with async updates', async () => {
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

	// Not activated yet
	expect(counter).toBe(0)
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(0)

	// Activate
	let lastValue = 0
	const dispose = createEffect(() => {
		lastValue = sensor.get()
	})

	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBeGreaterThan(0)
	expect(lastValue).toBeGreaterThan(0)
	expect(intervalId).toBeDefined()

	// Deactivate
	dispose()
	const counterAfterStop = counter

	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(counterAfterStop)
	expect(intervalId).toBeUndefined()
})

test('Sensor - reactivates after all subscribers leave and new one arrives', () => {
	let startCount = 0
	let cleanupCount = 0

	const sensor = createSensor<number>(set => {
		startCount++
		set(startCount)
		return () => {
			cleanupCount++
		}
	})

	// First activation
	const dispose1 = createEffect(() => {
		sensor.get()
	})
	expect(startCount).toBe(1)

	dispose1()
	expect(cleanupCount).toBe(1)

	// Second activation — start called again
	let received = 0
	const dispose2 = createEffect(() => {
		received = sensor.get()
	})
	expect(startCount).toBe(2)
	expect(received).toBe(2) // set(startCount) where startCount is now 2

	dispose2()
	expect(cleanupCount).toBe(2)
})
