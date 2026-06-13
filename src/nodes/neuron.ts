import {
	CircularDependencyError,
	InvalidSignalValueError,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batchDepth,
	type Cleanup,
	type Edge,
	FLAG_DIRTY,
	flush,
	type MemoNode,
	makeSubscribe,
	propagate,
	refresh,
	type Signal,
	type SinkNode,
	TYPE_MEMO,
	TYPE_STATE,
} from '../graph'
import { isSignalOfType } from '../util'

/* === Types === */

/**
 * Activation function type.
 */
type ActivationFunction = (x: number) => number

/**
 * Initialization strategy for weights and biases.
 */
type InitializationStrategy = 'random' | 'zeros' | 'xavier'

/**
 * Options for configuring a Neuron signal.
 *
 * @template T - The type of value computed by the Neuron (always `number`).
 */
type NeuronOptions = {
	/**
	 * Activation function to apply to the weighted sum.
	 * @default 'sigmoid'
	 */
	activation?: ActivationFunction | 'sigmoid' | 'relu' | 'tanh' | 'linear'

	/**
	 * Initialization strategy for weights and bias.
	 * @default 'random'
	 */
	init?: InitializationStrategy

	/**
	 * Learning rate for backpropagation.
	 * @default 0.1
	 */
	learningRate?: number

	/**
	 * Optional equality function to determine if a new value is different from the old value.
	 * @default reference equality (===)
	 */
	equals?: (a: number, b: number) => boolean

	/**
	 * Optional callback invoked when the Neuron is first watched by an effect.
	 * Receives an `invalidate` function to mark the Neuron dirty and trigger recomputation.
	 */
	watched?: (invalidate: () => void) => Cleanup
}

/**
 * A Neuron signal for lightweight ML experimentation.
 * Computes a weighted sum of its inputs and applies an activation function.
 *
 * @example
 * ```ts
 * const input1 = createState(0.5)
 * const input2 = createState(0.3)
 * const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })
 * console.log(neuron.get()) // Weighted sum + sigmoid activation
 * neuron.train(0.8) // Adjust weights via backpropagation
 * ```
 */
type Neuron = {
	readonly [Symbol.toStringTag]: 'Neuron'

	/**
	 * Gets the current value of the Neuron.
	 * Recomputes if dependencies have changed since last access.
	 * @returns The computed value (weighted sum + activation).
	 */
	get(): number

	/**
	 * Trains the Neuron by adjusting weights via backpropagation.
	 * @param target - The target value for training.
	 */
	train(target: number): void
}

/**
 * Internal node type for Neuron signals.
 */
type NeuronNode = MemoNode<number> & {
	weights: number[]
	bias: number
	activation: ActivationFunction
	learningRate: number
	inputs: Signal<number>[]
	reverseEdges: Edge[] // Reverse edges for backpropagation
	target?: number // Target value for training
}

/* === Activation Functions === */

const sigmoid: ActivationFunction = x => 1 / (1 + Math.exp(-x))
const relu: ActivationFunction = x => Math.max(0, x)
const tanh: ActivationFunction = x => Math.tanh(x)
const linear: ActivationFunction = x => x

/**
 * Gets the activation function from options.
 */
function getActivationFn(
	activation:
		| ActivationFunction
		| 'sigmoid'
		| 'relu'
		| 'tanh'
		| 'linear' = 'sigmoid',
): ActivationFunction {
	if (typeof activation === 'function') return activation
	switch (activation) {
		case 'sigmoid':
			return sigmoid
		case 'relu':
			return relu
		case 'tanh':
			return tanh
		case 'linear':
			return linear
		default:
			return sigmoid
	}
}

/* === Initialization Strategies === */

/**
 * Initializes weights and bias based on the strategy.
 */
function initializeWeights(
	inputCount: number,
	strategy: InitializationStrategy = 'random',
): { weights: number[]; bias: number } {
	switch (strategy) {
		case 'zeros':
			return { weights: Array(inputCount).fill(0), bias: 0 }
		case 'xavier': {
			const scale = Math.sqrt(2 / (inputCount + 1))
			return {
				weights: Array.from(
					{ length: inputCount },
					() => (Math.random() * 2 - 1) * scale,
				),
				bias: (Math.random() * 2 - 1) * scale,
			}
		}
		default:
			return {
				weights: Array.from(
					{ length: inputCount },
					() => Math.random() * 2 - 1,
				),
				bias: Math.random() * 2 - 1,
			}
	}
}

/* === Forward Propagation === */

/**
 * Computes the weighted sum of inputs and applies the activation function.
 */
function forward(node: NeuronNode): number {
	let sum = node.bias
	for (let i = 0; i < node.inputs.length; i++) {
		sum += node.inputs[i]!.get() * node.weights[i]!
	}
	return node.activation(sum)
}

