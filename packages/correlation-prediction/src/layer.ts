import {
	InvalidSignalValueError,
	batch,
	createMemo,
	type Signal,
} from '@zeix/cause-effect'
import {
	createNeuron,
	type Neuron,
	type NeuronInput,
	type NeuronOptions,
} from './neuron'

/* === Types === */

/**
 * Options for creating a Layer.
 */
type LayerOptions = {
	/**
	 * Number of Neurons in the Layer.
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

	/**
	 * Learning rate for backpropagation.
	 * @default 0.1
	 */
	learningRate?: number

	/**
	 * Optional equality function for the Layer output vector.
	 * @default reference equality (===)
	 */
	equals?: (a: number[], b: number[]) => boolean
}

/**
 * A Layer signal: a vector of Neurons sharing a dense input signal.
 *
 * Forward propagation is a memo over the input signal and each Neuron's output,
 * so the Layer recomputes through the normal graph path when any input or weight
 * changes. Backpropagation delegates to each Neuron's `train()`.
 */
type Layer = {
	readonly [Symbol.toStringTag]: 'Layer'

	/**
	 * Gets the current Layer output (one value per Neuron).
	 * @returns The output vector.
	 */
	get(): number[]

	/**
	 * Gets the Neurons that compose this Layer.
	 * @returns The array of Neurons.
	 */
	getNeurons(): Neuron[]

	/**
	 * Sets the weights for all Neurons in the Layer.
	 * @param weights - 2D array of weights (one array per Neuron).
	 */
	setWeights(weights: number[][]): void

	/**
	 * Trains the Layer toward a target output vector.
	 * Calls `train()` on each Neuron with the corresponding target, which performs
	 * backpropagation and recurses into upstream Neurons for multi-layer learning.
	 * @param targets - Target value per Neuron (length must match Layer size).
	 */
	train(targets: number[]): void
}

/**
 * Checks whether a value is a Layer signal.
 */
function isLayer(value: unknown): value is Layer {
	return (
		value !== null &&
		typeof value === 'object' &&
		(value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] ===
			'Layer'
	)
}

/* === Factory === */

/**
 * Creates a Layer signal: a vector of Neurons that share a dense input signal.
 *
 * Each Neuron reads the input vector indexed by its position, so all Neurons share
 * the same input but learn independent weights. The Layer's output is a memo over
 * its Neurons, recomputed automatically through the cause-effect graph.
 *
 * @param inputSignal - A signal providing the dense input vector.
 * @param options - Configuration including `size` (required), activation, and init.
 * @returns A Layer signal.
 *
 * @example
 * ```ts
 * const input = createState<number[]>([0.5, 0.3])
 * const layer = createLayer(input, { size: 3, activation: 'sigmoid' })
 * console.log(layer.get()) // [n0, n1, n2]
 * layer.train([1, 0, 0.5])
 * ```
 */
function createLayer(inputSignal: Signal<number[]>, options: LayerOptions): Layer {
	if (
		!inputSignal ||
		typeof (inputSignal as Signal<number[]>).get !== 'function'
	) {
		throw new TypeError('[Layer] Input must be a Signal<number[]>')
	}
	if (typeof options?.size !== 'number' || options.size <= 0) {
		throw new TypeError('[Layer] Size must be a positive number')
	}

	const { size, activation, initialization, learningRate, equals } = options

	// Build neuron options, omitting undefined so exactOptionalPropertyTypes holds.
	const neuronOptions: NeuronOptions = {}
	if (activation !== undefined) neuronOptions.activation = activation
	if (initialization !== undefined) neuronOptions.init = initialization
	if (learningRate !== undefined) neuronOptions.learningRate = learningRate

	// Each Neuron reads the shared input vector indexed by its position.
	const neurons: Neuron[] = []
	for (let i = 0; i < size; i++) {
		neurons.push(
			createNeuron([inputSignal as unknown as NeuronInput], neuronOptions),
		)
	}

	// Layer output = memo over each Neuron. No manual flags or propagation.
	const memoOptions: { equals?: (a: number[], b: number[]) => boolean } = {}
	if (equals !== undefined) memoOptions.equals = equals
	const output = createMemo<number[]>(() => neurons.map(n => n.get()), memoOptions)

	return {
		[Symbol.toStringTag]: 'Layer',
		get: () => output.get(),
		getNeurons: () => [...neurons],
		setWeights(weights: number[][]) {
			if (!Array.isArray(weights) || weights.length !== neurons.length) {
				throw new TypeError(
					'[Layer] Weights must be a 2D array matching Layer size',
				)
			}
			for (let i = 0; i < neurons.length; i++) {
				neurons[i]!.setWeights(weights[i]!)
			}
		},
		train(targets: number[]) {
			if (
				!Array.isArray(targets) ||
				targets.length !== neurons.length ||
				!targets.every(t => typeof t === 'number' && !Number.isNaN(t))
			) {
				throw new InvalidSignalValueError('Layer', targets)
			}
			// Batch the per-Neuron training so the Layer memo recomputes once.
			batch(() => {
				for (let i = 0; i < neurons.length; i++) {
					neurons[i]!.train(targets[i]!)
				}
			})
		},
	}
}

export { createLayer, isLayer, type Layer, type LayerOptions }
