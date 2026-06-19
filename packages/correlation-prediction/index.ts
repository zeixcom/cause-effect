/**
 * @name Correlation & Prediction
 * @version 0.1.0
 * @author Esther Brunner
 *
 * Lightweight reactive ML primitives built on @zeix/cause-effect.
 * Distinct from cause-effect's deterministic signal graph: these signals model
 * weighted connections, forward propagation, and backpropagation for educational
 * ML experimentation.
 */

export {
	createNeuron,
	isNeuron,
	type Neuron,
	type NeuronInput,
	type NeuronOptions,
} from './src/neuron'
export { createLayer, isLayer, type Layer, type LayerOptions } from './src/layer'
