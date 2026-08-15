import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type * as currentApi from '../index.ts'
import type { ListChanges } from '../index.ts'

type Api = typeof currentApi

/* === Bundling ===
 *
 * Both sides are bundled from their own TypeScript source with identical
 * `Bun.build` options. This matters: an unbundled module graph and a
 * single-file bundle differ by 5-10% on identical code, which is a large
 * fraction of PERF_MARGIN. Importing the baseline through its package name
 * would also hand it whatever build flags it happened to be published with,
 * so neither side is allowed to depend on publish-time decisions.
 */

const outdir = mkdtempSync(join(tmpdir(), 'ce-perf-'))

async function bundle(entrypoint: string, name: string): Promise<Api> {
	const result = await Bun.build({
		entrypoints: [entrypoint],
		outdir,
		naming: `${name}.js`,
		target: 'bun',
		format: 'esm',
		minify: false,
	})
	if (!result.success)
		throw new AggregateError(result.logs, `Failed to bundle ${name}`)
	return (await import(join(outdir, `${name}.js`))) as Api
}

// The baseline's exports map resolves to its own TypeScript source under Bun,
// so go through package.json to get the install directory instead.
const stableDir = dirname(
	Bun.resolveSync('@zeix/cause-effect-stable/package.json', import.meta.dir),
)

const current = await bundle(join(import.meta.dir, '..', 'index.ts'), 'current')
const stable = await bundle(join(stableDir, 'index.ts'), 'stable')

afterAll(async () => {
	await rm(outdir, { recursive: true, force: true })
})

/* === DCE sink — prevents the JIT from eliminating allocations with no other observable effect === */
let _sink = 0

/* === Measurement === */

const PERF_MARGIN = 0.2
const PERF_FLOOR = 1 // absolute delta in ms below which the ratio is not defensible
const PASSES = 11

type Measurement = {
	currentMs: number
	stableMs: number
	ratio: number
}

function median(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b)
	// biome-ignore lint/style/noNonNullAssertion: callers always pass PASSES samples
	return sorted[(sorted.length - 1) >> 1]!
}

/**
 * Build both graphs, cross-warm them interleaved (100 pairs), then take
 * `PASSES` timed passes of `iterations` iterations each.
 *
 * The verdict is the median of the per-pass ratios, not the ratio of the two
 * medians. Pairing matters because runner interference is sustained rather
 * than per-sample: a noisy neighbour inflates both sides of the same pass, and
 * dividing within the pass cancels it. Taking each side's median independently
 * throws that cancellation away and reports the interference as a regression.
 *
 * Order alternates per pass because the leading side pays for cache warming and
 * frequency ramp that the trailing side then inherits.
 */
function measurePair(
	setupCurrent: () => () => void,
	setupStable: () => () => void,
	iterations: number,
): Measurement {
	Bun.gc(true)
	const fnC = setupCurrent()
	const fnS = setupStable()
	for (let i = 0; i < 100; i++) {
		fnC()
		fnS()
	}

	const time = (fn: () => void): number => {
		const start = performance.now()
		for (let i = 0; i < iterations; i++) fn()
		return performance.now() - start
	}

	const passesC: number[] = []
	const passesS: number[] = []
	const ratios: number[] = []
	for (let p = 0; p < PASSES; p++) {
		let c: number
		let s: number
		if (p % 2 === 0) {
			c = time(fnC)
			s = time(fnS)
		} else {
			s = time(fnS)
			c = time(fnC)
		}
		passesC.push(c)
		passesS.push(s)
		ratios.push(c / s)
	}
	return {
		currentMs: median(passesC),
		stableMs: median(passesS),
		ratio: median(ratios),
	}
}

function check(name: string, m: Measurement): void {
	const limit = 1 + PERF_MARGIN
	// A sub-millisecond gap is below what this harness can defend, whatever the
	// ratio says. Unlike a floor folded into the limit, this only ever widens
	// tolerance on fast machines — it never tightens it on slow ones.
	const waived = m.currentMs - m.stableMs <= PERF_FLOOR
	console.log(
		`  ${name}: current ${m.currentMs.toFixed(1)}ms |` +
			` stable ${m.stableMs.toFixed(1)}ms |` +
			` ratio ${m.ratio.toFixed(2)}x | limit ${limit.toFixed(2)}x` +
			(waived ? ' | within floor' : ''),
	)
	if (waived) return
	expect(m.ratio).toBeLessThanOrEqual(limit)
}

/* === Primitive Scenarios (State / Memo / Effect) === */

