import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createState,
	InvalidSignalValueError,
} from '../index'
import { createNeuron, isNeuron } from '../src/nodes/neuron'

describe('Neuron', () => {
	test('createNeuron > should create a Neuron with initial weights and bias', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		expect(isNeuron(neuron)).toBeTrue()
		expect(neuron.get()).toBeNumber()
	})

	test('createNeuron > should have Symbol.toStringTag of "Neuron"', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2])

		expect(neuron[Symbol.toStringTag]).toBe('Neuron')
	})

	test('isNeuron > should identify Neuron signals', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2])

		expect(isNeuron(neuron)).toBeTrue()
		expect(isNeuron(input1)).toBeFalse()
		expect(isNeuron(createMemo(() => 1))).toBeFalse()
	})

	test('Neuron > should compute weighted sum and apply activation', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		const output = neuron.get()
		expect(output).toBeNumber()
		expect(output).toBeGreaterThanOrEqual(0)
		expect(output).toBeLessThanOrEqual(1)
	})

	test('Neuron > should recompute when inputs change', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		const initialOutput = neuron.get()
		input1.set(0.8)
		const updatedOutput = neuron.get()

		expect(updatedOutput).not.toBe(initialOutput)
	})

	test('Neuron > should support custom activation functions', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const reluNeuron = createNeuron([input1, input2], {
			activation: 'relu',
		})
		const linearNeuron = createNeuron([input1, input2], {
			activation: 'linear',
		})

		expect(reluNeuron.get()).toBeGreaterThanOrEqual(0)
		expect(linearNeuron.get()).toBeNumber()
	})

	test('Neuron > should support custom initialization strategies', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)

		const randomNeuron = createNeuron([input1, input2], { init: 'random' })
		const zerosNeuron = createNeuron([input1, input2], { init: 'zeros' })
		const xavierNeuron = createNeuron([input1, input2], { init: 'xavier' })

		expect(randomNeuron.get()).toBeNumber()
		expect(zerosNeuron.get()).toBe(0.5) // Bias is 0, so sigmoid(0) = 0.5
		expect(xavierNeuron.get()).toBeNumber()
	})

	test('Neuron > should support custom learning rate', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { learningRate: 0.5 })

		const initialOutput = neuron.get()
		neuron.train(0.8)
		const updatedOutput = neuron.get()

		expect(updatedOutput).not.toBe(initialOutput)
	})

	test('Neuron > should train via backpropagation', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		const initialOutput = neuron.get()
		neuron.train(0.8)
		const updatedOutput = neuron.get()

		expect(updatedOutput).toBeGreaterThan(initialOutput)
	})

	test('Neuron > should work with createEffect', () => {
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		let effectRunCount = 0
		let lastOutput: number | undefined

		createEffect(() => {
			effectRunCount++
			lastOutput = neuron.get()
		})

		expect(effectRunCount).toBe(1)
		expect(lastOutput).toBeNumber()

		const initialOutput = lastOutput
		input1.set(0.8)
		expect(effectRunCount).toBe(2)
		expect(lastOutput).not.toBe(initialOutput)
	})

	test('Neuron > should throw for invalid inputs', () => {
		expect(() => createNeuron([])).toThrow()
		// @ts-expect-error deliberately passing an invalid input
		expect(() => createNeuron([createState(0.5), {}])).toThrow()
		expect(() => createNeuron([createState(NaN)])).toThrow(
			InvalidSignalValueError,
		)
	})

	test('Neuron > should throw for NaN inputs', () => {
		expect(() => createNeuron([createState(NaN)])).toThrow(
			InvalidSignalValueError,
		)
	})

	test('Neuron > should support Memo inputs', () => {
		const input1 = createState(0.5)
		const input2 = createMemo(() => input1.get() * 2)
		const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

		expect(neuron.get()).toBeNumber()
	})

	test('Neuron > Single-Neuron Training > should update weights via backpropagation', () => {
		// Verify that weights are updated during training
		const input1 = createState(0.5)
		const input2 = createState(0.3)
		const neuron = createNeuron([input1, input2], {
			activation: 'sigmoid',
			init: 'zeros', // Start with zeros to observe changes
			learningRate: 0.1,
		})

		// Get initial weights and bias
		const initialWeights = neuron.get() // Not directly accessible, but we can observe output
		neuron.train(1)
		const updatedWeights = neuron.get()

		// Verify that the output changed after training
		expect(updatedWeights).not.toBe(initialWeights)
	})
})
