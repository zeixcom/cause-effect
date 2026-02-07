/* === Internal Types === */

type SourceFields<T extends {}> = {
	value: T
	sinks: Edge | null
	sinksTail: Edge | null
	stop?: Cleanup
}

type OptionsFields<T extends {}> = {
	equals: (a: T, b: T) => boolean
	guard?: Guard<T>
}

type SinkFields = {
	fn: unknown
	flags: number
	sources: Edge | null
	sourcesTail: Edge | null
}

type OwnerFields = {
	cleanup: Cleanup | Cleanup[] | null
}

type AsyncFields = {
	controller: AbortController | undefined
	error: Error | undefined
}

type RefNode<T extends {}> = SourceFields<T>

type StateNode<T extends {}> = SourceFields<T> & OptionsFields<T>

type MemoNode<T extends {}> = SourceFields<T> &
	OptionsFields<T> &
	SinkFields & {
		fn: MemoCallback<T>
		error: Error | undefined
	}

type TaskNode<T extends {}> = SourceFields<T> &
	OptionsFields<T> &
	SinkFields &
	AsyncFields & {
		fn: (prev: T, abort: AbortSignal) => Promise<T>
	}

type EffectNode = SinkFields &
	OwnerFields & {
		fn: EffectCallback
	}

type Scope = OwnerFields

type SourceNode = RefNode<unknown & {}>
type SinkNode = MemoNode<unknown & {}> | TaskNode<unknown & {}> | EffectNode
type OwnerNode = EffectNode | Scope

type Edge = {
	source: SourceNode
	sink: SinkNode
	nextSource: Edge | null
	prevSink: Edge | null
	nextSink: Edge | null
}

/* === Public API Types === */

type Signal<T extends {}> = {
	get(): T
}

/**
 * A cleanup function that can be called to dispose of resources.
 */
type Cleanup = () => void

// biome-ignore lint/suspicious/noConfusingVoidType: optional Cleanup return type
type MaybeCleanup = Cleanup | undefined | void

/**
 * A type guard function that validates whether an unknown value is of type T.
 * Used to ensure type safety when updating signals.
 *
 * @template T - The type to guard against
 * @param value - The value to check
 * @returns True if the value is of type T
 */
type Guard<T extends {}> = (value: unknown) => value is T

/**
 * Options for configuring signal behavior.
 *
 * @template T - The type of value in the signal
 */
type SignalOptions<T extends {}> = {
	/**
	 * Optional type guard to validate values.
	 * If provided, will throw an error if an invalid value is set.
	 */
	guard?: Guard<T>

	/**
	 * Optional custom equality function.
	 * Used to determine if a new value is different from the old value.
	 * Defaults to reference equality (===).
	 */
	equals?: (a: T, b: T) => boolean
}

type ComputedOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Optional initial value.
	 * Useful for reducer patterns so that calculations start with a value of correct type.
	 */
	value?: T
}

/**
 * A callback function for memos that computes a value based on the previous value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @returns The new computed value
 */
type MemoCallback<T extends {}> = (prev: T | undefined) => T

/**
 * A callback function for tasks that asynchronously computes a value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @param signal - An AbortSignal that will be triggered if the task is aborted
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (
	prev: T | undefined,
	signal: AbortSignal,
) => Promise<T>

/**
 * A callback function for effects that can perform side effects.
 *
 * @param match - A function to register cleanup callbacks that will be called before the effect re-runs or is disposed
 */
type EffectCallback = () => MaybeCleanup

/* === Constants === */

const TYPE_STATE = 'State'
const TYPE_MEMO = 'Memo'
const TYPE_TASK = 'Task'

const FLAG_CLEAN = 0
const FLAG_CHECK = 1 << 0
const FLAG_DIRTY = 1 << 1
const FLAG_RUNNING = 1 << 2

/* === Module State === */

let activeSink: SinkNode | null = null
let activeOwner: OwnerNode | null = null
const queuedEffects: EffectNode[] = []
let batchDepth = 0
let flushing = false

/* === Utility Functions === */

const defaultEquals = /*#__PURE__*/ <T extends {}>(a: T, b: T) => a === b

const isFunction = /*#__PURE__*/ <T>(
	fn: unknown,
): fn is (...args: unknown[]) => T => typeof fn === 'function'

/* === Link Management === */

