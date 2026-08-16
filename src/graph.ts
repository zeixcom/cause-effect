import {
	CircularDependencyError,
	EffectConvergenceError,
	type Guard,
	PromiseValueError,
} from './errors'
import { isRecord } from './util'

/* === Internal Types === */

type SourceFields<T extends {}> = {
	value: T
	sinks: Edge | null
	sinksTail: Edge | null
	stop?: Cleanup | undefined
}

type OptionsFields<T extends {}> = {
	equals: (a: T, b: T) => boolean
	guard?: Guard<T> | undefined
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
		pendingNode: StateNode<boolean>
	}

type EffectNode = SinkFields &
	OwnerFields & {
		fn: EffectCallback
	}

type Scope = OwnerFields

type SourceNode = SourceFields<unknown & {}>
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
 * Options for configuring signal behavior.
 *
 * @template T - The type of value in the signal
 */
type SignalOptions<T extends {}> = {
	/**
	 * Optional type guard to validate values.
	 * If provided, `set()` throws an error for an invalid value.
	 */
	guard?: Guard<T>

	/**
	 * Optional custom equality function.
	 * Used to determine if a new value is different from the old value.
	 * Defaults to reference equality (===). When equal, propagation stops for
	 * this signal's entire downstream subtree, not just this signal.
	 */
	equals?: (a: T, b: T) => boolean
}

type ComputedOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Optional initial value.
	 * Useful for reducer patterns so that calculations start with a value of correct type.
	 */
	value?: T

	/**
	 * Optional callback invoked when the signal is first watched by an effect.
	 * Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
	 * Must return a cleanup function that is called when the signal is no longer watched.
	 *
	 * This enables lazy resource activation for computed signals that need to
	 * react to external events (e.g. DOM mutations, timers) in addition to
	 * tracked signal dependencies.
	 */
	watched?: (invalidate: () => void) => Cleanup
}

/**
 * Options for configuring scope behavior.
 */
