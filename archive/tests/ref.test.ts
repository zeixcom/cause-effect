import { expect, mock, test } from 'bun:test'
import { isRef, Ref } from '../classes/ref'
import { createEffect } from '../effect'

test('Ref - basic functionality', () => {
	const obj = { name: 'test', value: 42 }
	const ref = new Ref(obj)

	expect(ref.get()).toBe(obj)
	expect(ref[Symbol.toStringTag]).toBe('Ref')
})

test('Ref - isRef type guard', () => {
	const ref = new Ref({ test: true })
	const notRef = { test: true }

	expect(isRef(ref)).toBe(true)
	expect(isRef(notRef)).toBe(false)
	expect(isRef(null)).toBe(false)
	expect(isRef(undefined)).toBe(false)
})

test('Ref - validation with guard function', () => {
	const isConfig = (
		value: unknown,
	): value is { host: string; port: number } =>
		typeof value === 'object' &&
		value !== null &&
		'host' in value &&
		'port' in value &&
		typeof value.host === 'string' &&
		typeof value.port === 'number'

	const validConfig = { host: 'localhost', port: 3000 }
	const invalidConfig = { host: 'localhost' } // missing port

	expect(() => new Ref(validConfig, { guard: isConfig })).not.toThrow()
	expect(() => new Ref(invalidConfig, { guard: isConfig })).toThrow()
})

test('Ref - reactive subscriptions', () => {
	const server = { status: 'offline', connections: 0 }
	const ref = new Ref(server)

	let effectRunCount = 0
	let lastStatus: string = ''

	createEffect(() => {
		const current = ref.get()
		lastStatus = current.status
		effectRunCount++
	})

	expect(effectRunCount).toBe(1)
	expect(lastStatus).toBe('offline')

	// Simulate external change without going through reactive system
	server.status = 'online'
	server.connections = 5

	// Effect shouldn't re-run yet (reference hasn't changed)
	expect(effectRunCount).toBe(1)

	// Notify that the external object has changed
	ref.notify()

	expect(effectRunCount).toBe(2)
	expect(lastStatus).toBe('online')
})

test('Ref - notify triggers watchers even with same reference', () => {
	const fileObj = { path: '/test.txt', size: 100, modified: Date.now() }
	const ref = new Ref(fileObj)

	const mockCallback = mock(() => {})

	createEffect(() => {
		ref.get()
		mockCallback()
	})

	expect(mockCallback).toHaveBeenCalledTimes(1)

	// Simulate file modification (same object reference, different content)
	fileObj.size = 200
	fileObj.modified = Date.now()

	// Notify about external change
	ref.notify()

	expect(mockCallback).toHaveBeenCalledTimes(2)

	// Multiple notifies should trigger multiple times
	ref.notify()
	expect(mockCallback).toHaveBeenCalledTimes(3)
})

test('Ref - multiple effects with same ref', () => {
	const database = { connected: false, queries: 0 }
	const ref = new Ref(database)

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

	// Simulate database connection change
	database.connected = true
	database.queries = 10
	ref.notify()

	expect(effect1Mock).toHaveBeenCalledTimes(2)
	expect(effect2Mock).toHaveBeenCalledTimes(2)
	expect(effect2Mock).toHaveBeenLastCalledWith(true)
})

test('Ref - with Bun.file() scenario', () => {
	// Mock a file-like object that could change externally
	const fileRef = {
		name: 'config.json',
		size: 1024,
		lastModified: Date.now(),
		// Simulate file methods
		exists: () => true,
		text: () => Promise.resolve('{"version": "1.0"}'),
	}

	const ref = new Ref(fileRef)

	let sizeChanges = 0
	createEffect(() => {
		const file = ref.get()
		if (file.size > 1000) sizeChanges++
	})

	expect(sizeChanges).toBe(1) // Initial run

	// Simulate file growing (external change)
	fileRef.size = 2048
	fileRef.lastModified = Date.now()
	ref.notify()

	expect(sizeChanges).toBe(2) // Effect re-ran and condition still met

	// Simulate file shrinking
	fileRef.size = 500
	ref.notify()

	expect(sizeChanges).toBe(2) // Effect re-ran but condition no longer met
})

test('Ref - validation errors', () => {
	// @ts-expect-error deliberatly provoked error
	expect(() => new Ref(null)).toThrow()
	// @ts-expect-error deliberatly provoked error
	expect(() => new Ref(undefined)).toThrow()
})