describe('Performance — primitive nodes', () => {
	test('deep propagation (50 layers, 1000 iterations)', () => {
		const setup = (f: Api) => () => {
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
		const m = measurePair(setup(current), setup(stable), 1000)
		check('deepPropagation', m)
	})

	test('broad propagation (50 effects, 1000 iterations)', () => {
		const setup = (f: Api) => () => {
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
		const m = measurePair(setup(current), setup(stable), 1000)
		check('broadPropagation', m)
	})

	test('diamond propagation (width 5, 5000 iterations)', () => {
		const setup = (f: Api) => () => {
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
		const m = measurePair(setup(current), setup(stable), 5000)
		check('diamondPropagation', m)
	})

	test('create 1k signals (500 rounds)', () => {
		const setup = (f: Api) => () => {
			return () => {
				for (let i = 0; i < 1000; i++) _sink += f.createState(i).get()
			}
		}
		const m = measurePair(setup(current), setup(stable), 500)
		check('signalCreation', m)
	})
})

/* === Composite Scenarios (List / Store / Collection) === */

describe('Performance — composite nodes', () => {
	test('list structural mutations (add+remove, 5000 iterations)', () => {
		const setup = (f: Api) => () => {
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
		const m = measurePair(setup(current), setup(stable), 5000)
		check('listStructural', m)
	})

	test('list item replace — item signal to direct subscriber (10000 iterations)', () => {
		// listStructural covers the list-node → structural-subscriber path.
		// This scenario isolates the item-signal → direct-subscriber path,
		// which is the unique contribution of replace().
		const setup = (f: Api) => () => {
			const list = f.createList<number>([0])
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			const key = list.keyAt(0)!
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			f.createEffect(() => void list.byKey(key)!.get())
			let i = 0
			return () => f.batch(() => list.replace(key, ++i))
		}
		const m = measurePair(setup(current), setup(stable), 10000)
		check('listReplace', m)
	})

	test('store property update via proxy (5000 iterations)', () => {
		const setup = (f: Api) => () => {
			const store = f.createStore({ x: 0 })
			f.createEffect(() => {
				store.get()
			})
			let i = 0
			return () => f.batch(() => store.x.set(++i))
		}
		const m = measurePair(setup(current), setup(stable), 5000)
		check('storeUpdate', m)
	})

	test('collection structural mutations (add+remove via applyChanges, 5000 iterations)', () => {
		type Item = { id: string }
		// The stable baseline still ships the 1.x `createCollection(watched, options)`
		// signature, so this benchmark passes each side the call shape it expects.
		type LegacyCreateCollection = (
			watched: (apply: (changes: ListChanges<Item>) => void) => () => void,
			options?: { keyConfig: (item: Item) => string },
		) => { get(): Item[] }
		const setup = (f: Api, legacyWatchedPosition: boolean) => () => {
			let apply!: (changes: ListChanges<Item>) => void
			const watched = (applyChanges: (changes: ListChanges<Item>) => void) => {
				apply = applyChanges
				return () => {}
			}
			const keyConfig = (item: Item): string => item.id
			const col = legacyWatchedPosition
				? (
						f as unknown as { createCollection: LegacyCreateCollection }
					).createCollection(watched, { keyConfig })
				: f.deriveList<Item>([], { watched, keyConfig })
			f.createEffect(() => {
				col.get()
			})
			return () =>
				f.batch(() => {
					apply({ add: [{ id: 'k' }] })
					apply({ remove: [{ id: 'k' }] })
				})
		}
		const m = measurePair(setup(current, false), setup(stable, true), 5000)
		check('collectionMutate', m)
	})

	test('derived collection item update (2000 iterations)', () => {
		// The stable baseline predates `deriveList(source, fn)`; it exposes the
		// per-item derivation as the `.deriveCollection()` method instead.
		type LegacyDerived = { get(): number[] }
		const setup = (f: Api, legacyMethod: boolean) => () => {
			const list = f.createList<number>(Array.from({ length: 5 }, (_, i) => i))
			const cb = (v: number) => v * 2
			const derived: LegacyDerived = legacyMethod
				? (
						list as unknown as {
							deriveCollection(cb: (v: number) => number): LegacyDerived
						}
					).deriveCollection(cb)
				: f.deriveList(list, cb)
			// biome-ignore lint/style/noNonNullAssertion: list is pre-populated
			const firstKey = list.keyAt(0)!
			f.createEffect(() => {
				derived.get()
			})
			let i = 0
			return () => f.batch(() => list.replace(firstKey, ++i))
		}
		const m = measurePair(setup(current, false), setup(stable, true), 2000)
		check('derivedCollection', m)
	})
})