type ScopeOptions = {
	/**
	 * When `true`, the scope is not registered on the current parent owner.
	 * The returned `dispose` function becomes the only way to dispose the scope.
	 *
	 * Use this for a scope with an external lifecycle authority, such as a web
	 * component that disposes in `disconnectedCallback`. Without it, a scope created
	 * inside a re-runnable effect is silently disposed on the next run of that effect.
	 */
	root?: boolean
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
 * @param signal - An AbortSignal that aborts when the task is cancelled
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (
	prev: T | undefined,
	signal: AbortSignal,
) => Promise<T>

/**
 * A callback function for effects that can perform side effects.
 *
 * @returns An optional cleanup function that runs before the next run and on disposal
 */
type EffectCallback = () => MaybeCleanup

/* === Constants === */

const TYPE_STATE = 'State'
const TYPE_MEMO = 'Memo'
const TYPE_TASK = 'Task'
const TYPE_SENSOR = 'Sensor'
const TYPE_LIST = 'List'
const TYPE_COLLECTION = 'Collection'
const TYPE_STORE = 'Store'
const TYPE_SLOT = 'Slot'

const FLAG_CLEAN = 0
const FLAG_CHECK = 1 << 0
const FLAG_DIRTY = 1 << 1
const FLAG_RUNNING = 1 << 2
const FLAG_RELINK = 1 << 3

/* === Module State === */

// activeSink, activeOwner, and batchDepth are exported as mutable `let` bindings.
// Importers read the live value via ESM live binding semantics — this only works in
// native ESM and bundlers that preserve live bindings (Rollup, esbuild ESM mode).
// A pre-bundled CJS output would snapshot these at import time, silently breaking
// dependency tracking and batching. The library is ESM-only by design (see REQUIREMENTS.md).
let activeSink: SinkNode | null = null
let activeOwner: OwnerNode | null = null
const queuedEffects: EffectNode[] = []
let batchDepth = 0
let flushing = false

/* === Utility Functions === */

/**
 * Default strict equality (`===`) — identical to the implicit default for all signals.
 * Pass explicitly to make the equality strategy visible when composing or overriding signal options.
 */
const DEFAULT_EQUALITY = <T extends {}>(a: T, b: T): boolean => a === b

/**
 * Equality function that always returns false, so every write propagates.
 * Use with `createSensor` to observe a mutable object whose reference stays the same
 * while its internal state changes. A DOM element under a MutationObserver is one example.
 *
 * @example
 * ```ts
 * const el = createSensor<HTMLElement>((set) => {
 *   const node = document.getElementById('box')!;
 *   set(node);
 *   const obs = new MutationObserver(() => set(node));
 *   obs.observe(node, { attributes: true });
 *   return () => obs.disconnect();
 * }, { value: node, equals: SKIP_EQUALITY });
 * ```
 */
const SKIP_EQUALITY = (_a?: unknown, _b?: unknown): boolean => false

// The cycle-guard set is allocated lazily, at the first object comparison:
// most comparisons end at the primitive checks above, and this is the default
// equality for every List item and Store property write, so an eager WeakSet
// would dominate those hot paths.
const deepEqual = (a: unknown, b: unknown): boolean =>
	deepEqualInner(a, b, undefined)

const deepEqualInner = (
	a: unknown,
	b: unknown,
	seen: WeakSet<object> | undefined,
): boolean => {
	if (Object.is(a, b)) return true
	if (typeof a !== typeof b) return false
	if (a == null || typeof a !== 'object' || b == null || typeof b !== 'object')
		return false

	// Cycle guard: if `a` is already on the current recursion path, treat this
	// pair as equal (ADR-0016). Scoped to the active path, not "every object
	// ever visited" — the entry is removed once this call returns, so an
	// object reached twice via different (non-cyclic) paths is still compared
	// independently each time, not aliased away by an earlier, unrelated pair.
	if (seen?.has(a as object)) return true
	seen ??= new WeakSet()
	seen.add(a as object)

	try {
		const aIsArray = Array.isArray(a)
		if (aIsArray !== Array.isArray(b)) return false

		if (aIsArray) {
			const aa = a
			const ba = b as unknown[]
			if (aa.length !== ba.length) return false
			for (let i = 0; i < aa.length; i++)
				if (!deepEqualInner(aa[i], ba[i], seen)) return false
			return true
		}

		// Value-semantic built-ins: compare by their intrinsic value, not identity.
		// These are not plain records, so without explicit handling they would
		// fall through to `return false` and force spurious downstream propagation.
		if (a instanceof Date && b instanceof Date)
			return a.getTime() === b.getTime()
		if (a instanceof RegExp && b instanceof RegExp)
			return a.source === b.source && a.flags === b.flags

		if (isRecord(a) && isRecord(b)) {
			const aKeys = Object.keys(a)
			if (aKeys.length !== Object.keys(b).length) return false
			for (const key of aKeys) {
				if (!(key in b)) return false
				if (!deepEqualInner(a[key], b[key], seen)) return false
			}
			return true
		}

		return false
	} finally {
		seen.delete(a)
	}
}

/**
 * Deep structural equality check for plain objects and arrays.
 * Use it when a signal holds an object or an array. It stops downstream propagation
 * when the value re-evaluates to a structurally identical result.
 *
 * @example
 * ```ts
 * const point = createState({ x: 0, y: 0 }, { equals: DEEP_EQUALITY });
 * point.set({ x: 0, y: 0 }); // no propagation — structurally equal
 * ```
 */
const DEEP_EQUALITY = <T extends {}>(a: T, b: T): boolean => deepEqual(a, b)

/**
 * @deprecated Use {@link DEEP_EQUALITY} instead.
 */
const isEqual = DEEP_EQUALITY

/* === Link Management === */

function isValidEdge(checkEdge: Edge, node: SinkNode): boolean {
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

function link(source: SourceNode, sink: SinkNode): void {
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

function unlink(edge: Edge): Edge | null {
	const { source, nextSource, nextSink, prevSink } = edge

	if (nextSink) nextSink.prevSink = prevSink
	else source.sinksTail = prevSink
	if (prevSink) prevSink.nextSink = nextSink
	else source.sinks = nextSink

	if (!source.sinks) {
		if (source.stop) {
			source.stop()
			source.stop = undefined
		}

		// Cascade: if the source is also a sink (e.g. MemoNode, derived collection),
		// trim its own sources so upstream watched callbacks can clean up.
		// Mark FLAG_DIRTY so the next refresh() re-runs the computation and
		// re-establishes source links — without this the node is FLAG_CLEAN with
		// no sources, causing stale reads and silent propagation loss on reconnect.
		if ('sources' in source && source.sources) {
			const sinkNode = source as SinkNode
			sinkNode.sourcesTail = null
			trimSources(sinkNode)
			sinkNode.flags |= FLAG_DIRTY
		}
	}

	return nextSource
}

function trimSources(node: SinkNode): void {
	const tail = node.sourcesTail
	let source = tail ? tail.nextSource : node.sources
	while (source) source = unlink(source)
	if (tail) tail.nextSource = null
	else node.sources = null
}

/* === Propagation === */

function propagate(node: SinkNode, newFlag = FLAG_DIRTY): void {
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
		for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink, FLAG_CHECK)
	} else {
		if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag) return

		// Enqueue effect for later execution
		const wasQueued = flags & (FLAG_DIRTY | FLAG_CHECK)
		node.flags = (flags & FLAG_RUNNING) | newFlag
		if (!wasQueued) queuedEffects.push(node as EffectNode)
	}
}

