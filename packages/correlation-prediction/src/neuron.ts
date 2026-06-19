import {
	InvalidSignalValueError,
	batch,
	createMemo,
	createState,
	type Signal,
} from '@zeix/cause-effect'

/* === Types === */

/**
 * Activation function type.
 */
type ActivationFunction = (x: number) => number

/**
 * Initialization strategy for weights and bias.
 */
type InitializationStrategy = 'random' | 'zeros' | 'xavier'

/**
 * Options for configuring a Neuron signal.
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
	 * Optional equality function to determine if a new output differs from the old.
	 * @default reference equality (===)
	 */
	equals?: (a: number, b: number) => boolean
}

/**
 * A Neuron signal for lightweight ML experimentation.
 * Computes a weighted sum of its inputs and applies an activation function.
 *
 * Forward propagation is a memo over the input signals and a weights state signal,
 * so the reactive graph invalidates the output automatically whenever an input or
 * the weights change. `train(target)` updates the weights inside `batch()`.
 *
 * @example
 * ```ts
 * const input1 = createState(0.5)
 * const input2 = createState(0.3)
 * const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })
 * console.log(neuron.get()) // weighted sum + sigmoid activation
 * neuron.train(0.8) // adjust weights via backpropagation
 * ```
 */
type Neuron = {
	readonly [Symbol.toStringTag]: 'Neuron'

	/**
	 * Gets the current output of the Neuron.
	 * Recomputes if inputs or weights have changed since last access.
	 * @returns The computed output (weighted sum + activation).
	 */
	get(): number

	/**
	 * Gets a copy of the current weights (weights then bias, length = inputs + 1).
	 * @returns The weights array.
	 */
	getWeights(): number[]

	/**
	 * Replaces the weights (weights then bias, length = inputs + 1).
	 * @param weights - The new weights array.
	 */
	setWeights(weights: number[]): void

	/**
	 * Adjusts weights via backpropagation toward the target output.
	 * Propagates the error backward to any Neuron inputs by calling their `train()`,
	 * which is how multi-layer networks learn without reverse graph edges.
	 * @param target - The target output value for training.
	 */
	train(target: number): void
}

/**
 * An input to a Neuron: a scalar signal, a vector signal (indexed by the
 * Neuron's position within a Layer), or another Neuron for chaining.
 */
type NeuronInput = Signal<number> | Signal<number[]> | Neuron

/* === Activation Functions === */

const sigmoid: ActivationFunction = x => 1 / (1 + Math.exp(-x))
const relu: ActivationFunction = x => Math.max(0, x)
const tanh: ActivationFunction = x => Math.tanh(x)
const linear: ActivationFunction = x => x

const ACTIVATIONS = {
	sigmoid,
	relu,
	tanh,
	linear,
} as const

/**
 * Resolves an activation function from a name or a function.
 */
function getActivationFn(
	activation: ActivationFunction | 'sigmoid' | 'relu' | 'tanh' | 'linear',
): ActivationFunction {
	return typeof activation === 'function'
		? activation
		: ACTIVATIONS[activation] ?? sigmoid
}

/**
 * Computes the derivative of the activation function given the current output.
 */
function getActivationDerivative(
	activation: ActivationFunction,
	output: number,
): number {
	if (activation === sigmoid) return output * (1 - output)
	if (activation === relu) return output > 0 ? 1 : 0
	if (activation === tanh) return 1 - output * output
	return 1 // linear
}

/* === Initialization Strategies === */

/**
 * Initializes weights and bias based on the strategy.
 * Returns a flat array: weights followed by the bias (length = inputCount + 1).
 */
function initializeWeights(
	inputCount: number,
	strategy: InitializationStrategy,
): number[] {
	switch (strategy) {
		case 'zeros':
			return new Array(inputCount + 1).fill(0)
		case 'xavier': {
			const scale = Math.sqrt(2 / (inputCount + 1))
			const w = Array.from(
				{ length: inputCount + 1 },
				() => (Math.random() * 2 - 1) * scale,
			)
			return w
		}
		default:
			return Array.from(
				{ length: inputCount + 1 },
				() => Math.random() * 2 - 1,
			)
	}
}

/* === Internal Helpers === */

/**
 * Reads the scalar value of an input at the given index and validates it is numeric.
 * `Signal<number[]>` inputs are indexed by the Neuron's position (used by `createLayer`);
 * `Signal<number>` and `Neuron` inputs are read directly.
 *
 * Numeric validation lives here (not in the factory) so that unset Sensor/Task inputs
 * can be passed at construction time — they throw `UnsetSignalValueError` only when the
 * neuron is actually computed, and non-numeric resolved values are rejected at read time.
 */
