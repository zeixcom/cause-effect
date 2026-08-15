import { type Guard } from './errors';
type SourceFields<T extends {}> = {
    value: T;
    sinks: Edge | null;
    sinksTail: Edge | null;
    stop?: Cleanup | undefined;
};
type OptionsFields<T extends {}> = {
    equals: (a: T, b: T) => boolean;
    guard?: Guard<T> | undefined;
};
type SinkFields = {
    fn: unknown;
    flags: number;
    sources: Edge | null;
    sourcesTail: Edge | null;
};
type OwnerFields = {
    cleanup: Cleanup | Cleanup[] | null;
};
type AsyncFields = {
    controller: AbortController | undefined;
    error: Error | undefined;
};
type StateNode<T extends {}> = SourceFields<T> & OptionsFields<T>;
type MemoNode<T extends {}> = SourceFields<T> & OptionsFields<T> & SinkFields & {
    fn: MemoCallback<T>;
    error: Error | undefined;
};
type TaskNode<T extends {}> = SourceFields<T> & OptionsFields<T> & SinkFields & AsyncFields & {
    fn: (prev: T, abortSignal: AbortSignal) => Promise<T>;
    pendingNode: StateNode<boolean>;
};
type EffectNode = SinkFields & OwnerFields & {
    fn: EffectCallback;
};
type Scope = OwnerFields;
type SourceNode = SourceFields<unknown & {}>;
type SinkNode = MemoNode<unknown & {}> | TaskNode<unknown & {}> | EffectNode;
type OwnerNode = EffectNode | Scope;
type Edge = {
    source: SourceNode;
    sink: SinkNode;
    nextSource: Edge | null;
    prevSink: Edge | null;
    nextSink: Edge | null;
};
type Signal<T extends {}> = {
    readonly [Symbol.toStringTag]?: string;
    get(): T;
};
/**
 * A readable and writable single-value signal.
 * The complete value-type set is `Signal`/`MutableSignal`, `List`/`MutableList`, and
 * `Store`/`MutableStore` — indexed by shape and mutability, not by origin. See ADR-0018.
 *
 * @template T - The type of value held by the signal
 */
type MutableSignal<T extends {}> = Signal<T> & {
    set(value: T): void;
    update(callback: (value: T) => T): void;
};
/**
 * A cleanup function that can be called to dispose of resources.
 */
type Cleanup = () => void;
type MaybeCleanup = Cleanup | undefined | void;
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
    guard?: Guard<T>;
    /**
     * Optional custom equality function.
     * Used to determine if a new value is different from the old value.
     * Defaults to reference equality (===). When equal, propagation stops for
     * this signal's entire downstream subtree, not just this signal.
     */
    equals?: (a: T, b: T) => boolean;
};
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
type SignalCallback<T extends {}> = (emit: (next: T) => void) => Cleanup;
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
    initial?: T;
    /**
     * An invalidation callback, as on `createMemo` and `createTask`: invoked
     * when the signal is first watched by an effect, receives an `invalidate`
     * function that marks the signal dirty, and must return a cleanup function
     * that runs when the signal is no longer watched. This enables lazy
     * resource activation for computations that also react to external events
     * (e.g. DOM mutations, timers).
     */
    watched?: (invalidate: () => void) => Cleanup;
};
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
    root?: boolean;
};
/**
 * A callback function for memos that computes a value based on the previous value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @returns The new computed value
 */
type MemoCallback<T extends {}> = (prev: T | undefined) => T;
/**
 * A callback function for tasks that asynchronously computes a value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @param abortSignal - An AbortSignal that aborts when the task is cancelled
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (prev: T | undefined, abortSignal: AbortSignal) => Promise<T>;
/**
 * A callback function for effects that can perform side effects.
 *
 * @returns An optional cleanup function that runs before the next run and on disposal
 */
