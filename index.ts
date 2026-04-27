/**
 * @name Cause & Effect
 * @version 1.3.1
 * @author Esther Brunner
 */

export {
	CircularDependencyError,
	type Guard,
	InvalidCallbackError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
	RequiredOwnerError,
	UnsetSignalValueError,
} from './src/errors'
export {
	batch,
	type Cleanup,
	type ComputedOptions,
	createScope,
	DEFAULT_EQUALITY,
	DEEP_EQUALITY,
	type EffectCallback,
	type MaybeCleanup,
	type MemoCallback,
	type Signal,
	type SignalOptions,
	SKIP_EQUALITY,
	type TaskCallback,
	unown,
	untrack,
} from './src/graph'
export {
	type Collection,
	type CollectionCallback,
	type CollectionChanges,
	type CollectionOptions,
	createCollection,
	type DeriveCollectionCallback,
	isCollection,
} from './src/nodes/collection'
export {
	createEffect,
	type MatchHandlers,
	type SingleMatchHandlers,
	type MaybePromise,
	match,
} from './src/nodes/effect'
export {
	createList,
	isList,
	type KeyConfig,
	type List,
	type ListOptions,
} from './src/nodes/list'
export { createMemo, isMemo, type Memo } from './src/nodes/memo'
export {
	createSensor,
	isSensor,
	type Sensor,
	type SensorCallback,
	type SensorOptions,
} from './src/nodes/sensor'
export {
	createSlot,
	isSlot,
	type Slot,
	type SlotDescriptor,
} from './src/nodes/slot'
export {
	createState,
	isState,
	type State,
	type UpdateCallback,
} from './src/nodes/state'
export {
	createStore,
	isStore,
	type Store,
	type StoreOptions,
} from './src/nodes/store'
export { createTask, isTask, type Task } from './src/nodes/task'
export {
	createComputed,
	createMutableSignal,
	createSignal,
	isComputed,
	isMutableSignal,
	isSignal,
	type MutableSignal,
} from './src/signal'
export {
	isAsyncFunction,
	isFunction,
	isObjectOfType,
	isSignalOfType,
	isRecord,
	valueString,
} from './src/util'

/** @deprecated Use `DEEP_EQUALITY` instead. */
export { isEqual } from './src/graph'
