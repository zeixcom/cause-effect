/**
 * @name Cause & Effect
 * @version 2.0.0
 * @author Esther Brunner
 */

export {
	CircularDependencyError,
	DuplicateKeyError,
	EffectConvergenceError,
	type Guard,
	InvalidCallbackError,
	InvalidSignalValueError,
	InvalidStoreMutationError,
	NullishSignalValueError,
	PromiseValueError,
	ReadonlySignalError,
	RequiredOwnerError,
	UnsetSignalValueError,
} from './src/errors'
export {
	abort,
	batch,
	type CellCallback,
	type CellOptions,
	type Cleanup,
	createScope,
	DEEP_EQUALITY,
	DEFAULT_EQUALITY,
	type DeriveCellOptions,
	type EffectCallback,
	isPending,
	type MaybeCleanup,
	type MemoCallback,
	type ScopeOptions,
	SKIP_EQUALITY,
	type TaskCallback,
	unown,
	untrack,
} from './src/graph'
export {
	type Cell,
	createCell,
	deriveCell,
	isCell,
	isMutableCell,
	isMutableSignal,
	isSignal,
	type MutableCell,
	type Signal,
} from './src/nodes/cell'
export {
	createEffect,
	type MatchHandlers,
	type MaybePromise,
	match,
	type SingleMatchHandlers,
} from './src/nodes/effect'
export {
	createList,
	type DeriveListOptions,
	deriveList,
	isList,
	isMutableList,
	type KeyConfig,
	type List,
	type ListCallback,
	type ListChanges,
	type ListOptions,
	type ListSource,
	type MutableList,
	type PerItemCallback,
} from './src/nodes/list'
export { deriveComputed } from './src/nodes/memo'
export {
	createSlot,
	isSlot,
	type Slot,
	type SlotDescriptor,
} from './src/nodes/slot'
export { createState, type UpdateCallback } from './src/nodes/state'
export {
	createStore,
	type DeriveStoreOptions,
	deriveStore,
	isMutableStore,
	isStore,
	type MutableStore,
	type Store,
	type StoreCallback,
	type StoreOptions,
} from './src/nodes/store'
export {
	isAsyncFunction,
	isFunction,
	isRecord,
	isSignalOfType,
	valueString,
} from './src/util'