const isValidEdge = (checkEdge: Edge, node: SinkNode): boolean => {
	const sourcesTail = node.sourcesTail
	if (sourcesTail) {
		let edge = node.sources
		while (edge) {
			if (edge === checkEdge) return true
			if (edge === sourcesTail) break
			edge = edge.nextSource
		}
	}
	return false
}

const link = (source: SourceNode, sink: SinkNode) => {
	const prevSource = sink.sourcesTail
	if (prevSource?.source === source) return

	let nextSource: Edge | null = null
	const isRecomputing = sink.flags & FLAG_RUNNING
	if (isRecomputing) {
		nextSource = prevSource ? prevSource.nextSource : sink.sources
		if (nextSource?.source === source) {
			sink.sourcesTail = nextSource
			return
		}
	}

	const prevSink = source.sinksTail
	if (
		prevSink?.sink === sink &&
		(!isRecomputing || isValidEdge(prevSink, sink))
	)
		return

	const newEdge = { source, sink, nextSource, prevSink, nextSink: null }
	sink.sourcesTail = source.sinksTail = newEdge
	if (prevSource) prevSource.nextSource = newEdge
	else sink.sources = newEdge
	if (prevSink) prevSink.nextSink = newEdge
	else source.sinks = newEdge
}

const unlink = (edge: Edge) => {
	const { source, nextSource, nextSink, prevSink } = edge

	if (nextSink) nextSink.prevSink = prevSink
	else source.sinksTail = prevSink
	if (prevSink) prevSink.nextSink = nextSink
	else source.sinks = nextSink

	if (!source.sinks && source.stop) {
		source.stop()
		source.stop = undefined
	}

	return nextSource
}

const trimSources = (node: SinkNode) => {
	const tail = node.sourcesTail
	let source = tail ? tail.nextSource : node.sources
	while (source) source = unlink(source)
	if (tail) tail.nextSource = null
	else node.sources = null
}

/* === Propagation === */

const propagate = (node: SinkNode, newFlag = FLAG_DIRTY) => {
	const flags = node.flags

	if ('sinks' in node) {
		if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag) return

		node.flags = flags | newFlag

		// Abort in-flight work when sources change
		if ('controller' in node && node.controller) {
			node.controller.abort()
			node.controller = undefined
		}

		// Propagate Check to sinks
		for (let e = node.sinks; e; e = e.nextSink)
			propagate(e.sink, FLAG_CHECK)
	} else {
		if (flags & FLAG_DIRTY) return

		// Enqueue effect for later execution
		node.flags = FLAG_DIRTY
		queuedEffects.push(node as EffectNode)
	}
}

/* === State Management === */

const setState = <T extends {}>(node: StateNode<T>, next: T): void => {
	if (node.equals(node.value, next)) return

	node.value = next
	for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
	if (batchDepth === 0) flush()
}

/* === Cleanup Management === */

const registerCleanup = (owner: OwnerNode, fn: Cleanup): void => {
	if (!owner.cleanup) owner.cleanup = fn
	else if (Array.isArray(owner.cleanup)) owner.cleanup.push(fn)
	else owner.cleanup = [owner.cleanup, fn]
}

const runCleanup = (owner: OwnerNode): void => {
	if (!owner.cleanup) return

	if (Array.isArray(owner.cleanup))
		for (let i = 0; i < owner.cleanup.length; i++) owner.cleanup[i]()
	else owner.cleanup()
	owner.cleanup = null
}

/* === Recomputation === */

const recomputeMemo = (node: MemoNode<unknown & {}>) => {
	const prevWatcher = activeSink
	activeSink = node
	node.sourcesTail = null
	node.flags = FLAG_RUNNING

	let changed = false
	try {
		const next = node.fn(node.value)
		if (node.error || !node.equals(next, node.value)) {
			node.value = next
			node.error = undefined
			changed = true
		}
	} catch (err: unknown) {
		changed = true
		node.error = err instanceof Error ? err : new Error(String(err))
	} finally {
		activeSink = prevWatcher
		trimSources(node)
	}

	if (changed) {
		for (let e = node.sinks; e; e = e.nextSink)
			if (e.sink.flags & FLAG_CHECK) e.sink.flags |= FLAG_DIRTY
	}

	node.flags = FLAG_CLEAN
}

