/**
 * @name Cause & Effect
 * @version 0.16.0
 * @author Esther Brunner
 */

export {
	type Computed,
	type ComputedCallback,
	createComputed,
	isComputed,
	isComputedCallback,
	TYPE_COMPUTED,
} from './src/computed'
export {
	type DiffResult,
	diff,
	isEqual,
	type UnknownArray,
	type UnknownRecord,
	type UnknownRecordOrArray,
} from './src/diff'
export {
	createEffect,
	type EffectCallback,
	type MaybeCleanup,
} from './src/effect'
export {
	CircularDependencyError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreKeyExistsError,
	StoreKeyRangeError,
	StoreKeyReadonlyError,
} from './src/errors'
export { type MatchHandlers, match } from './src/match'
export { type ResolveResult, resolve } from './src/resolve'
export {
	isMutableSignal,
	isSignal,
	type Signal,
	type SignalValues,
	toSignal,
	type UnknownSignalRecord,
} from './src/signal'
export { createState, isState, type State, TYPE_STATE } from './src/state'
export {
	createStore,
	isStore,
	type Store,
	type StoreChanges,
	TYPE_STORE,
} from './src/store'
export {
	batch,
	type Cleanup,
	createWatcher,
	flush,
	notify,
	observe,
	subscribe,
	type Watcher,
} from './src/system'
export {
	isAbortError,
	isAsyncFunction,
	isFunction,
	isNumber,
	isRecord,
	isRecordOrArray,
	isString,
	isSymbol,
	toError,
	UNSET,
	valueString,
} from './src/util'
