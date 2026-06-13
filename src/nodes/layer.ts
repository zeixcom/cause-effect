import { validateSignalValue } from '../errors'
import {
	activeSink,
	FLAG_CHECK,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RUNNING,
	link,
	type OptionsFields,
	propagate,
	type Signal,
	type SignalOptions,
	type SinkFields,
	type SourceFields,
	TYPE_LAYER,
	trimSources,
} from '../graph'
import { isSignalOfType } from '../util'
import { createNeuron, type Neuron } from './neuron'

/* === Types === */
/**
 * Options for creating a Layer.
 */
type LayerOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Size of the Layer (number of Neurons).
	 */
	size: number

	/**
	 * Activation function for Neurons in the Layer.
	 * @default 'sigmoid'
	 */
	activation?: 'sigmoid' | 'relu' | 'tanh' | 'linear'

	/**
	 * Initialization strategy for weights.
	 * @default 'random'
	 */
	initialization?: 'random' | 'zeros' | 'xavier'
}

/**
 * A Layer signal node.
 */
type LayerNode<T extends {}> = SourceFields<T> &
	OptionsFields<T> &
	SinkFields & {
		inputSignal: Signal<number[]>
		neurons: Neuron[]
		weights: number[][]
		gradients: number[][]
		error: Error | undefined
	}

/**
 * A Layer signal.
 */
interface Layer<T extends {}> {
	/**
	 * Get the current value of the Layer (forward propagation).
	 */
	get(): T

	/**
	 * Set the weights for all Neurons in the Layer.
	 * @param weights - 2D array of weights (one array per Neuron).
	 */
	setWeights(weights: number[][]): void

	/**
	 * Perform backpropagation (placeholder).
	 * @param gradients - Array of gradients (one per Neuron).
	 */
	backpropagate(gradients: number[]): void

	/**
	 * Train the Layer (placeholder).
	 * @param target - Target value for training.
	 */
	train(target: number): void
}

/* === Recomputation === */

function recomputeLayer(node: LayerNode<number[]>): void {
	node.flags = FLAG_RUNNING
	let changed = false
	try {
		// Read input from the dense input signal
		const inputs = node.inputSignal.get()
		if (
			!Array.isArray(inputs) ||
			!inputs.every(i => typeof i === 'number')
		) {
			throw new TypeError(
				`[${TYPE_LAYER}] Input must be an array of numbers`,
			)
		}

		// Compute outputs for all Neurons
		const outputs: number[] = []
		for (let i = 0; i < node.neurons.length; i++) {
			outputs.push(node.neurons[i]!.get())
		}

		const next = outputs
		validateSignalValue(TYPE_LAYER, next)

		if (node.error || !node.equals(next, node.value)) {
			node.value = next
			node.error = undefined
			changed = true
		}
	} catch (err: unknown) {
		changed = true
		node.error = err instanceof Error ? err : new Error(String(err))
	} finally {
		trimSources(node)
	}

	if (changed) {
		for (let e = node.sinks; e; e = e.nextSink) {
			if (e.sink.flags & FLAG_CHECK) e.sink.flags |= FLAG_DIRTY
		}
	}

	node.flags = FLAG_CLEAN
}

/* === Factory === */

function createLayer(
	inputSignal: Signal<number[]>,
	options: LayerOptions<number[]>,
): Layer<number[]> {
	if (!inputSignal || typeof inputSignal.get !== 'function') {
		throw new TypeError(`[${TYPE_LAYER}] Input must be a Signal<number[]>`)
	}

	const {
		size,
		activation = 'sigmoid',
		initialization = 'random',
		equals,
	} = options

	if (typeof size !== 'number' || size <= 0) {
		throw new TypeError(`[${TYPE_LAYER}] Size must be a positive number`)
	}

	// Initialize Neurons uniformly
	const neurons: Neuron[] = []
	for (let i = 0; i < size; i++) {
		neurons.push(
			createNeuron([inputSignal], {
				activation,
				initialization,
			}),
		)
	}

	// Initialize weights and gradients (one array per Neuron)
	const weights: number[][] = []
	const gradients: number[][] = []
	for (let i = 0; i < size; i++) {
		const neuronWeights = neurons[i]!.getWeights()
		weights.push([...neuronWeights])
		gradients.push(new Array(neuronWeights.length).fill(0))
	}

	const node: LayerNode<number[]> = {
		value: [],
		flags: FLAG_CHECK,
		sinks: null,
		equals: equals ?? Object.is,
		inputSignal,
		neurons,
		weights,
		gradients,
		error: undefined,
		sources: null,
		sourcesTail: null,
	}

	Object.defineProperty(node, Symbol.toStringTag, { value: TYPE_LAYER })

	return {
		get() {
			if (activeSink) link(node, activeSink)
			if (node.error) throw node.error
			if (node.flags & FLAG_CHECK) {
				if (node.flags & FLAG_DIRTY) recomputeLayer(node)
				node.flags = FLAG_CLEAN
			}
			return node.value
		},

		setWeights(weights: number[][]) {
			if (
				!Array.isArray(weights) ||
				!weights.every(
					w =>
						Array.isArray(w) && w.every(n => typeof n === 'number'),
				)
			) {
				throw new TypeError(
					`[${TYPE_LAYER}] Weights must be a 2D array of numbers`,
				)
			}
			if (weights.length !== node.neurons.length) {
				throw new TypeError(
					`[${TYPE_LAYER}] Weights length must match Layer size`,
				)
			}
			node.weights = weights
			node.gradients = weights.map(w => new Array(w.length).fill(0))
			// Update weights for all Neurons
			for (let i = 0; i < node.neurons.length; i++) {
				node.neurons[i].setWeights(weights[i])
			}
			propagate(node)
		},

		backpropagate(gradients: number[]) {
			if (
				!Array.isArray(gradients) ||
				!gradients.every(g => typeof g === 'number')
			) {
				throw new TypeError(
					`[${TYPE_LAYER}] Gradients must be an array of numbers`,
				)
			}
			if (gradients.length !== node.neurons.length) {
				throw new TypeError(
					`[${TYPE_LAYER}] Gradients length must match Layer size`,
				)
			}
			// Placeholder: Update gradients for all Neurons
			for (let i = 0; i < gradients.length; i++) {
				node.gradients[i] = node.gradients[i]!.map(
					(g, j) => g + gradients[i]! * node.weights[i]![j]!,
				)
			}
		},

		train(target: number) {
			// Placeholder: Compute gradients and update weights
			const outputs = node.value
			const gradients = outputs.map(output => output - target)
			this.backpropagate(gradients)
		},
	}
}

/**
 * Check whether a value is a Layer signal.
 * @param value - Value to check.
 * @returns True if value is a Layer signal, false otherwise.
 */
function isLayer(value: unknown): value is Layer<unknown & {}> {
	return isSignalOfType(value, TYPE_LAYER)
}

export { createLayer, isLayer, type Layer, type LayerOptions }