const recomputeTask = (node: TaskNode<unknown & {}>) => {
	node.controller?.abort()

	const controller = new AbortController()
	node.controller = controller
	node.error = undefined

	const prevWatcher = activeSink
	activeSink = node
	node.sourcesTail = null
	node.flags = FLAG_RUNNING

	let promise: Promise<unknown & {}>
	try {
		promise = node.fn(node.value, controller.signal)
	} catch (err) {
		node.controller = undefined
		node.error = err instanceof Error ? err : new Error(String(err))
		return
	} finally {
		activeSink = prevWatcher
		trimSources(node)
	}

	promise.then(
		next => {
			if (controller.signal.aborted) return

			node.controller = undefined
			if (node.error || !node.equals(next, node.value)) {
				node.value = next
				node.error = undefined
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},
		(err: unknown) => {
			if (controller.signal.aborted) return

			node.controller = undefined
			const error = err instanceof Error ? err : new Error(String(err))
			if (
				!node.error ||
				error.name !== node.error.name ||
				error.message !== node.error.message
			) {
				// We don't clear old value on errors
				node.error = error
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},
	)

	node.flags = FLAG_CLEAN
}

const runEffect = (node: EffectNode) => {
	runCleanup(node)
	const prevContext = activeSink
	const prevOwner = activeOwner
	activeSink = activeOwner = node
	node.sourcesTail = null
	node.flags = FLAG_RUNNING

	try {
		const out = node.fn()
		if (typeof out === 'function') registerCleanup(node, out)
	} finally {
		activeSink = prevContext
		activeOwner = prevOwner
		trimSources(node)
	}

	node.flags = FLAG_CLEAN
}

const refresh = (node: SinkNode): void => {
	if (node.flags & FLAG_CHECK) {
		for (let e = node.sources; e; e = e.nextSource) {
			if ('fn' in e.source) refresh(e.source as SinkNode)
			if (node.flags & FLAG_DIRTY) break
		}
	}

	if (node.flags & FLAG_RUNNING) {
		throw new CircularDependencyError(
			'controller' in node
				? TYPE_TASK
				: 'value' in node
					? TYPE_MEMO
					: 'Effect',
		)
	}

	if (node.flags & FLAG_DIRTY) {
		if ('controller' in node) recomputeTask(node)
		else if ('value' in node) recomputeMemo(node)
		else runEffect(node)
	} else {
		node.flags = FLAG_CLEAN
	}
}

/* === Batching === */

const flush = (): void => {
	if (flushing) return
	flushing = true
	try {
		for (let i = 0; i < queuedEffects.length; i++) {
			const effect = queuedEffects[i]
			if (effect.flags & FLAG_DIRTY) refresh(effect)
		}
		queuedEffects.length = 0
	} finally {
		flushing = false
	}
}

/**
 * Batches multiple signal updates together.
 * Effects will not run until the batch completes.
 * Batches can be nested; effects run when the outermost batch completes.
 *
 * @param fn - The function to execute within the batch
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const double = createMemo(() => count.get() * 2);
 *
 * batch(() => {
 *   count.set(1);
 *   count.set(2);
 *   count.set(3);
 *   // Effects run only once at the end with count = 3
 * });
 * ```
 */
const batch = (fn: () => void): void => {
	batchDepth++
	try {
		fn()
	} finally {
		batchDepth--
		if (batchDepth === 0) flush()
	}
}

/* === Scope Management === */

/**
 * Creates a new ownership scope for managing cleanup of nested effects and resources.
 * All effects created within the scope will be automatically disposed when the scope is disposed.
 * Scopes can be nested - disposing a parent scope disposes all child scopes.
 *
 * @param fn - The function to execute within the scope, may return a cleanup function
 * @returns A dispose function that cleans up the scope
 *
 * @example
 * ```ts
 * const dispose = createScope(() => {
 *   const count = createState(0);
 *
 *   createEffect(() => {
 *     console.log(count.get());
 *   });
 *
 *   return () => console.log('Scope disposed');
 * });
 *
 * dispose(); // Cleans up the effect and runs cleanup callbacks
 * ```
 *
 * @example
 * ```ts
 * // Nested scopes
 * const disposeOuter = createScope(() => {
 *   const disposeInner = createScope(() => {
 *     // ...
 *   });
 *   // disposeOuter() will also dispose inner scope
 *   return disposeInner;
 * });
 * ```
 */
const createScope = (fn: () => MaybeCleanup): Cleanup => {
	const prevOwner = activeOwner
	const scope: Scope = { cleanup: null }
	activeOwner = scope

	try {
		const out = fn()
		if (typeof out === 'function') registerCleanup(scope, out)
		const dispose = () => runCleanup(scope)
		if (prevOwner) registerCleanup(prevOwner, dispose)
		return dispose
	} finally {
		activeOwner = prevOwner
	}
}

/* === Errors === */

const valueString = (value: unknown): string =>
	typeof value === 'string'
		? `"${value}"`
		: !!value && typeof value === 'object'
			? JSON.stringify(value)
			: String(value)

function validateSignalValue<T extends {}>(
	where: string,
	value: unknown,
	guard?: Guard<T>,
): asserts value is T {
	if (value == null) throw new NullishSignalValueError(where)
	if (guard && !guard(value)) throw new InvalidSignalValueError(where, value)
}

function validateReadValue<T extends {}>(
	where: string,
	value: T | null | undefined,
): asserts value is T {
	if (value == null) throw new UnsetSignalValueError(where)
}

function validateCallback(
	where: string,
	value: unknown,
): asserts value is (...args: unknown[]) => unknown
function validateCallback<T>(
	where: string,
	value: unknown,
	guard: (value: unknown) => value is T,
): asserts value is T
function validateCallback(
	where: string,
	value: unknown,
	guard: (value: unknown) => boolean = isFunction,
): void {
	if (!guard(value)) throw new InvalidCallbackError(where, value)
}

/**
 * Error thrown on re-entrance on an already running function.
 */
class CircularDependencyError extends Error {
	/**
	 * Constructs a new CircularDependencyError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Circular dependency detected`)
		this.name = 'CircularDependencyError'
	}
}

/**
 * Error thrown when a signal value is null or undefined.
 */
class NullishSignalValueError extends TypeError {
	/**
	 * Constructs a new NullishSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Signal value cannot be null or undefined`)
		this.name = 'NullishSignalValueError'
	}
}

/**
 * Error thrown when a signal is read before it has a value.
 */
class UnsetSignalValueError extends Error {
	/**
	 * Constructs a new UnsetSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Signal value is unset`)
		this.name = 'UnsetSignalValueError'
	}
}

/**
 * Error thrown when a signal value is invalid.
 */
class InvalidSignalValueError extends TypeError {
	/**
	 * Constructs a new InvalidSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 * @param value - The invalid value.
	 */
	constructor(where: string, value: unknown) {
		super(`[${where}] Signal value ${valueString(value)} is invalid`)
		this.name = 'InvalidSignalValueError'
	}
}

/**
 * Error thrown when a callback is invalid.
 */
class InvalidCallbackError extends TypeError {
	/**
	 * Constructs a new InvalidCallbackError.
	 *
	 * @param where - The location where the error occurred.
	 * @param value - The invalid value.
	 */
	constructor(where: string, value: unknown) {
		super(`[${where}] Callback ${valueString(value)} is invalid`)
		this.name = 'InvalidCallbackError'
	}
}

/**
 * Error thrown when an API requiring an owner is called without one.
 */
class RequiredOwnerError extends Error {
	/**
	 * Constructs a new RequiredOwnerError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Active owner is required`)
		this.name = 'RequiredOwnerError'
	}
}

export {
	type Cleanup,
	type ComputedOptions,
	type EffectCallback,
	type EffectNode,
	type Guard,
	type MaybeCleanup,
	type MemoCallback,
	type MemoNode,
	type RefNode,
	type Scope,
	type Signal,
	type SignalOptions,
	type SinkNode,
	type StateNode,
	type TaskCallback,
	type TaskNode,
	activeOwner,
	activeSink,
	batch,
	batchDepth,
	CircularDependencyError,
	createScope,
	defaultEquals,
	FLAG_CLEAN,
	FLAG_DIRTY,
	flush,
	InvalidCallbackError,
	InvalidSignalValueError,
	link,
	NullishSignalValueError,
	propagate,
	refresh,
	registerCleanup,
	runCleanup,
	runEffect,
	setState,
	trimSources,
	TYPE_MEMO,
	TYPE_STATE,
	TYPE_TASK,
	RequiredOwnerError,
	UnsetSignalValueError,
	unlink,
	validateSignalValue,
	validateReadValue,
	validateCallback,
}
