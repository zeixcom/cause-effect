import { describe, expect, mock, test } from 'bun:test'
import { batch, createEffect, Memo, State } from '../index.ts'
import {
	batch as batchNext,
	createEffect as createEffectNext,
	createMemo,
	createState,
} from '../next.ts'
import { Counter, makeGraph, runGraph } from './util/dependency-graph'
import type { Computed, ReactiveFramework } from './util/reactive-framework'

/* === Utility Functions === */

const busy = () => {
	let _a = 0
	for (let i = 0; i < 1_00; i++) {
		_a++
	}
}

/* === Framework Adapters === */

const v17: ReactiveFramework = {
	name: 'v0.17.3 (classes)',
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	signal: <T extends {}>(initialValue: T) => {
		const s = new State<T>(initialValue)
		return {
			write: (v: T) => s.set(v),
			read: () => s.get(),
		}
	},
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	computed: <T extends {}>(fn: () => T) => {
		const c = new Memo(fn)
		return { read: () => c.get() }
	},
	effect: (fn: () => undefined) => createEffect(fn),
	withBatch: fn => batch(fn),
	withBuild: <T>(fn: () => T) => fn(),
}

const v18: ReactiveFramework = {
	name: 'v0.18.0 (graph)',
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	signal: <T extends {}>(initialValue: T) => {
		const s = createState(initialValue)
		return { write: s.set, read: s.get }
	},
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	computed: <T extends {}>(fn: () => T) => {
		const c = createMemo(fn)
		return { read: c.get }
	},
	effect: (fn: () => undefined) => {
		createEffectNext(() => fn())
	},
	withBatch: fn => batchNext(fn),
	withBuild: <T>(fn: () => T) => fn(),
}

const testPullCounts = true

function makeConfig() {
	return {
		width: 3,
		totalLayers: 3,
		staticFraction: 1,
		nSources: 2,
		readFraction: 1,
		expected: {},
		iterations: 1,
	}
}

/* === Parameterized Test Suite === */

