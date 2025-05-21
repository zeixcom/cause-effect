/**
 * @name Cause & Effect
 * @version 0.13.2
 * @author Esther Brunner
 */
export { CircularDependencyError } from './src/util'
export {
	type Signal,
	type MaybeSignal,
	type ComputedCallback,
	UNSET,
	isSignal,
	isComputedCallback,
	toSignal,
} from './src/signal'

export { type State, state, isState } from './src/state'
export {
	type Computed,
	type ComputedMatcher,
	computed,
	isComputed,
} from './src/computed'
export { type EffectMatcher, type TapMatcher, effect } from './src/effect'
export { type EnqueueDedupe, batch, watch, enqueue } from './src/scheduler'
