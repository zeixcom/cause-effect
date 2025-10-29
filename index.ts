/**
 * @name Cause & Effect
 * @version 0.14.2
 * @author Esther Brunner
 */

export {
	type Computed,
	type ComputedCallback,
	computed,
	isComputed,
	TYPE_COMPUTED,
} from './src/computed'
export { effect, type MaybeCleanup } from './src/effect'
export { match, type MatchHandlers } from './src/match'
export { resolve, type ResolveResult } from './src/resolve'
export {
	batch,
	type Cleanup,
	enqueue,
	flush,
	notify,
	observe,
	subscribe,
	type Updater,
	type Watcher,
	watch,
} from './src/scheduler'
export {
	isComputedCallback,
	isSignal,
	type MaybeSignal,
	type Signal,
	type SignalValues,
	toSignal,
	UNSET,
} from './src/signal'
export { isState, type State, state, TYPE_STATE } from './src/state'
export { CircularDependencyError, isFunction } from './src/util'
