import { describe, expect, test } from 'bun:test'
import * as stableModule from '@zeix/cause-effect-stable'
import type { CollectionChanges } from '../index.ts'
import * as current from '../index.ts'

const stable = stableModule as unknown as typeof current

/* === DCE sink — prevents the JIT from eliminating allocations with no other observable effect === */
let _sink = 0

/* === Measurement === */

const PERF_MARGIN = 0.2
const PERF_FLOOR = 1 // minimum absolute tolerance in ms

/**
 * Build both graphs, cross-warm them interleaved (100 pairs), then take 5
 * alternating timed passes of `iterations` iterations each. Alternating passes
 * equalize JIT state between implementations; forcing GC beforehand removes
 * accumulated cross-scenario heap pressure; median of 5 suppresses OS outliers.
 */
function measurePair(
	setupCurrent: () => () => void,
	setupStable: () => () => void,
	iterations: number,
): [number, number] {
	Bun.gc(true)
	const fnC = setupCurrent()
	const fnS = setupStable()
	for (let i = 0; i < 100; i++) {
		fnC()
		fnS()
	}
	const passesC: number[] = []
	const passesS: number[] = []
	for (let p = 0; p < 11; p++) {
		let start = performance.now()
		for (let i = 0; i < iterations; i++) fnC()
		passesC.push(performance.now() - start)
		start = performance.now()
		for (let i = 0; i < iterations; i++) fnS()
		passesS.push(performance.now() - start)
	}
	passesC.sort((a, b) => a - b)
	passesS.sort((a, b) => a - b)
	// biome-ignore lint/style/noNonNullAssertion: arrays always have 11 elements
	return [passesC[5]!, passesS[5]!]
}

function check(name: string, currentMs: number, stableMs: number): void {
	const limit = Math.max(stableMs * (1 + PERF_MARGIN), stableMs + PERF_FLOOR)
	console.log(
		`  ${name}: current ${currentMs.toFixed(1)}ms |` +
			` stable ${stableMs.toFixed(1)}ms |` +
			` limit ${limit.toFixed(1)}ms`,
	)
	expect(currentMs).toBeLessThanOrEqual(limit)
}

/* === Primitive Scenarios (State / Memo / Effect) === */

describe('Performance — primitive nodes', () => {
	test('deep propagation (50 layers, 1000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const head = f.createState(0)
			let cur: { get(): number } = head
			for (let i = 0; i < 50; i++) {
				const c = cur
				cur = f.createMemo(() => c.get() + 1)
			}
			f.createEffect(() => {
				cur.get()
			})
			let i = 0
			return () => f.batch(() => head.set(++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			1000,
		)
		check('deepPropagation', currentMs, stableMs)
	})

	test('broad propagation (50 effects, 1000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const head = f.createState(0)
			for (let i = 0; i < 50; i++) {
				const c = f.createMemo(() => head.get() + i)
				const c2 = f.createMemo(() => c.get() + 1)
				f.createEffect(() => {
					c2.get()
				})
			}
			let i = 0
			return () => f.batch(() => head.set(++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			1000,
		)
		check('broadPropagation', currentMs, stableMs)
	})

	test('diamond propagation (width 5, 5000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const head = f.createState(0)
			const branches = Array.from({ length: 5 }, () =>
				f.createMemo(() => head.get() + 1),
			)
			const sum = f.createMemo(() => branches.reduce((a, b) => a + b.get(), 0))
			f.createEffect(() => {
				sum.get()
			})
			let i = 0
			return () => f.batch(() => head.set(++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			5000,
		)
		check('diamondPropagation', currentMs, stableMs)
	})

	test('create 1k signals (500 rounds)', () => {
		const setup = (f: typeof current) => () => {
			return () => {
				for (let i = 0; i < 1000; i++) _sink += f.createState(i).get()
			}
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			500,
		)
		check('signalCreation', currentMs, stableMs)
	})
})

/* === Composite Scenarios (List / Store / Collection) === */

describe('Performance — composite nodes', () => {
	test('list structural mutations (add+remove, 5000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const list = f.createList<number>([])
			f.createEffect(() => {
				list.get()
			})
			let i = 0
			return () =>
				f.batch(() => {
					const key = list.add(++i)
					list.remove(key)
				})
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			5000,
		)
		check('listStructural', currentMs, stableMs)
	})

	test('list item replace — item signal to direct subscriber (10000 iterations)', () => {
		// listStructural covers the list-node → structural-subscriber path.
		// This scenario isolates the item-signal → direct-subscriber path,
		// which is the unique contribution of replace().
		const setup = (f: typeof current) => () => {
			const list = f.createList<number>([0])
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			const key = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			f.createEffect(() => void list.byKey(key)!.get())
			let i = 0
			return () => f.batch(() => list.replace(key, ++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			10000,
		)
		check('listReplace', currentMs, stableMs)
	})

	test('store property update via proxy (5000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const store = f.createStore({ x: 0 })
			f.createEffect(() => {
				store.get()
			})
			let i = 0
			return () => f.batch(() => store.x.set(++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			5000,
		)
		check('storeUpdate', currentMs, stableMs)
	})

	test('collection structural mutations (add+remove via applyChanges, 5000 iterations)', () => {
		type Item = { id: string }
		const setup = (f: typeof current) => () => {
			let apply!: (changes: CollectionChanges<Item>) => void
			const col = f.createCollection<Item>(
				applyChanges => {
					apply = applyChanges
					return () => {}
				},
				{ keyConfig: (item: Item) => item.id },
			)
			f.createEffect(() => {
				col.get()
			})
			return () =>
				f.batch(() => {
					apply({ add: [{ id: 'k' }] })
					apply({ remove: [{ id: 'k' }] })
				})
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			5000,
		)
		check('collectionMutate', currentMs, stableMs)
	})

	test('derived collection item update (2000 iterations)', () => {
		const setup = (f: typeof current) => () => {
			const list = f.createList<number>(Array.from({ length: 5 }, (_, i) => i))
			const derived = list.deriveCollection((v: number) => v * 2)
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			const firstKey = list.keyAt(0)!
			f.createEffect(() => {
				derived.get()
			})
			let i = 0
			return () => f.batch(() => list.replace(firstKey, ++i))
		}
		const [currentMs, stableMs] = measurePair(
			setup(current),
			setup(stable),
			2000,
		)
		check('derivedCollection', currentMs, stableMs)
	})
})
