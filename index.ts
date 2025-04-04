/**
 * @name Cause & Effect
 * @version 0.13.1
 * @author Esther Brunner
 */
export { CircularDependencyError } from './lib/util'
export {
	type Signal, type MaybeSignal, type ComputedCallback,
	UNSET, isSignal, isComputedCallback, toSignal
} from './lib/signal'

export { type State, state, isState } from './lib/state'
export { type Computed, type ComputedMatcher, computed, isComputed } from './lib/computed'
export { type EffectMatcher, type TapMatcher, effect } from './lib/effect'
export { type EnqueueDedupe, batch, watch, enqueue } from './lib/scheduler'