type EffectCallback = () => MaybeCleanup;
declare const TYPE_SIGNAL = "Signal";
declare const TYPE_LIST = "List";
declare const TYPE_STORE = "Store";
declare const TYPE_SLOT = "Slot";
declare const FLAG_CLEAN = 0;
declare const FLAG_CHECK: number;
declare const FLAG_DIRTY: number;
declare const FLAG_RELINK: number;
declare let activeSink: SinkNode | null;
declare let activeOwner: OwnerNode | null;
declare let batchDepth: number;
/**
 * Default strict equality (`===`) — identical to the implicit default for all signals.
 * Pass explicitly to make the equality strategy visible when composing or overriding signal options.
 */
declare const DEFAULT_EQUALITY: <T extends {}>(a: T, b: T) => boolean;
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
declare const SKIP_EQUALITY: (_a?: unknown, _b?: unknown) => boolean;
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
declare const DEEP_EQUALITY: <T extends {}>(a: T, b: T) => boolean;
declare function link(source: SourceNode, sink: SinkNode): void;
declare function unlink(edge: Edge): Edge | null;
declare function trimSources(node: SinkNode): void;
declare function propagate(node: SinkNode, newFlag?: number): void;
declare function setState<T extends {}>(node: StateNode<T>, next: T): void;
declare function registerCleanup(owner: OwnerNode, fn: Cleanup): void;
declare function runCleanup(owner: OwnerNode): void;
declare function runEffect(node: EffectNode): void;
declare function refresh(node: SinkNode): void;
declare function flush(): void;
/**
 * Enqueues an effect that is still dirty after it ran, because it wrote to its own
 * dependencies. Outside a batch, flushes until the graph converges.
 */
declare function scheduleEffect(node: EffectNode): void;
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
declare function batch(fn: () => void): void;
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
declare function untrack<T>(fn: () => T): T;
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
declare function createScope(fn: () => MaybeCleanup, options?: ScopeOptions): Cleanup;
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
declare function unown<T>(fn: () => T): T;
declare function makeSubscribe(node: SourceNode, onWatch?: () => Cleanup): () => void;
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
declare function refreshComposite<T extends {}>(node: MemoNode<T>, buildValue: () => T, discoversKeys?: boolean): void;
/**
 * The async capabilities a signal may carry. An asynchronously derived `Signal` registers
 * its own controller here; a composite derived from an async source registers that source
 * instead. See ADR-0018 §2.
 */
type PendingSource = {
    isPending(): boolean;
    abort(): void;
};
/** Associates a derived composite with the async source that drives it. */
declare function registerAsyncSource(signal: object, source: PendingSource): void;
/** Resolves the async capabilities of a signal, if it has any. */
declare function getAsyncSource(signal: unknown): PendingSource | undefined;
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
declare function isPending(signal: unknown): boolean;
/**
 * Cancels the in-flight asynchronous computation behind a signal.
 * No-op for a signal that has no asynchronous origin.
 *
 * @since 1.5.0
 * @param signal - Any signal
 */
declare function abort(signal: unknown): void;
export { abort, activeOwner, activeSink, batch, batchDepth, type Cleanup, createScope, DEEP_EQUALITY, DEFAULT_EQUALITY, type DeriveSignalOptions, type EffectCallback, type EffectNode, FLAG_CHECK, FLAG_CLEAN, FLAG_DIRTY, FLAG_RELINK, flush, getAsyncSource, isPending, link, type MaybeCleanup, type MemoCallback, type MemoNode, type MutableSignal, makeSubscribe, type PendingSource, propagate, refresh, refreshComposite, registerAsyncSource, registerCleanup, runCleanup, runEffect, type Scope, type ScopeOptions, type Signal, type SignalCallback, type SignalOptions, type SinkNode, SKIP_EQUALITY, type StateNode, scheduleEffect, setState, type TaskCallback, type TaskNode, TYPE_LIST, TYPE_SIGNAL, TYPE_SLOT, TYPE_STORE, trimSources, unlink, unown, untrack, };