test('Ref - server config object scenario', () => {
	const config = {
		host: 'localhost',
		port: 3000,
		ssl: false,
		maxConnections: 100,
	}

	const configRef = new Ref(config)
	const connectionAttempts: string[] = []

	createEffect(() => {
		const cfg = configRef.get()
		const protocol = cfg.ssl ? 'https' : 'http'
		connectionAttempts.push(`${protocol}://${cfg.host}:${cfg.port}`)
	})

	expect(connectionAttempts).toEqual(['http://localhost:3000'])

	// Simulate config reload from file/environment
	config.ssl = true
	config.port = 8443
	configRef.notify()

	expect(connectionAttempts).toEqual([
		'http://localhost:3000',
		'https://localhost:8443',
	])
})

test('Ref - handles complex nested objects', () => {
	const apiResponse = {
		status: 200,
		data: {
			users: [{ id: 1, name: 'Alice' }],
			pagination: { page: 1, total: 1 },
		},
		headers: { 'content-type': 'application/json' },
	}

	const ref = new Ref(apiResponse)
	let userCount = 0

	createEffect(() => {
		const response = ref.get()
		userCount = response.data.users.length
	})

	expect(userCount).toBe(1)

	// Simulate API response update
	apiResponse.data.users.push({ id: 2, name: 'Bob' })
	apiResponse.data.pagination.total = 2
	ref.notify()

	expect(userCount).toBe(2)
})

test('Ref - options.watched lazy resource management', async () => {
	// 1. Create Ref with current Date
	let counter = 0
	let intervalId: Timer | undefined
	const ref = new Ref(new Date(), {
		watched: () => {
			intervalId = setInterval(() => {
				counter++
			}, 10)
		},
		unwatched: () => {
			if (intervalId) {
				clearInterval(intervalId)
				intervalId = undefined
			}
		},
	})

	// 2. Counter should not be running yet
	expect(counter).toBe(0)

	// Wait a bit to ensure counter doesn't increment
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(0)
	expect(intervalId).toBeUndefined()

	// 3. Effect subscribes by .get()ting the signal value
	const effectCleanup = createEffect(() => {
		ref.get()
	})

	// 4. Counter should now be running
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBeGreaterThan(0)
	expect(intervalId).toBeDefined()

	// 5. Call effect cleanup, which should stop internal watcher and unsubscribe
	effectCleanup()
	const counterAfterStop = counter

	// 6. Ref signal should call #unwatch() and counter should stop incrementing
	await new Promise(resolve => setTimeout(resolve, 50))
	expect(counter).toBe(counterAfterStop) // Counter should not have incremented
	expect(intervalId).toBeUndefined() // Interval should be cleared
})

test('Ref - options.watched exception handling', async () => {
	const ref = new Ref(
		{ test: 'value' },
		{
			watched: () => {
				throwingCallbackCalled = true
				throw new Error('Test error in watched callback')
			},
		},
	)

	// Mock console.error to capture error logs
	const originalError = console.error
	const errorSpy = mock(() => {})
	console.error = errorSpy

	let throwingCallbackCalled = false

	// Subscribe to trigger watched callback
	const effectCleanup = createEffect(() => {
		ref.get()
	})

	// Both callbacks should have been called despite the exception
	expect(throwingCallbackCalled).toBe(true)

	// Error should have been logged
	expect(errorSpy).toHaveBeenCalledWith(
		'Error in effect callback:',
		expect.any(Error),
	)

	// Cleanup
	effectCleanup()
	console.error = originalError
})

test('Ref - options.unwatched exception handling', async () => {
	const ref = new Ref(
		{ test: 'value' },
		{
			watched: () => {},
			unwatched: () => {
				cleanup1Called = true
				throw new Error('Test error in cleanup function')
			},
		},
	)

	// Mock console.error to capture error logs
	const originalError = console.error
	const errorSpy = mock(() => {})
	console.error = errorSpy

	let cleanup1Called = false

	// Subscribe and then unsubscribe to trigger cleanup
	const effectCleanup = createEffect(() => {
		ref.get()
	})

	// Unsubscribe to trigger cleanup functions
	effectCleanup()

	// Wait a bit for cleanup to complete
	await new Promise(resolve => setTimeout(resolve, 10))

	// Both cleanup functions should have been called despite the exception
	expect(cleanup1Called).toBe(true)

	// Error should have been logged
	expect(errorSpy).toHaveBeenCalledWith(
		'Error in effect cleanup:',
		expect.any(Error),
	)

	// Cleanup
	console.error = originalError
})
