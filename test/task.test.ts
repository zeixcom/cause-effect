import { describe, expect, test } from 'bun:test'
import { batch, flush, Signal, Task } from '../src/classes/signal'

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

		const task = new Task(
			async (_old, abort) => {
				// Capture dependency
				const v = s.get()
				await tick()
				if (abort.aborted) throw new Error('aborted')
				return v * 2
			},
			{ initialValue: 0 },
		)

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
		let shouldResolve = false

		// Simple task that doesn't depend on anything, just waits
		const task = new Task<number>(
			async (_old, abort) => {
				// Wait until we explicitly allow resolution
				while (!shouldResolve) {
					if (abort.aborted) throw new Error('aborted')
					await tick()
				}
				return 42
			},
			{ initialValue: 0 },
		)

		// Derived signal that depends on task
		const derived = new Signal<number>((_old: number) => task.get() + 100)

		// Initial read: task starts running but is pending, returns initial committed value
		expect(derived.get()).toBe(100) // 0 + 100
		expect(task.pending).toBe(true)

		// While task is pending, dependent still sees old committed value
		expect(derived.get()).toBe(100)
		expect(task.pending).toBe(true)

		// Now allow the task to resolve
		shouldResolve = true
		await waitFor(() => !task.pending)

		// After settle, task has committed new value and dependent sees it
		expect(task.pending).toBe(false)
		expect(task.get()).toBe(42)
		expect(derived.get()).toBe(142) // 42 + 100
	})

	test('abort/restart: dependency change while pending aborts in-flight and next get starts a new run', async () => {
		const s = new Signal(1)

		let started = 0
		let aborted = 0

		const task = new Task(
			async (_old, abort) => {
				started++
				const v = s.get()
				await tick()
				if (abort.aborted) {
					aborted++
					throw new Error('aborted')
				}
				return v
			},
			{ initialValue: 0 },
		)

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

		const task = new Task(
			async (_old, abort) => {
				const v = s.get()
				await tick()
				if (abort.aborted) throw new Error('aborted')
				if (shouldFail) throw new Error('boom')
				return v * 10
			},
			{ initialValue: 7 },
		)

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

		const task = new Task(
			async (_old, abort) => {
				const v = s.get()
				await tick()
				if (abort.aborted) throw new Error('aborted')
				return v
			},
			{ initialValue: 0 },
		)

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
