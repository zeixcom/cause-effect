/**
 * @name Cause & Effect
 * @version 0.15.0
 * @author Esther Brunner
 */

export {
	type Computed,
	type ComputedCallback,
	computed,
	isComputed,
	isComputedCallback,
	TYPE_COMPUTED,
} from './src/computed'
export { type DiffResult, diff, isEqual, type UnknownRecord } from './src/diff'
export { type EffectCallback, effect, type MaybeCleanup } from './src/effect'
export { type MatchHandlers, match } from './src/match'
export { type ResolveResult, resolve } from './src/resolve'
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
	isSignal,
	type MaybeSignal,
	type Signal,
	type SignalValues,
	toSignal,
	UNSET,
} from './src/signal'
export { isState, type State, state, TYPE_STATE } from './src/state'
export {
	isStore,
	type Store,
	type StoreAddEvent,
	type StoreChangeEvent,
	type StoreEventMap,
	type StoreRemoveEvent,
	store,
	TYPE_STORE,
} from './src/store'
export {
	CircularDependencyError,
	isAbortError,
	isAsyncFunction,
	isFunction,
	toError,
} from './src/util'
