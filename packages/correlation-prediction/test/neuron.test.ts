import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createSensor,
	createState,
	InvalidSignalValueError,
	SKIP_EQUALITY,
} from '@zeix/cause-effect'
import { createNeuron, isNeuron } from '../src/neuron'

describe('Neuron', () => {
	test('createNeuron > should create a Neuron with a numeric output', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		expect(isNeuron(neuron)).toBeTrue()
		expect(neuron.get()).toBeNumber()
	})

	test('createNeuron > should have Symbol.toStringTag of "Neuron"', () => {
		const neuron = createNeuron([createState(0.5), createState(0.3)])
		expect(neuron[Symbol.toStringTag]).toBe('Neuron')
	})

	test('isNeuron > should identify Neuron signals', () => {
		const neuron = createNeuron([createState(0.5), createState(0.3)])
		expect(isNeuron(neuron)).toBeTrue()
		expect(isNeuron(createState(0.5))).toBeFalse()
		expect(isNeuron(createMemo(() => 1))).toBeFalse()
	})

	test('Neuron > should compute an activation-bounded output', () => {
		const neuron = createNeuron(
			[createState(0.5), createState(0.3)],
			{ activation: 'sigmoid' },
		)
		const output = neuron.get()
		expect(output).toBeGreaterThanOrEqual(0)
		expect(output).toBeLessThanOrEqual(1)
	})

	test('Neuron > should recompute when inputs change', () => {
		const input1 = createState(0.5)
		const neuron = createNeuron([input1, createState(0.3)])
		const initial = neuron.get()
		input1.set(0.8)
		expect(neuron.get()).not.toBe(initial)
	})

	test('Neuron > should support custom activation functions', () => {
		const reluNeuron = createNeuron([createState(0.5), createState(0.3)], {
			activation: 'relu',
		})
		const linearNeuron = createNeuron([createState(0.5), createState(0.3)], {
			activation: 'linear',
		})
		expect(reluNeuron.get()).toBeGreaterThanOrEqual(0)
		expect(linearNeuron.get()).toBeNumber()
	})

	test('Neuron > zeros init yields sigmoid(0) = 0.5', () => {
		const neuron = createNeuron([createState(0.5), createState(0.3)], {
			activation: 'sigmoid',
			init: 'zeros',
		})
		expect(neuron.get()).toBe(0.5)
	})

	test('Neuron > getWeights returns weights then bias (length = inputs + 1)', () => {
		const neuron = createNeuron([createState(0.5), createState(0.3)], {
			init: 'zeros',
		})
		expect(neuron.getWeights()).toEqual([0, 0, 0])
	})

	test('Neuron > getWeights returns a copy, not the internal array', () => {
		const neuron = createNeuron([createState(0.5)], { init: 'zeros' })
		const w = neuron.getWeights()
		w[0] = 999
		expect(neuron.getWeights()[0]).toBe(0) // internal unaffected
	})

	test('Neuron > setWeights updates the output through the graph', () => {
		const neuron = createNeuron([createState(1)], { init: 'zeros' })
		expect(neuron.get()).toBe(0.5) // sigmoid(0)
		neuron.setWeights([1, 0]) // weight 1, bias 0 => sigmoid(1*1 + 0)
		expect(neuron.get()).not.toBe(0.5)
	})

	test('Neuron > setWeights rejects wrong-length arrays', () => {
		const neuron = createNeuron([createState(1)], { init: 'zeros' })
		expect(() => neuron.setWeights([0])).toThrow(InvalidSignalValueError)
	})

	test('Neuron > should train via backpropagation toward the target', () => {
		const neuron = createNeuron([createState(0.5), createState(0.3)], {
			activation: 'sigmoid',
			init: 'zeros',
			learningRate: 0.5,
		})
		const initial = neuron.get()
		neuron.train(0.8) // target above current sigmoid(0)=0.5
		expect(neuron.get()).toBeGreaterThan(initial)
	})

	test('Neuron > should react inside createEffect', () => {
		const input1 = createState(0.5)
		const neuron = createNeuron([input1, createState(0.3)])
		let runs = 0
		let last: number | undefined
		createEffect(() => {
			runs++
			last = neuron.get()
		})
		expect(runs).toBe(1)
		const initial = last
		input1.set(0.8)
		expect(runs).toBe(2)
		expect(last).not.toBe(initial)
	})

	test('Neuron > should support Memo inputs', () => {
		const input1 = createState(0.5)
		const input2 = createMemo(() => input1.get() * 2)
		const neuron = createNeuron([input1, input2])
		expect(neuron.get()).toBeNumber()
	})

	test('Neuron > should throw for empty inputs', () => {
		expect(() => createNeuron([])).toThrow()
	})

	test('Neuron > should throw for non-numeric input values during get (CE-026)', () => {
		const neuron = createNeuron([createState(NaN as unknown as number)])
		expect(() => neuron.get()).toThrow(InvalidSignalValueError)
	})

	test('Neuron > should throw for NaN train target', () => {
		const neuron = createNeuron([createState(0.5)])
		expect(() => neuron.train(NaN)).toThrow(InvalidSignalValueError)
	})

	test('Neuron > equals controls downstream propagation (ADR 0017 OQ1)', () => {
		// With default === equality, a numerically-identical output suppresses
		// downstream effects even when weights changed. SKIP_EQUALITY forces
		// propagation. This documents the interaction flagged in ADR 0017.
		const input = createState(1)
		const suppressing = createNeuron([input], {
			activation: 'linear',
			init: 'zeros',
			equals: (a, b) => a === b,
		})
		let suppressingRuns = 0
		createEffect(() => {
			suppressing.get()
			suppressingRuns++
		})

		const forcing = createNeuron([input], {
			activation: 'linear',
			init: 'zeros',
			equals: SKIP_EQUALITY,
		})
		let forcingRuns = 0
		createEffect(() => {
			forcing.get()
			forcingRuns++
		})

		// Train toward 0 (current linear output is 0). Suppressing sees an equal
		// value and does not re-run; forcing always re-runs via SKIP_EQUALITY.
		suppressing.train(0)
		forcing.train(0)
		expect(suppressingRuns).toBe(1) // suppressed: value unchanged
		expect(forcingRuns).toBe(2) // forced: always propagates
	})

	test('Neuron > multi-layer XOR network trains via recursive train() (ADR 0017)', () => {
		// XOR requires a hidden layer. This validates that multi-layer
		// backpropagation works via recursive input.train() calls — no reverse
		// graph edges (CE-012 premise superseded by this test).
		//
		// Deterministic seed: the minimal 2-2-1 topology is fragile under random
		// init (hidden neurons receive near-identical gradients and learn
		// redundant features). A fixed LCG seed plus 3 hidden units breaks the
		// symmetry reliably and converges across all four XOR cases.
		let seed = 42
		const lcg = () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff
			return seed / 0x7fffffff
		}
		const originalRandom = Math.random
		Math.random = lcg

		try {
			const inputA = createState(0)
			const inputB = createState(0)

			const hidden = Array.from({ length: 3 }, () =>
				createNeuron([inputA, inputB], {
					activation: 'sigmoid',
					init: 'xavier',
					learningRate: 1.0,
				}),
			)
			const output = createNeuron(hidden, {
				activation: 'sigmoid',
				init: 'xavier',
				learningRate: 1.0,
			})

			const cases: Array<[number, number, number]> = [
				[0, 0, 0],
				[0, 1, 1],
				[1, 0, 1],
				[1, 1, 0],
			]
			for (let i = 0; i < 20000; i++) {
				// biome-ignore lint/style/noNonNullAssertion: test
				const [a, b, t] = cases[i % 4]!
				inputA.set(a)
				inputB.set(b)
				output.train(t)
			}

			for (const [a, b, t] of cases) {
				inputA.set(a)
				inputB.set(b)
				const out = output.get()
				expect(t === 0 ? out < 0.1 : out > 0.9).toBeTrue()
			}
		} finally {
			Math.random = originalRandom
		}
	})

	test('Neuron > can be constructed from unset Sensor input', () => {
		const unsetSensor = createSensor<number>(() => () => {})
		expect(() => createNeuron([unsetSensor])).not.toThrow()
	})

	test('Neuron > forward pass throws for unset Sensor input', () => {
		const unsetSensor = createSensor<number>(() => () => {})
		const neuron = createNeuron([unsetSensor])
		expect(() => neuron.get()).toThrow()
	})

	test('Neuron > forward pass validates non-numeric values', () => {
		const nonNumeric = createState('not a number')
		// @ts-expect-error deliberate invalid input
		const neuron = createNeuron([nonNumeric])
		expect(() => neuron.get()).toThrow(InvalidSignalValueError)
	})
})
