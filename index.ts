/**
 * @name Cause & Effect
 * @version 0.17.3
 * @author Esther Brunner
 */

export {
	type Collection,
	type CollectionCallback,
	type CollectionSource,
	DerivedCollection,
	isCollection,
	TYPE_COLLECTION,
} from './archive/classes/collection'
export {
	type Computed,
	createComputed,
	isComputed,
	isMemoCallback,
	isTaskCallback,
	Memo,
	type MemoCallback,
	Task,
	type TaskCallback,
	TYPE_COMPUTED,
} from './archive/classes/computed'
export {
	type ArrayToRecord,
	isList,
	type KeyConfig,
	List,
	TYPE_LIST,
} from './archive/classes/list'
export { isRef, Ref, TYPE_REF } from './archive/classes/ref'
export { isState, State, TYPE_STATE } from './archive/classes/state'
export {
	BaseStore,
	createStore,
	isStore,
	type Store,
	TYPE_STORE,
} from './archive/classes/store'
export {
	type DiffResult,
	diff,
	isEqual,
	type UnknownArray,
	type UnknownRecord,
} from './archive/diff'
export {
	createEffect,
	type EffectCallback,
	type MaybeCleanup,
} from './archive/effect'
export {
	CircularDependencyError,
	createError,
	DuplicateKeyError,
	type Guard,
	guardMutableSignal,
	InvalidCallbackError,
	InvalidCollectionSourceError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
	validateCallback,
	validateSignalValue,
} from './archive/errors'
export { type MatchHandlers, match } from './archive/match'
export { type ResolveResult, resolve } from './archive/resolve'
export {
	createSignal,
	isMutableSignal,
	isSignal,
	type Signal,
	type SignalValues,
	type UnknownSignalRecord,
} from './archive/signal'
export {
	batch,
	type Cleanup,
	createWatcher,
	flush,
	notifyOf,
	type SignalOptions,
	subscribeTo,
	track,
	UNSET,
	untrack,
	type Watcher,
} from './archive/system'
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
	valueString,
} from './src/util'