/* === State Management === */

function setState<T extends {}>(node: StateNode<T>, next: T): void {
	if (node.equals(node.value, next)) return

	node.value = next
	for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
	if (batchDepth === 0) flush()
}

/* === Cleanup Management === */

function registerCleanup(owner: OwnerNode, fn: Cleanup): void {
	if (!owner.cleanup) owner.cleanup = fn
	else if (Array.isArray(owner.cleanup)) owner.cleanup.push(fn)
	else owner.cleanup = [owner.cleanup, fn]
}

function runCleanup(owner: OwnerNode): void {
	if (!owner.cleanup) return

	if (Array.isArray(owner.cleanup))
		// biome-ignore lint/style/noNonNullAssertion: index is always within bounds of a populated Cleanup[]
		for (let i = 0; i < owner.cleanup.length; i++) owner.cleanup[i]!()
	else owner.cleanup()
	owner.cleanup = null
}

/* === Recomputation === */

function recomputeMemo(node: MemoNode<unknown & {}>): void {
	const prevWatcher = activeSink
	activeSink = node
	node.sourcesTail = null
	node.flags = FLAG_RUNNING

	let changed = false
	try {
		const next = node.fn(node.value)
		// fn misclassified as sync by isAsyncFunction (it checks the callback, not its return value)
		if (next instanceof Promise) throw new PromiseValueError(TYPE_MEMO)
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

function recomputeTask(node: TaskNode<unknown & {}>): void {
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
		// Keep the node recoverable: clear FLAG_RUNNING and reset pending,
		// so subsequent reads report the SAME error instead of a spurious
		// CircularDependencyError on the stuck RUNNING flag.
		node.flags = FLAG_CLEAN
		setState(node.pendingNode, false)
		return
	} finally {
		activeSink = prevWatcher
		trimSources(node)
	}

	setState(node.pendingNode, true)

	promise.then(
		next => {
			if (controller.signal.aborted) return

			node.controller = undefined
			batch(() => {
				if (node.error || !node.equals(next, node.value)) {
					node.value = next
					node.error = undefined
					for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				}
				setState(node.pendingNode, false)
			})
		},
		(err: unknown) => {
			if (controller.signal.aborted) return

			node.controller = undefined
			const error = err instanceof Error ? err : new Error(String(err))
			batch(() => {
				if (
					!node.error ||
					error.name !== node.error.name ||
					error.message !== node.error.message
				) {
					// We don't clear old value on errors
					node.error = error
					for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				}
				setState(node.pendingNode, false)
			})
		},
	)

	node.flags = FLAG_CLEAN
}

function runEffect(node: EffectNode): void {
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
		// Keep a re-mark from the effect's own writes so it converges
		node.flags &= FLAG_DIRTY | FLAG_CHECK
	}
}

