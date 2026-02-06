import { expect, mock, test } from 'bun:test'
import { createEffect, createRef } from '../next.ts'

test('Ref - basic functionality', () => {
	const obj = { name: 'test', value: 42 }
	const ref = createRef(obj, () => {
		return () => {}
	})

	// Ref returns Memo type
	expect(ref[Symbol.toStringTag]).toBe('Memo')

	// Value accessible inside an effect (which triggers start)
	let received: typeof obj | undefined
	const dispose = createEffect(() => {
		received = ref.get()
	})
	expect(received).toBe(obj)
	dispose()
})

test('Ref - reactive subscriptions via notify', () => {
	const server = { status: 'offline', connections: 0 }
	let notifyFn!: () => void

	const ref = createRef(server, notify => {
		notifyFn = notify
		return () => {}
	})

	let effectRunCount = 0
	let lastStatus = ''

	createEffect(() => {
		const current = ref.get()
		lastStatus = current.status
		effectRunCount++
	})

	expect(effectRunCount).toBe(1)
	expect(lastStatus).toBe('offline')

	// External change without notify — effect should not re-run
	server.status = 'online'
	server.connections = 5
	expect(effectRunCount).toBe(1)

	// Notify triggers effect re-run
	notifyFn()
	expect(effectRunCount).toBe(2)
	expect(lastStatus).toBe('online')
})

test('Ref - multiple notifies trigger multiple effect runs', () => {
	const fileObj = { path: '/test.txt', size: 100, modified: Date.now() }
	let notifyFn!: () => void

	const ref = createRef(fileObj, notify => {
		notifyFn = notify
		return () => {}
	})

	const mockCallback = mock(() => {})

	createEffect(() => {
		ref.get()
		mockCallback()
	})

	expect(mockCallback).toHaveBeenCalledTimes(1)

	fileObj.size = 200
	notifyFn()
	expect(mockCallback).toHaveBeenCalledTimes(2)

	notifyFn()
	expect(mockCallback).toHaveBeenCalledTimes(3)
})

test('Ref - multiple effects with same ref', () => {
	const database = { connected: false, queries: 0 }
	let notifyFn!: () => void

	const ref = createRef(database, notify => {
		notifyFn = notify
		return () => {}
	})

	const effect1Mock = mock(() => {})
	const effect2Mock = mock((_connected: boolean) => {})

	createEffect(() => {
		ref.get()
		effect1Mock()
	})

	createEffect(() => {
		const db = ref.get()
		effect2Mock(db.connected)
	})

	expect(effect1Mock).toHaveBeenCalledTimes(1)
	expect(effect2Mock).toHaveBeenCalledTimes(1)
	expect(effect2Mock).toHaveBeenCalledWith(false)

	database.connected = true
	database.queries = 10
	notifyFn()

	expect(effect1Mock).toHaveBeenCalledTimes(2)
	expect(effect2Mock).toHaveBeenCalledTimes(2)
	expect(effect2Mock).toHaveBeenLastCalledWith(true)
})

test('Ref - lazy activation and cleanup', async () => {
	let counter = 0
	let intervalId: Timer | undefined

	const ref = createRef(new Date(), notify => {
		// Start: set up interval that notifies
		intervalId = setInterval(() => {
			counter++
			notify()
		}, 10)
		// Return cleanup
		return () => {
			clearInterval(intervalId)
			intervalId = undefined
		}
	})

	// Counter should not be running yet (no subscribers)
	expect(counter).toBe(0)
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(0)
	expect(intervalId).toBeUndefined()

	// Effect subscribes — triggers start callback
	const dispose = createEffect(() => {
		ref.get()
	})

	// Counter should now be running
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBeGreaterThan(0)
	expect(intervalId).toBeDefined()

	// Dispose effect — triggers cleanup (last subscriber removed)
	dispose()
	const counterAfterStop = counter

	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(counterAfterStop)
	expect(intervalId).toBeUndefined()
})

test('Ref - start callback only called on first subscriber', () => {
	const obj = { value: 1 }
	let startCount = 0
	let stopCount = 0

	const ref = createRef(obj, () => {
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
	expect(startCount).toBe(1) // Not called again

	dispose1()
	expect(stopCount).toBe(0) // Still has subscriber

	dispose2()
	expect(stopCount).toBe(1) // Last subscriber removed
})
