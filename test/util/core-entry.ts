/**
 * Bundle entry point for the core-signals-only regression test
 * (test/regression-bundle.test.ts). Imports from the package barrel — the same
 * path a real consumer uses — and actually wires the four core signal types
 * together so the bundler can't eliminate code a real usage would retain.
 */
import { createEffect, createMemo, createState, createTask } from '../../index.ts'

const count = createState(0)
const doubled = createMemo(() => count.get() * 2)
const delayed = createTask(async (_prev, signal) => {
	await new Promise(resolve => setTimeout(resolve, 1))
	if (signal.aborted) throw new Error('aborted')
	return count.get()
})

createEffect(() => {
	console.log(doubled.get(), delayed.get(), delayed.isPending())
})

count.set(1)
