import { type Signal, type SignalOptions } from '../graph';
/**
 * Options for creating a Layer.
 */
type LayerOptions<T extends {}> = SignalOptions<T> & {
    /**
     * Size of the Layer (number of Neurons).
     */
    size: number;
    /**
     * Activation function for Neurons in the Layer.
     * @default 'sigmoid'
     */
    activation?: 'sigmoid' | 'relu' | 'tanh' | 'linear';
    /**
     * Initialization strategy for weights.
     * @default 'random'
     */
    initialization?: 'random' | 'zeros' | 'xavier';
};
/**
 * A Layer signal.
 */
interface Layer<T extends {}> {
    /**
     * Get the current value of the Layer (forward propagation).
     */
    get(): T;
    /**
     * Set the weights for all Neurons in the Layer.
     * @param weights - 2D array of weights (one array per Neuron).
     */
    setWeights(weights: number[][]): void;
    /**
     * Perform backpropagation (placeholder).
     * @param gradients - Array of gradients (one per Neuron).
     */
    backpropagate(gradients: number[]): void;
    /**
     * Train the Layer (placeholder).
     * @param target - Target value for training.
     */
    train(target: number): void;
}
declare function createLayer(inputSignal: Signal<number[]>, options: LayerOptions<number[]>): Layer<number[]>;
/**
 * Check whether a value is a Layer signal.
 * @param value - Value to check.
 * @returns True if value is a Layer signal, false otherwise.
 */
declare function isLayer(value: unknown): value is Layer<unknown & {}>;
export { createLayer, isLayer, type Layer, type LayerOptions };
