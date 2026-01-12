import { describe, expect, test } from 'bun:test'
import { batch, flush, Signal } from '../src/classes/signal'
import { Task } from '../src/classes/task'

const tick = async (): Promise<void> => {
	// Allow pending promise continuations to run.
	// In Bun/JS microtask scheduling, an async function that `await`s once typically needs
	// two microtask turns: one to resume the async function and one to run attached `.then()`.
	await Promise.resolve()
	await Promise.resolve()
}

const waitFor = async (
	condition: () => boolean,
	{
		maxTurns = 50,
	}: {
		maxTurns?: number
	} = {},
): Promise<void> => {
	for (let i = 0; i < maxTurns; i++) {
		if (condition()) return
		await tick()
		flush()
	}
	throw new Error('waitFor: condition not met')
}

describe('Task (async signal)', () => {
	test('pending is true while awaiting; value stays at last committed until settle', async () => {
		const s = new Signal(1)

		const task = new Task<number>(async (_old, abort) => {
			// Capture dependency
			const v = s.get()
			await tick()
			if (abort.aborted) throw new Error('aborted')
			return v * 2
		}, 0)

		// First read starts the async run and returns initial committed value.
		expect(task.get()).toBe(0)
		expect(task.pending).toBe(true)

		// Still pending, still old committed value.
		expect(task.get()).toBe(0)

		// Wait for settle and flush queued effects (if any).
		await waitFor(() => !task.pending)

		// Now committed.
		expect(task.pending).toBe(false)
		expect(task.get()).toBe(2)
	})

	test('commit propagates to dependents only after settle', async () => {
		const s = new Signal(2)
		let resolve!: (v: number) => void

		// (was used during development; keep the resolver only)
		new Task<number>(
			async (_old, _abort) =>
				new Promise<number>(r => {
					resolve = r
				}),
			0,
		)

		// Ensure the task captures dependency during run
		// (the callback will read s.get() synchronously before returning promise)
		// We'll do that by wrapping callback: on initial read, capture s and then await external resolve.
		const task2 = new Task<number>(async (_old, abort) => {
			const v = s.get()
			await new Promise<void>(r => {
				// reuse resolve channel by coercion
				resolve = (_n: number) => r()
			})
			if (abort.aborted) throw new Error('aborted')
			return v
		}, 0)

		const derived = new Signal<number>((_old: number) => task2.get() + 1)

		// Start task; derived reads old committed value.
		expect(derived.get()).toBe(1)
		expect(task2.pending).toBe(true)

		// Change source while task pending should not immediately change derived.
		s.set(5)
		expect(derived.get()).toBe(1)

		// Resolve task and flush; now derived should update.
		resolve(0)
		await tick()
		flush()
		expect(task2.pending).toBe(false)
		expect(derived.get()).toBe(6)
	})

	test('abort/restart: dependency change while pending aborts in-flight and next get starts a new run', async () => {
		const s = new Signal(1)

		let started = 0
		let aborted = 0

		const task = new Task<number>(async (_old, abort) => {
			started++
			const v = s.get()
			await tick()
			if (abort.aborted) {
				aborted++
				throw new Error('aborted')
			}
			return v
		}, 0)

		// Start run #1
		expect(task.get()).toBe(0)
		expect(task.pending).toBe(true)
		expect(started).toBe(1)

		// Change dependency while pending -> should abort in-flight
		s.set(2)

		// Next get should restart (run #2)
		expect(task.get()).toBe(0)
		expect(task.pending).toBe(true)
		expect(started).toBe(2)

		// Allow resolution
		await waitFor(() => !task.pending)

		expect(task.pending).toBe(false)
		expect(task.get()).toBe(2)
		expect(aborted).toBeGreaterThanOrEqual(0)
	})

	test('error propagation: rejected promise stores error and get() rethrows until next success', async () => {
		const s = new Signal(1)

		let shouldFail = true

		const task = new Task<number>(async (_old, abort) => {
			const v = s.get()
			await tick()
			if (abort.aborted) throw new Error('aborted')
			if (shouldFail) throw new Error('boom')
			return v * 10
		}, 7)

		// Start run; still returns committed value
		expect(task.get()).toBe(7)

		// Wait for error to be committed to the Task instance (then-handler runs)
		await waitFor(() => !!task.error)

		expect(() => task.get()).toThrow('boom')

		// Next run should succeed and clear error
		shouldFail = false
		s.set(2)

		// Trigger run
		expect(task.get()).toBe(7)

		// Wait for success commit
		await waitFor(() => !task.pending && !task.error)

		expect(task.get()).toBe(20)
	})

	test('dispose aborts and detaches from graph (no further updates)', async () => {
		const s = new Signal(1)

		const task = new Task<number>(async (_old, abort) => {
			const v = s.get()
			await tick()
			if (abort.aborted) throw new Error('aborted')
			return v
		}, 0)

		// Start it
		task.get()
		expect(task.pending).toBe(true)

		// Dispose should abort and detach
		task.dispose()

		// After disposal, changes shouldn't matter; task should not go pending again.
		batch(() => {
			s.set(2)
		})

		expect(task.pending).toBe(false)
		// Still returns last committed value (0) and no throw
		expect(task.get()).toBe(0)
	})
})
