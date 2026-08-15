/**
 * Bundle entry point for the core-signals-only regression test
 * (test/regression-bundle.test.ts). Imports from the package barrel — the same
 * path a real consumer uses — and actually wires the narrow synchronous core
 * together so the bundler can't eliminate code a real usage would retain.
 *
 * The composition is the ADR-0018 §5 trio: `createState`, a synchronous
 * derivation, and `createEffect`. That is the shape of the ≤3 kB core promise —
 * a bundle like this one must not pull in the task recompute path, the watched
 * lifecycle, or `AbortController`. `createTask` deliberately does not appear
 * here: importing it would drag the async machinery in by construction and
 * weaken the check to a plain byte count.
 */
import { createEffect, createMemo, createState } from '../../index.ts'

const count = createState(0)
const doubled = createMemo(() => count.get() * 2)

createEffect(() => {
	console.log(doubled.get())
})

count.set(1)