/* === Backpropagation === */

/**
 * Computes the derivative of the activation function.
 */
function getActivationDerivative(
	activation: ActivationFunction,
	output: number,
): number {
	if (activation === sigmoid) {
		return output * (1 - output)
	} else if (activation === relu) {
		return output > 0 ? 1 : 0
	} else if (activation === tanh) {
		return 1 - output * output
	} else {
		// Linear
		return 1
	}
}

/**
 * Adjusts weights and bias via backpropagation using Mean Squared Error (MSE).
 */
function backpropagate(node: NeuronNode, target: number): void {
	node.target = target
	const output = node.value
	const error = target - output
	const derivative = getActivationDerivative(node.activation, output)
	const delta = error * derivative

	// Update weights and bias
	for (let i = 0; i < node.inputs.length; i++) {
		node.weights[i]! += node.learningRate * delta * node.inputs[i]!.get()
	}
	node.bias += node.learningRate * delta

	// Propagate error backward via reverse edges
	for (const edge of node.reverseEdges) {
		const source = edge.source as NeuronNode
		if (source && 'target' in source) {
			// Reverse edges are not yet implemented for multi-layer networks.
			// This will be addressed in a future update.
		}
	}
}

/* === Exported Functions === */

/**
 * Creates a Neuron signal for lightweight ML experimentation.
 * Computes a weighted sum of its inputs and applies an activation function.
 *
 * @param inputs - Array of input signals (must be `Signal<number>`).
 * @param options - Optional configuration for the Neuron.
 * @param options.activation - Activation function (`sigmoid`, `relu`, `tanh`, `linear`, or custom function).
 * @param options.init - Initialization strategy (`random`, `zeros`, `xavier`).
 * @param options.learningRate - Learning rate for backpropagation.
 * @param options.equals - Optional equality function.
 * @param options.guard - Optional type guard.
 * @param options.watched - Optional callback invoked when the Neuron is first watched.
 * @returns A Neuron signal with `get()` and `train()` methods.
 *
 * @example
 * ```ts
 * const input1 = createState(0.5)
 * const input2 = createState(0.3)
 * const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })
 * console.log(neuron.get()) // Weighted sum + sigmoid activation
 * neuron.train(0.8) // Adjust weights via backpropagation
 * ```
 */
function createNeuron(
	inputs: Signal<number>[],
	options: NeuronOptions = {},
): Neuron {
	// Validate inputs
	if (!Array.isArray(inputs) || inputs.length === 0) {
		throw new Error(
			'[Neuron] Inputs must be a non-empty array of Signal<number>',
		)
	}
	for (const input of inputs) {
		if (
			!isSignalOfType(input, TYPE_MEMO) &&
			!isSignalOfType(input, TYPE_STATE)
		) {
			throw new Error(
				'[Neuron] Inputs must be Signal<number> (Memo or State)',
			)
		}
		// Validate numeric value
		const value = input.get()
		if (typeof value !== 'number' || Number.isNaN(value)) {
			throw new InvalidSignalValueError('Neuron', value)
		}
	}

	// Detect circular dependencies
	if (activeSink !== null) {
		for (const input of inputs) {
			// @ts-expect-error
			if (input === activeSink) {
				throw new CircularDependencyError('Neuron')
			}
		}
	}

	// Initialize weights and bias
	const { weights, bias } = initializeWeights(inputs.length, options.init)
	const activation = getActivationFn(options.activation)
	const learningRate = options.learningRate ?? 0.1

	// Create the node
	const node: NeuronNode = {
		fn: () => forward(node),
		value: 0,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: options.equals ?? ((a, b) => a === b),
		error: undefined,
		stop: undefined,
		weights,
		bias,
		activation,
		learningRate,
		inputs,
		reverseEdges: [], // Initialize reverse edges
	}

	// Subscribe to dependencies
	const watched = options.watched
	const subscribe = makeSubscribe(
		node,
		watched
			? () =>
					watched(() => {
						propagate(node as unknown as SinkNode)
						if (batchDepth === 0) flush()
					})
			: undefined,
	)

	return {
		[Symbol.toStringTag]: 'Neuron',
		get() {
			subscribe()
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
			validateReadValue('Neuron', node.value)
			return node.value
		},
		train(target: number) {
			validateSignalValue('Neuron', target)
			backpropagate(node, target)
			// Mark as dirty to recompute on next `.get()`
			node.flags = FLAG_DIRTY
			propagate(node as unknown as SinkNode)
			if (batchDepth === 0) flush()
		},
	}
}

/**
 * Checks if a value is a Neuron signal.
 *
 * @param value - The value to check.
 * @returns True if the value is a Neuron.
 */
function isNeuron(value: unknown): value is Neuron {
	return isSignalOfType(value, 'Neuron')
}

export { createNeuron, isNeuron, type Neuron }
