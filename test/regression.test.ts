import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { batch, createEffect, createMemo, createState } from '../index.ts'

/* === Baseline Management === */

type Baseline = {
	bundleMinified: number
	bundleGzipped: number
	deepPropagation: number
	broadPropagation: number
	diamondPropagation: number
	signalCreation: number
}

const BASELINE_PATH = `${import.meta.dir}/regression-baseline.json`
const BUNDLE_MARGIN = 0.1 // 10%
const PERF_MARGIN = 0.2 // 20%
const PERF_FLOOR = 2 // minimum absolute tolerance in ms

const baseline: Baseline | null = existsSync(BASELINE_PATH)
	? JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
	: null

const current = {} as Baseline

function check(
	key: keyof Baseline,
	value: number,
	margin: number,
	unit: string,
): void {
	current[key] = value
	if (baseline) {
		const relative = baseline[key] * (1 + margin)
		const limit =
			unit === 'ms'
				? Math.max(relative, baseline[key] + PERF_FLOOR)
				: relative
		console.log(
			`  ${key}: ${value.toFixed(unit === 'ms' ? 1 : 0)}${unit}` +
				` (baseline: ${baseline[key].toFixed(unit === 'ms' ? 1 : 0)}${unit},` +
				` limit: ${limit.toFixed(unit === 'ms' ? 1 : 0)}${unit})`,
		)
		expect(value).toBeLessThanOrEqual(limit)
	} else {
		console.log(
			`  ${key}: ${value.toFixed(unit === 'ms' ? 1 : 0)}${unit} (no baseline, recording)`,
		)
	}
}

afterAll(() => {
	if (!baseline) {
		writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, '\t')}\n`)
		console.log(`\n  Baseline written to ${BASELINE_PATH}`)
	}
})

/* === Bundle Size Regression Tests === */

describe('Bundle size', () => {
	test('minified bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		const bytes = await result.outputs[0].arrayBuffer()
		check('bundleMinified', bytes.byteLength, BUNDLE_MARGIN, 'B')
	})

	test('gzipped bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		const bytes = await result.outputs[0].arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		check('bundleGzipped', gzipped, BUNDLE_MARGIN, 'B')
	})
})

/* === Performance Regression Tests === */

function measure(setup: () => () => void, iterations: number): number {
	const fn = setup()
	for (let i = 0; i < 100; i++) fn() // warmup
	const start = performance.now()
	for (let i = 0; i < iterations; i++) fn()
	return performance.now() - start
}

describe('Performance', () => {
	test('deep propagation (50 layers, 1000 iterations)', () => {
		const elapsed = measure(() => {
			const head = createState(0)
			let current: { get(): number } = head
			for (let i = 0; i < 50; i++) {
				const c = current
				current = createMemo(() => c.get() + 1)
			}
			createEffect(() => {
				current.get()
			})
			let i = 0
			return () => batch(() => head.set(++i))
		}, 1000)
		check('deepPropagation', elapsed, PERF_MARGIN, 'ms')
	})

	test('broad propagation (50 effects, 1000 iterations)', () => {
		const elapsed = measure(() => {
			const head = createState(0)
			for (let i = 0; i < 50; i++) {
				const c = createMemo(() => head.get() + i)
				const c2 = createMemo(() => c.get() + 1)
				createEffect(() => {
					c2.get()
				})
			}
			let i = 0
			return () => batch(() => head.set(++i))
		}, 1000)
		check('broadPropagation', elapsed, PERF_MARGIN, 'ms')
	})

	test('diamond propagation (width 5, 5000 iterations)', () => {
		const elapsed = measure(() => {
			const head = createState(0)
			const branches: { get(): number }[] = []
			for (let i = 0; i < 5; i++)
				branches.push(createMemo(() => head.get() + 1))
			const sum = createMemo(() =>
				branches.reduce((a, b) => a + b.get(), 0),
			)
			createEffect(() => {
				sum.get()
			})
			let i = 0
			return () => batch(() => head.set(++i))
		}, 5000)
		check('diamondPropagation', elapsed, PERF_MARGIN, 'ms')
	})

	test('create 1k signals (500 rounds)', () => {
		const fn = () => {
			for (let i = 0; i < 1000; i++) createState(i)
		}
		for (let i = 0; i < 50; i++) fn() // warmup
		const start = performance.now()
		for (let i = 0; i < 500; i++) fn()
		const elapsed = performance.now() - start
		check('signalCreation', elapsed, PERF_MARGIN, 'ms')
	})
})