for (const framework of [v17, v18]) {
	const name = framework.name

	describe(`Basic tests [${name}]`, () => {
		test('simple dependency executes', () => {
			framework.withBuild(() => {
				const s = framework.signal(2)
				const c = framework.computed(() => s.read() * 2)
				expect(c.read()).toEqual(4)
			})
		})

		test('simple write', () => {
			framework.withBuild(() => {
				const s = framework.signal(2)
				const c = framework.computed(() => s.read() * 2)
				expect(s.read()).toEqual(2)
				expect(c.read()).toEqual(4)

				s.write(3)
				expect(s.read()).toEqual(3)
				expect(c.read()).toEqual(6)
			})
		})

		test('static graph', () => {
			const config = makeConfig()
			const counter = new Counter()
			const graph = makeGraph(framework, config, counter)
			const sum = runGraph(graph, 2, 1, framework)
			expect(sum).toEqual(16)
			if (testPullCounts) {
				expect(counter.count).toEqual(11)
			} else {
				expect(counter.count).toBeGreaterThanOrEqual(11)
			}
		})

		test('static graph, read 2/3 of leaves', () => {
			framework.withBuild(() => {
				const config = makeConfig()
				config.readFraction = 2 / 3
				config.iterations = 10
				const counter = new Counter()
				const graph = makeGraph(framework, config, counter)
				const sum = runGraph(graph, 10, 2 / 3, framework)

				expect(sum).toEqual(71)
				if (testPullCounts) {
					expect(counter.count).toEqual(41)
				} else {
					expect(counter.count).toBeGreaterThanOrEqual(41)
				}
			})
		})

		test('dynamic graph', () => {
			framework.withBuild(() => {
				const config = makeConfig()
				config.staticFraction = 0.5
				config.width = 4
				config.totalLayers = 2
				const counter = new Counter()
				const graph = makeGraph(framework, config, counter)
				const sum = runGraph(graph, 10, 1, framework)

				expect(sum).toEqual(72)
				if (testPullCounts) {
					expect(counter.count).toEqual(22)
				} else {
					expect(counter.count).toBeGreaterThanOrEqual(22)
				}
			})
		})

		test('withBuild', () => {
			const r = framework.withBuild(() => {
				const s = framework.signal(2)
				const c = framework.computed(() => s.read() * 2)
				expect(c.read()).toEqual(4)
				return c.read()
			})
			expect(r).toEqual(4)
		})

		test('effect', () => {
			const spy = (_v: number) => {}
			const spyMock = mock(spy)

			const s = framework.signal(2)
			let c: { read: () => number } = { read: () => 0 }

			framework.withBuild(() => {
				c = framework.computed(() => s.read() * 2)
				framework.effect(() => {
					spyMock(c.read())
				})
			})
			expect(spyMock.mock.calls.length).toBe(1)

			framework.withBatch(() => {
				s.write(3)
			})
			expect(s.read()).toEqual(3)
			expect(c.read()).toEqual(6)
			expect(spyMock.mock.calls.length).toBe(2)
		})
	})

	describe(`Kairo tests [${name}]`, () => {
		test('avoidable propagation', async () => {
			const head = framework.signal(0)
			const computed1 = framework.computed(() => head.read())
			const computed2 = framework.computed(() => {
				computed1.read()
				return 0
			})
			const computed3 = framework.computed(() => {
				busy()
				return computed2.read() + 1
			})
			const computed4 = framework.computed(() => computed3.read() + 2)
			const computed5 = framework.computed(() => computed4.read() + 3)
			framework.effect(() => {
				computed5.read()
				busy()
			})

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				expect(computed5.read()).toBe(6)
				for (let i = 0; i < 10; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(computed5.read()).toBe(6)
				}
			}
		})

		test('broad propagation', async () => {
			const head = framework.signal(0)
			let last = head as { read: () => number }
			const callCounter = new Counter()
			for (let i = 0; i < 50; i++) {
				const current = framework.computed(() => head.read() + i)
				const current2 = framework.computed(() => current.read() + 1)
				framework.effect(() => {
					current2.read()
					callCounter.count++
				})
				last = current2
			}

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				const atleast = 50 * 50
				callCounter.count = 0
				for (let i = 0; i < 50; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(last.read()).toBe(i + 50)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})

		test('deep propagation', async () => {
			const len = 50
			const head = framework.signal(0)
			let current = head as { read: () => number }
			for (let i = 0; i < len; i++) {
				const c = current
				current = framework.computed(() => c.read() + 1)
			}
			const callCounter = new Counter()
			framework.effect(() => {
				current.read()
				callCounter.count++
			})
			const iter = 50

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				const atleast = iter
				callCounter.count = 0
				for (let i = 0; i < iter; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(current.read()).toBe(len + i)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})

		test('diamond', async () => {
			const width = 5
			const head = framework.signal(0)
			const current: { read(): number }[] = []
			for (let i = 0; i < width; i++) {
				current.push(framework.computed(() => head.read() + 1))
			}
			const sum = framework.computed(() =>
				current.map(x => x.read()).reduce((a, b) => a + b, 0),
			)
			const callCounter = new Counter()
			framework.effect(() => {
				sum.read()
				callCounter.count++
			})

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				expect(sum.read()).toBe(2 * width)
				const atleast = 500
				callCounter.count = 0
				for (let i = 0; i < 500; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(sum.read()).toBe((i + 1) * width)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})

		test('mux', async () => {
			const heads = new Array(100)
				.fill(null)
				.map(_ => framework.signal(0))
			const mux = framework.computed(() =>
				Object.fromEntries(heads.map(h => h.read()).entries()),
			)
			const splited = heads
				.map((_, index) => framework.computed(() => mux.read()[index]))
				.map(x => framework.computed(() => x.read() + 1))

			for (const x of splited) {
				framework.effect(() => {
					x.read()
				})
			}

			return () => {
				for (let i = 0; i < 10; i++) {
					framework.withBatch(() => {
						heads[i].write(i)
					})
					expect(splited[i].read()).toBe(i + 1)
				}
				for (let i = 0; i < 10; i++) {
					framework.withBatch(() => {
						heads[i].write(i * 2)
					})
					expect(splited[i].read()).toBe(i * 2 + 1)
				}
			}
		})

		test('repeated observers', async () => {
			const size = 30
			const head = framework.signal(0)
			const current = framework.computed(() => {
				let result = 0
				for (let i = 0; i < size; i++) {
					result += head.read()
				}
				return result
			})
			const callCounter = new Counter()
			framework.effect(() => {
				current.read()
				callCounter.count++
			})

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				expect(current.read()).toBe(size)
				const atleast = 100
				callCounter.count = 0
				for (let i = 0; i < 100; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(current.read()).toBe(i * size)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})

		test('triangle', async () => {
			const width = 10
			const head = framework.signal(0)
			let current = head as { read: () => number }
			const list: { read: () => number }[] = []
			for (let i = 0; i < width; i++) {
				const c = current
				list.push(current)
				current = framework.computed(() => c.read() + 1)
			}
			const sum = framework.computed(() =>
				list.map(x => x.read()).reduce((a, b) => a + b, 0),
			)
			const callCounter = new Counter()
			framework.effect(() => {
				sum.read()
				callCounter.count++
			})

			return () => {
				const count = (number: number) =>
					new Array(number)
						.fill(0)
						.map((_, i) => i + 1)
						.reduce((x, y) => x + y, 0)
				const constant = count(width)
				framework.withBatch(() => {
					head.write(1)
				})
				expect(sum.read()).toBe(constant)
				const atleast = 100
				callCounter.count = 0
				for (let i = 0; i < 100; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(sum.read()).toBe(constant - width + i * width)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})

		test('unstable', async () => {
			const head = framework.signal(0)
			const double = framework.computed(() => head.read() * 2)
			const inverse = framework.computed(() => -head.read())
			const current = framework.computed(() => {
				let result = 0
				for (let i = 0; i < 20; i++) {
					result += head.read() % 2 ? double.read() : inverse.read()
				}
				return result
			})
			const callCounter = new Counter()
			framework.effect(() => {
				current.read()
				callCounter.count++
			})

			return () => {
				framework.withBatch(() => {
					head.write(1)
				})
				expect(current.read()).toBe(40)
				const atleast = 100
				callCounter.count = 0
				for (let i = 0; i < 100; i++) {
					framework.withBatch(() => {
						head.write(i)
					})
					expect(current.read()).toBe(i % 2 ? i * 2 * 10 : i * -10)
				}
				expect(callCounter.count).toBe(atleast)
			}
		})
	})

	describe(`$mol_wire tests [${name}]`, () => {
		test('$mol_wire benchmark', () => {
			// @ts-expect-error test
			const fib = (n: number) => {
				if (n < 2) return 1
				return fib(n - 1) + fib(n - 2)
			}
			const hard = (n: number, _log: string) => n + fib(16)
			const numbers = Array.from({ length: 5 }, (_, i) => i)
			const res: (() => unknown)[] = []
			framework.withBuild(() => {
				const A = framework.signal(0)
				const B = framework.signal(0)
				const C = framework.computed(
					() => (A.read() % 2) + (B.read() % 2),
				)
				const D = framework.computed(() =>
					numbers.map(i => ({
						x: i + (A.read() % 2) - (B.read() % 2),
					})),
				)
				const E = framework.computed(() =>
					hard(C.read() + A.read() + D.read()[0].x, 'E'),
				)
				const F = framework.computed(() =>
					hard(D.read()[2].x || B.read(), 'F'),
				)
				const G = framework.computed(
					() =>
						C.read() +
						(C.read() || E.read() % 2) +
						D.read()[4].x +
						F.read(),
				)
				framework.effect(() => {
					res.push(hard(G.read(), 'H'))
				})
				framework.effect(() => {
					res.push(G.read())
				})
				framework.effect(() => {
					res.push(hard(F.read(), 'J'))
				})
				framework.effect(() => {
					res[0] = hard(G.read(), 'H')
				})
				framework.effect(() => {
					res[1] = G.read()
				})
				framework.effect(() => {
					res[2] = hard(F.read(), 'J')
				})

				return (i: number) => {
					res.length = 0
					framework.withBatch(() => {
						B.write(1)
						A.write(1 + i * 2)
					})
					framework.withBatch(() => {
						A.write(2 + i * 2)
						B.write(2)
					})
				}
			})

			expect(res.toString()).toBe([3201, 1604, 3196].toString())
		})
	})

	describe(`CellX tests [${name}]`, () => {
		test('CellX benchmark', () => {
			const expected = {
				10: [
					[3, 6, 2, -2],
					[2, 4, -2, -3],
				],
				20: [
					[2, 4, -1, -6],
					[-2, 1, -4, -4],
				],
				50: [
					[-2, -4, 1, 6],
					[2, -1, 4, 4],
				],
			}

			const cellx = (framework: ReactiveFramework, layers: number) => {
				const start = {
					prop1: framework.signal(1),
					prop2: framework.signal(2),
					prop3: framework.signal(3),
					prop4: framework.signal(4),
				}
				let layer: Record<string, Computed<number>> = start

				for (let i = layers; i > 0; i--) {
					const m = layer
					const s = {
						prop1: framework.computed(() => m.prop2.read()),
						prop2: framework.computed(
							() => m.prop1.read() - m.prop3.read(),
						),
						prop3: framework.computed(
							() => m.prop2.read() + m.prop4.read(),
						),
						prop4: framework.computed(() => m.prop3.read()),
					}

					framework.effect(() => {
						s.prop1.read()
					})
					framework.effect(() => {
						s.prop2.read()
					})
					framework.effect(() => {
						s.prop3.read()
					})
					framework.effect(() => {
						s.prop4.read()
					})
					framework.effect(() => {
						s.prop1.read()
					})
					framework.effect(() => {
						s.prop2.read()
					})
					framework.effect(() => {
						s.prop3.read()
					})
					framework.effect(() => {
						s.prop4.read()
					})

					s.prop1.read()
					s.prop2.read()
					s.prop3.read()
					s.prop4.read()

					layer = s
				}

				const end = layer

				const before = [
					end.prop1.read(),
					end.prop2.read(),
					end.prop3.read(),
					end.prop4.read(),
				]

				framework.withBatch(() => {
					start.prop1.write(4)
					start.prop2.write(3)
					start.prop3.write(2)
					start.prop4.write(1)
				})

				const after = [
					end.prop1.read(),
					end.prop2.read(),
					end.prop3.read(),
					end.prop4.read(),
				]

				return [before, after]
			}

			for (const layers in expected) {
				// @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
				const [before, after] = cellx(framework, layers)
				// @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
				const [expectedBefore, expectedAfter] = expected[layers]
				expect(before.toString()).toBe(expectedBefore.toString())
				expect(after.toString()).toBe(expectedAfter.toString())
			}
		})
	})
}
