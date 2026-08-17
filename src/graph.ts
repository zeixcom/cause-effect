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
		fn: (prev: T, abortSignal: AbortSignal) => Promise<T>
		pendingNode: StateNode<boolean>
		/**
		 * The task recompute, assigned by `createTask`. Stored on the node so
		 * `refresh()` stays shape-agnostic: the recompute (and its
		 * AbortController) is defined in `nodes/task.ts` and tree-shakes out
		 * of a bundle that never imports `createTask` (ADR-0018 §5).
		 */
		recompute: (node: TaskNode<unknown & {}>) => void
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

// `Cell` and `MutableCell` — the single-value value types — live in
// `nodes/cell.ts` alongside the façades and guards, matching the one-file-
// per-shape layout of `nodes/list.ts` and `nodes/store.ts`.

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

/**
 * Setup callback for the external-push origin: the seed-input form of
 * `deriveSignal` and the `watched` option of `createSensor`. Runs when the
 * signal becomes watched and receives an `emit` function that pushes a new
 * value into the graph.
 *
 * @template T - The type of value the signal holds
 * @param emit - Pushes a new value and propagates the change to sinks
 * @returns A cleanup function that runs when the signal is no longer watched
 */
type SignalCallback<T extends {}> = (emit: (next: T) => void) => Cleanup

/**
 * Options for the single-value derive family: `deriveSignal` with a function
 * input, and the narrow factories `createMemo` and `createTask`. `initial`
 * seeds an async derivation (or the reducer pattern's starting value). See
 * ADR-0018.
 *
 * The external-push form — `deriveSignal(seed, { watched })` and `createSensor` —
 * takes the same members but a `watched` of type `SignalCallback`; it is spelled
 * as an inline intersection at those signatures, because a union of the two
 * `watched` shapes here would break contextual typing of inline callbacks.
 *
 * @template T - The type of value the signal holds
 */
type DeriveSignalOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Initial value. For an async derivation, the optional escape from
	 * `UnsetSignalValueError` before the first resolution. For the narrow
	 * factories, also the seed for reducer patterns.
	 */
	initial?: T

	/**
	 * An invalidation callback, as on `createMemo` and `createTask`: invoked
	 * when the signal is first watched by an effect, receives an `invalidate`
	 * function that marks the signal dirty, and must return a cleanup function
	 * that runs when the signal is no longer watched. This enables lazy
	 * resource activation for computations that also react to external events
	 * (e.g. DOM mutations, timers).
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
 * @param abortSignal - An AbortSignal that aborts when the task is cancelled
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (
	prev: T | undefined,
	abortSignal: AbortSignal,
) => Promise<T>

/**
 * A callback function for effects that can perform side effects.
 *
 * @returns An optional cleanup function that runs before the next run and on disposal
 */
type EffectCallback = () => MaybeCleanup

/* === Constants === */

const TYPE_CELL = 'Cell'
const TYPE_LIST = 'List'
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
 * Sets the active sink and returns the previous one. `activeSink` is a live
 * binding writable only inside this module; recomputation paths defined in the
 * node modules (e.g. the task recompute in `nodes/task.ts`) restore the
 * previous sink through this swap.
 */
function swapActiveSink(node: SinkNode | null): SinkNode | null {
	const prev = activeSink
	activeSink = node
	return prev
}

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
 * const el = createSensor<HTMLElement>({
 *   watched: (emit) => {
 *     const node = document.getElementById('box')!
 *     emit(node);
 *     const obs = new MutationObserver(() => emit(node));
 *     obs.observe(node, { attributes: true });
 *     return () => obs.disconnect();
 *   },
 *   initial: node,
 *   equals: SKIP_EQUALITY,
 * });
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
		if (next instanceof Promise) throw new PromiseValueError(TYPE_CELL)
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
		throw new CircularDependencyError('value' in node ? TYPE_CELL : 'Effect')
	}

	if (node.flags & FLAG_DIRTY) {
		// Tasks dispatch through the recompute stored on the node by
		// `createTask`, so this module holds no reference to the task
		// recompute path — a sync-only bundle drops it (ADR-0018 §5).
		if ('recompute' in node) node.recompute(node)
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
 * The async capabilities a signal may carry. An asynchronously derived `Signal` registers
 * its own controller here; a composite derived from an async source registers that source
 * instead. See ADR-0018 §2.
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
	createScope,
	DEEP_EQUALITY,
	DEFAULT_EQUALITY,
	type DeriveSignalOptions,
	type EffectCallback,
	type EffectNode,
	FLAG_CHECK,
	FLAG_CLEAN,
	FLAG_DIRTY,
	FLAG_RELINK,
	FLAG_RUNNING,
	flush,
	getAsyncSource,
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
	type SignalCallback,
	type SignalOptions,
	type SinkNode,
	SKIP_EQUALITY,
	type StateNode,
	scheduleEffect,
	setState,
	swapActiveSink,
	type TaskCallback,
	type TaskNode,
	TYPE_CELL,
	TYPE_LIST,
	TYPE_SLOT,
	TYPE_STORE,
	trimSources,
	unlink,
	unown,
	untrack,
}
