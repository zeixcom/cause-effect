/**
 * @name Cause & Effect
 * @version 0.12.3
 * @author Esther Brunner
 */
export {
	type Signal, type MaybeSignal, type InferMaybeSignalType,
	type ComputedCallbacks, type EffectCallbacks,
	UNSET, isSignal, toSignal
} from './lib/signal'

export { type State, state, isState } from './lib/state'
export { type Computed, computed, isComputed } from './lib/computed'
export { effect } from './lib/effect'
export { type EnqueueDedupe, batch, watch, enqueue } from './lib/scheduler'