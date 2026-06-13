import { type Cleanup, type Signal } from '../graph';
/**
 * Activation function type.
 */
type ActivationFunction = (x: number) => number;
/**
 * Initialization strategy for weights and biases.
 */
type InitializationStrategy = 'random' | 'zeros' | 'xavier';
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
    activation?: ActivationFunction | 'sigmoid' | 'relu' | 'tanh' | 'linear';
    /**
     * Initialization strategy for weights and bias.
     * @default 'random'
     */
    init?: InitializationStrategy;
    /**
     * Learning rate for backpropagation.
     * @default 0.1
     */
    learningRate?: number;
    /**
     * Optional equality function to determine if a new value is different from the old value.
     * @default reference equality (===)
     */
    equals?: (a: number, b: number) => boolean;
    /**
     * Optional callback invoked when the Neuron is first watched by an effect.
     * Receives an `invalidate` function to mark the Neuron dirty and trigger recomputation.
     */
    watched?: (invalidate: () => void) => Cleanup;
};
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
    readonly [Symbol.toStringTag]: 'Neuron';
    /**
     * Gets the current value of the Neuron.
     * Recomputes if dependencies have changed since last access.
     * @returns The computed value (weighted sum + activation).
     */
    get(): number;
    /**
     * Trains the Neuron by adjusting weights via backpropagation.
     * @param target - The target value for training.
     */
    train(target: number): void;
};
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
declare function createNeuron(inputs: Signal<number>[], options?: NeuronOptions): Neuron;
/**
 * Checks if a value is a Neuron signal.
 *
 * @param value - The value to check.
 * @returns True if the value is a Neuron.
 */
declare function isNeuron(value: unknown): value is Neuron;
export { createNeuron, isNeuron, type Neuron };