function inputValueAt(input: NeuronInput, index: number): number {
	const value = input.get()
	const scalar = Array.isArray(value) ? (value[index] as number) : value
	if (typeof scalar !== 'number' || Number.isNaN(scalar)) {
		throw new InvalidSignalValueError('Neuron', scalar)
	}
	return scalar
}

/**
 * Checks if a value is a Neuron signal.
 */
function isNeuron(value: unknown): value is Neuron {
	return (
		value !== null &&
		typeof value === 'object' &&
		(value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] ===
			'Neuron'
	)
}

/* === Exported Functions === */

/**
 * Creates a Neuron signal for lightweight ML experimentation.
 *
 * The output is a memo over the input signals plus an internal weights state, so it
 * recomputes automatically when any input or the weights change. `train(target)`
 * performs backpropagation (MSE) by updating the weights inside `batch()`, then
 * recurses into any Neuron inputs to propagate the error backward.
 *
 * @param inputs - Non-empty array of `Signal<number>`, `Signal<number[]>`, or `Neuron`.
 * @param options - Optional configuration.
 * @returns A Neuron signal.
 *
 * @example
 * ```ts
 * const input1 = createState(0.5)
 * const input2 = createState(0.3)
 * const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })
 * console.log(neuron.get()) // weighted sum + sigmoid activation
 * neuron.train(0.8)
 * ```
 */
function createNeuron(
	inputs: NeuronInput[],
	options: NeuronOptions = {},
): Neuron {
	if (!Array.isArray(inputs) || inputs.length === 0) {
		throw new Error(
			'[Neuron] Inputs must be a non-empty array of Signal<number>',
		)
	}
	// Validate shape only — do NOT call input.get() here. Unset Sensor/Task inputs
	// have no value yet and would throw UnsetSignalValueError at construction time.
	// Numeric validation happens in the forward pass (forward()), which reads each
	// input via .get() and validates the resolved value.
	for (const input of inputs) {
		if (
			input === null ||
			typeof input !== 'object' ||
			typeof (input as Signal<unknown>).get !== 'function'
		) {
			throw new InvalidSignalValueError('Neuron', input)
		}
	}

	const activation = getActivationFn(options.activation ?? 'sigmoid')
	const learningRate = options.learningRate ?? 0.1
	const equals = options.equals ?? ((a, b) => a === b)

	// Weights as a reactive state: weights[i] for each input, plus a trailing bias.
	// Stored in a single state so train() can update atomically and the memo
	// (which reads this state) invalidates through the normal graph path.
	const weightsState = createState<number[]>(
		initializeWeights(inputs.length, options.init ?? 'random'),
	)

	// Forward propagation = a memo over inputs + weights. No manual flags or flush.
	const output = createMemo<number>(
		() => {
			const w = weightsState.get()
			let sum = w[inputs.length] as number // bias
			for (let i = 0; i < inputs.length; i++) {
				sum += inputValueAt(inputs[i] as NeuronInput, i) * (w[i] as number)
			}
			return activation(sum)
		},
		{ equals },
	)

	return {
		[Symbol.toStringTag]: 'Neuron',
		get: () => output.get(),
		getWeights: () => [...weightsState.get()],
		setWeights(weights: number[]) {
			if (!Array.isArray(weights) || weights.length !== inputs.length + 1) {
				throw new InvalidSignalValueError('Neuron', weights)
			}
			weightsState.set([...weights])
		},
		train(target: number) {
			if (typeof target !== 'number' || Number.isNaN(target)) {
				throw new InvalidSignalValueError('Neuron', target)
			}
			const w = weightsState.get()
			const out = output.get()
			const error = target - out
			const derivative = getActivationDerivative(activation, out)
			const delta = error * derivative

			// New weights: gradient descent step.
			const next = new Array<number>(inputs.length + 1)
			for (let i = 0; i < inputs.length; i++) {
				next[i] =
					(w[i] as number) + learningRate * delta * inputValueAt(inputs[i] as NeuronInput, i)
			}
			next[inputs.length] = (w[inputs.length] as number) + learningRate * delta

			// Update weights in a batch so the memo recomputes once.
			batch(() => weightsState.set(next))

			// Propagate error backward to Neuron inputs via recursive train().
			// input.train() applies the input's own activation derivative, so the
			// delta passed here must not be pre-multiplied by it again.
			for (let i = 0; i < inputs.length; i++) {
				const input = inputs[i] as NeuronInput
				if (isNeuron(input)) {
					const propagated = delta * (w[i] as number)
					input.train(input.get() + propagated)
				}
			}
		},
	}
}

export { createNeuron, isNeuron, type Neuron, type NeuronInput, type NeuronOptions }
