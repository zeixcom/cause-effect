import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createState,
	InvalidSignalValueError,
} from '@zeix/cause-effect'
import { createLayer, isLayer } from '../src/layer'
import { isNeuron } from '../src/neuron'

describe('Layer', () => {
	test('createLayer > should produce an output vector of length = size', () => {
		const input = createState<number[]>([0.5, 0.3])
		const layer = createLayer(input, { size: 3 })
		expect(isLayer(layer)).toBeTrue()
		expect(layer.get()).toHaveLength(3)
	})

	test('Layer > zeros init yields sigmoid(0) = 0.5 for every neuron', () => {
		const input = createState<number[]>([0.5, 0.3])
		const layer = createLayer(input, {
			size: 4,
			activation: 'sigmoid',
			initialization: 'zeros',
		})
		expect(layer.get().every(v => Math.abs(v - 0.5) < 1e-9)).toBeTrue()
	})

	test('Layer > getNeurons returns the composed Neurons', () => {
		const input = createState<number[]>([0.5])
		const layer = createLayer(input, { size: 2 })
		const neurons = layer.getNeurons()
		expect(neurons).toHaveLength(2)
		expect(neurons.every(isNeuron)).toBeTrue()
	})

	test('Layer > output recomputes when input changes (random init)', () => {
		const input = createState<number[]>([0.5, 0.3])
		const layer = createLayer(input, {
			size: 3,
			initialization: 'random',
		})
		const before = [...layer.get()]
		input.set([0.9, 0.1])
		const after = layer.get()
		expect(before.some((v, i) => v !== after[i])).toBeTrue()
	})

	test('Layer > downstream memos react to layer output changes', () => {
		const input = createState<number[]>([0.5, 0.3])
		const layer = createLayer(input, { size: 3, initialization: 'random' })
		const sum = createMemo(() => layer.get().reduce((a, b) => a + b, 0))
		const s0 = sum.get()
		input.set([0.9, 0.1])
		expect(sum.get()).not.toBe(s0)
	})

	test('Layer > train(targets[]) applies per-neuron targets', () => {
		const input = createState<number[]>([0.5, 0.3])
		const layer = createLayer(input, {
			size: 2,
			activation: 'sigmoid',
			initialization: 'zeros',
			learningRate: 0.5,
		})
		const before = [...layer.get()]
		layer.train([1, 0])
		const after = layer.get()
		// first neuron pulled toward 1 (up from 0.5), second toward 0 (down)
		// biome-ignore lint/style/noNonNullAssertion: test
		expect(after[0]).toBeGreaterThan(before[0]!)
		// biome-ignore lint/style/noNonNullAssertion: test
		expect(after[1]).toBeLessThan(before[1]!)
	})

	test('Layer > setWeights propagates to output', () => {
		const input = createState<number[]>([1])
		const layer = createLayer(input, { size: 1, initialization: 'zeros' })
		expect(layer.get()[0]).toBe(0.5) // sigmoid(0)
		layer.setWeights([[1, 0]]) // one neuron: weights[1] + bias[0]
		expect(layer.get()[0]).not.toBe(0.5)
	})

	test('Layer > should react inside createEffect', () => {
		const input = createState<number[]>([0.5])
		const layer = createLayer(input, { size: 2, initialization: 'random' })
		let runs = 0
		createEffect(() => {
			layer.get()
			runs++
		})
		expect(runs).toBe(1)
		input.set([0.9])
		expect(runs).toBe(2)
	})

	test('Layer > validation: input must be a signal', () => {
		expect(() =>
			// @ts-expect-error deliberately invalid
			createLayer(null, { size: 1 }),
		).toThrow(TypeError)
	})

	test('Layer > validation: size must be positive', () => {
		const input = createState<number[]>([0.5])
		expect(() => createLayer(input, { size: 0 })).toThrow(TypeError)
	})

	test('Layer > validation: train targets length must match size', () => {
		const input = createState<number[]>([0.5])
		const layer = createLayer(input, { size: 2 })
		expect(() => layer.train([1])).toThrow(InvalidSignalValueError)
	})

	test('Layer > validation: train targets must be numeric', () => {
		const input = createState<number[]>([0.5])
		const layer = createLayer(input, { size: 2 })
		expect(() => layer.train([1, NaN])).toThrow(InvalidSignalValueError)
	})
})
