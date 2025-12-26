/**
 * @name Cause & Effect
 * @version 0.16.2
 * @author Esther Brunner
 */

export {
	type Collection,
	createCollection,
	isCollection,
	TYPE_COLLECTION,
} from './src/collection'
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
} from './src/diff'
export {
	createEffect,
	type EffectCallback,
	type MaybeCleanup,
} from './src/effect'
export {
	CircularDependencyError,
	DuplicateKeyError,
	ForbiddenMethodCallError,
	InvalidCallbackError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreIndexRangeError,
	StoreKeyReadonlyError,
} from './src/errors'
export {
	type ArrayToRecord,
	createList,
	isList,
	type KeyConfig,
	type List,
	TYPE_LIST,
} from './src/list'
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
export { createStore, isStore, type Store, TYPE_STORE } from './src/store'
export {
	batch,
	type Cleanup,
	createWatcher,
	emit,
	flush,
	type Listener,
	type Listeners,
	type Notifications,
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
	isObjectOfType,
	isRecord,
	isRecordOrArray,
	isString,
	isSymbol,
	toError,
	UNSET,
	valueString,
} from './src/util'