function refresh(node: SinkNode): void {
	if (node.flags & FLAG_CHECK) {
		for (let e = node.sources; e; e = e.nextSource) {
			if ('fn' in e.source) refresh(e.source as SinkNode)
			if (node.flags & FLAG_DIRTY) break
		}
	}

	if (node.flags & FLAG_RUNNING) {
		throw new CircularDependencyError(
			'controller' in node ? TYPE_TASK : 'value' in node ? TYPE_MEMO : 'Effect',
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

const MAX_FLUSH_PASSES = 1000

function flush(): void {
	if (flushing) return
	flushing = true
	let errors: unknown[] | undefined
	let passes = 0
	try {
		while (queuedEffects.length > 0) {
			if (++passes > MAX_FLUSH_PASSES) {
				queuedEffects.length = 0
				if (!errors) errors = []
				errors.push(new EffectConvergenceError(MAX_FLUSH_PASSES))
				break
			}
			const batch = queuedEffects.slice()
			queuedEffects.length = 0
			for (let i = 0; i < batch.length; i++) {
				// biome-ignore lint/style/noNonNullAssertion: index is always within bounds of a populated EffectNode[]
				const effect = batch[i]!
				// A running effect is converged by its own runner after its fn returns
				if (effect.flags & FLAG_RUNNING) continue
				if (effect.flags & (FLAG_DIRTY | FLAG_CHECK)) {
					try {
						refresh(effect)
					} catch (err) {
						if (!errors) errors = []
						errors.push(err)
					}
				}
			}
		}
	} finally {
		flushing = false
	}
	if (errors) {
		if (errors.length === 1) throw errors[0]
		throw new AggregateError(errors, 'Multiple effects threw during flush')
	}
}

/**
 * Enqueues an effect that is still dirty after it ran, because it wrote to its own
 * dependencies. Outside a batch, flushes until the graph converges.
 */
function scheduleEffect(node: EffectNode): void {
	if (node.flags & (FLAG_DIRTY | FLAG_CHECK)) {
		queuedEffects.push(node)
		if (batchDepth === 0) flush()
	}
}

/**
 * Batches multiple signal updates together.
 * Effects run once, when the outermost batch completes. Batches nest.
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
function batch(fn: () => void): void {
	batchDepth++
	try {
		fn()
	} finally {
		batchDepth--
		if (batchDepth === 0) flush()
	}
}

/**
 * Runs a callback without tracking dependencies.
 * A signal read inside the callback creates no edge to the active sink.
 *
 * @param fn - The function to execute without tracking
 * @returns The return value of the function
 *
 * @example
 * ```ts
 * const count = createState(0);
 * const label = createState('Count');
 *
 * createEffect(() => {
 *   // Only re-runs when count changes, not when label changes
 *   const name = untrack(() => label.get());
 *   console.log(`${name}: ${count.get()}`);
 * });
 * ```
 */
function untrack<T>(fn: () => T): T {
	const prev = activeSink
	activeSink = null
	try {
		return fn()
	} finally {
		activeSink = prev
	}
}

/* === Scope Management === */

/**
 * Creates an ownership scope that disposes the effects and resources created inside it.
 *
 * Scopes nest. Disposing a parent scope disposes every child scope. A scope created inside
 * another owner registers its disposal on that owner by default. Pass `{ root: true }` to
 * suppress that registration. The returned `dispose` then becomes the only way to dispose
 * the scope. Use it when an external lifecycle authority owns the cleanup, such as a web
 * component's `disconnectedCallback`.
 *
 * @param fn - The function to execute within the scope, may return a cleanup function
 * @param options - Optional scope configuration
 * @returns A dispose function that cleans up the scope
 *
 * @example Standard (owned) scope:
 * ```ts
 * const dispose = createScope(() => {
 *   const count = createState(0);
 *   createEffect(() => { console.log(count.get()); });
 *   return () => console.log('Scope disposed');
 * });
 * dispose();
 * ```
 *
 * @example Root scope for a web component:
 * ```ts
 * class MyElement extends HTMLElement {
 *   #dispose?: () => void;
 *
 *   connectedCallback() {
 *     this.#dispose = createScope(() => {
 *       createEffect(() => { this.textContent = label.get(); });
 *     }, { root: true });
 *   }
 *
 *   disconnectedCallback() {
 *     this.#dispose?.();
 *   }
 * }
 * ```
 */
function createScope(fn: () => MaybeCleanup, options?: ScopeOptions): Cleanup {
	const prevOwner = activeOwner
	const scope: Scope = { cleanup: null }
	activeOwner = scope
	const dispose = () => runCleanup(scope)

	try {
		const out = fn()
		if (typeof out === 'function') registerCleanup(scope, out)
		return dispose
	} finally {
		activeOwner = prevOwner
		if (!options?.root && prevOwner) registerCleanup(prevOwner, dispose)
	}
}

/**
 * Runs a callback without any active owner.
 *
 * A scope or an effect created inside the callback gets no parent owner. It does not
 * become a child of the active owner, such as a re-runnable effect. Use this when a component or a resource
 * manages its own lifecycle independently of the graph.
 *
 * @since 0.18.5
 * @param fn - The function to execute without an active owner
 * @returns The return value of `fn`
 */
function unown<T>(fn: () => T): T {
	const prev = activeOwner
	activeOwner = null
	try {
		return fn()
	} finally {
		activeOwner = prev
	}
}

function makeSubscribe(node: SourceNode, onWatch?: () => Cleanup): () => void {
	return onWatch
		? () => {
				if (activeSink) {
					if (!node.sinks) node.stop = onWatch()
					link(node, activeSink)
				}
			}
		: () => {
				if (activeSink) link(node, activeSink)
			}
}

/* === Composite Access === */

/**
 * The two-path access pattern shared by every composite signal. See ADR-0014.
 *
 * Fast path — edges are established, so a rebuild runs untracked and does not relink.
 * Tracked path — a structural change (`FLAG_RELINK`) needs `link()` to add edges for new
 * child signals and `trimSources()` to drop stale ones without orphaning them.
 *
 * `node.value` must NOT be pre-written before the tracked path: `recomputeMemo()` diffs
 * its own freshly built value against the CURRENT `node.value` to decide whether to
 * promote downstream `FLAG_CHECK` sinks to `FLAG_DIRTY`. Pre-writing makes that
 * comparison trivially equal and silently drops the cascade to any sink queued earlier in
 * the same propagate pass — for instance an eager out-of-band read racing ahead of the
 * effect queue.
 *
 * @param node - The composite's structural tracking node
 * @param buildValue - Composes the node value from the child signals
 * @param discoversKeys - True for a derived composite, whose `buildValue` learns about key
 *   changes by running and sets `FLAG_RELINK` as a side effect. Such a node must run once,
 *   untracked, before we can know which path applies, and must not establish edges before
 *   it has a sink — that would activate an upstream `watched` lifecycle prematurely.
 */
function refreshComposite<T extends {}>(
	node: MemoNode<T>,
	buildValue: () => T,
	discoversKeys = false,
): void {
	if (node.sources) {
		if (!node.flags) return
		const result = discoversKeys ? untrack(buildValue) : undefined
		if (node.flags & FLAG_RELINK) {
			node.flags = FLAG_DIRTY
			refresh(node as unknown as SinkNode)
			if (node.error) throw node.error
		} else {
			node.value = discoversKeys ? (result as T) : untrack(buildValue)
			node.flags = FLAG_CLEAN
		}
	} else if (!discoversKeys || node.sinks) {
		refresh(node as unknown as SinkNode)
		if (node.error) throw node.error
	} else {
		// No sinks yet — compute without establishing edges. Stays FLAG_DIRTY so the
		// first refresh() with a real sink establishes proper edges.
		node.value = untrack(buildValue)
	}
}

/* === Async State Utilities === */

/**
 * The async capabilities a signal may carry. A `Task` implements this directly.
 * A composite derived from an async source registers its source instead.
 */
type PendingSource = {
	isPending(): boolean
	abort(): void
}

/**
 * Maps a derived composite to the async source behind it.
 *
 * A `List` or `Store` derived from an async computation has no async surface of its own —
 * its asynchrony lives in an internal `Task`. Registering it here keeps `isPending()` and
 * `abort()` shape-agnostic without widening the composite's consumption type or adding a
 * closure to every node. See ADR-0018.
 */
const asyncSources = new WeakMap<object, PendingSource>()

/** Associates a derived composite with the async source that drives it. */
function registerAsyncSource(signal: object, source: PendingSource): void {
	asyncSources.set(signal, source)
}

/** Resolves the async capabilities of a signal, if it has any. */
function getAsyncSource(signal: unknown): PendingSource | undefined {
	if (signal == null || typeof signal !== 'object') return undefined
	const candidate = signal as Partial<PendingSource>
	if (
		typeof candidate.isPending === 'function' &&
		typeof candidate.abort === 'function'
	)
		return candidate as PendingSource
	return asyncSources.get(signal)
}

/**
 * Reports whether an asynchronously derived signal has settled.
 *
 * Reactive: reading this inside a computation re-runs it when the pending state changes.
 * Returns `false`, without tracking, for a signal that has no asynchronous origin — so it
 * is safe to call on any signal regardless of how it was constructed.
 *
 * This is a utility rather than a method because asynchrony is an origin, not a shape:
 * a single value, a keyed sequence, and a keyed record can all be derived asynchronously.
 *
 * @since 1.5.0
 * @param signal - Any signal
 * @returns True if an asynchronous computation is in progress
 *
 * @example
 * ```ts
 * const users = deriveList(fetchUsers, { initial: [] })
 * createEffect(() => {
 *   if (isPending(users)) return showSpinner()
 *   renderRows(users.get())
 * })
 * ```
 */
function isPending(signal: unknown): boolean {
	return getAsyncSource(signal)?.isPending() ?? false
}

/**
 * Cancels the in-flight asynchronous computation behind a signal.
 * No-op for a signal that has no asynchronous origin.
 *
 * @since 1.5.0
 * @param signal - Any signal
 */
function abort(signal: unknown): void {
	getAsyncSource(signal)?.abort()
}

export {
	abort,
	activeOwner,
	activeSink,
	batch,
	batchDepth,
	type Cleanup,
	type ComputedOptions,
	createScope,
	DEEP_EQUALITY,
	DEFAULT_EQUALITY,
	type EffectCallback,
	type EffectNode,
	FLAG_CHECK,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RELINK,
	flush,
	isEqual,
	isPending,
	link,
	type MaybeCleanup,
	type MemoCallback,
	type MemoNode,
	makeSubscribe,
	type PendingSource,
	propagate,
	refresh,
	refreshComposite,
	registerAsyncSource,
	registerCleanup,
	runCleanup,
	runEffect,
	type Scope,
	type ScopeOptions,
	type Signal,
	type SignalOptions,
	type SinkNode,
	SKIP_EQUALITY,
	type StateNode,
	scheduleEffect,
	setState,
	type TaskCallback,
	type TaskNode,
	TYPE_COLLECTION,
	TYPE_LIST,
	TYPE_MEMO,
	TYPE_SENSOR,
	TYPE_SLOT,
	TYPE_STATE,
	TYPE_STORE,
	TYPE_TASK,
	trimSources,
	unlink,
	unown,
	untrack,
}
