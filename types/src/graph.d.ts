import { type Guard } from './errors';
type SourceFields<T extends {}> = {
    value: T;
    sinks: Edge | null;
    sinksTail: Edge | null;
    stop?: Cleanup;
};
type OptionsFields<T extends {}> = {
    equals: (a: T, b: T) => boolean;
    guard?: Guard<T>;
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
    fn: (prev: T, abort: AbortSignal) => Promise<T>;
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
    get(): T;
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
     * If provided, will throw an error if an invalid value is set.
     */
    guard?: Guard<T>;
    /**
     * Optional custom equality function.
     * Used to determine if a new value is different from the old value.
     * Defaults to reference equality (===).
     */
    equals?: (a: T, b: T) => boolean;
};
type ComputedOptions<T extends {}> = SignalOptions<T> & {
    /**
     * Optional initial value.
     * Useful for reducer patterns so that calculations start with a value of correct type.
     */
    value?: T;
    /**
     * Optional callback invoked when the signal is first watched by an effect.
     * Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
     * Must return a cleanup function that is called when the signal is no longer watched.
     *
     * This enables lazy resource activation for computed signals that need to
     * react to external events (e.g. DOM mutations, timers) in addition to
     * tracked signal dependencies.
     */
    watched?: (invalidate: () => void) => Cleanup;
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
 * @param signal - An AbortSignal that will be triggered if the task is aborted
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (prev: T | undefined, signal: AbortSignal) => Promise<T>;
/**
 * A callback function for effects that can perform side effects.
 *
 * @returns An optional cleanup function that will be called before the effect re-runs or is disposed
 */
type EffectCallback = () => MaybeCleanup;
declare const TYPE_STATE = "State";
declare const TYPE_MEMO = "Memo";
declare const TYPE_TASK = "Task";
declare const TYPE_SENSOR = "Sensor";
declare const TYPE_LIST = "List";
declare const TYPE_COLLECTION = "Collection";
declare const TYPE_STORE = "Store";
declare const FLAG_CLEAN = 0;
declare const FLAG_DIRTY: number;
declare const FLAG_RELINK: number;
declare let activeSink: SinkNode | null;
declare let activeOwner: OwnerNode | null;
declare let batchDepth: number;
declare const DEFAULT_EQUALITY: <T extends {}>(a: T, b: T) => boolean;
/**
 * Equality function that always returns false, causing propagation on every update.
 * Use with `createSensor` for observing mutable objects where the reference stays the same
 * but internal state changes (e.g., DOM elements observed via MutationObserver).
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
declare const SKIP_EQUALITY: (_a?: unknown, _b?: unknown) => boolean;
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
declare function batch(fn: () => void): void;
/**
 * Runs a callback without tracking dependencies.
 * Any signal reads inside the callback will not create edges to the current active sink.
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
 */
declare function createScope(fn: () => MaybeCleanup): Cleanup;
export { type Cleanup, type ComputedOptions, type EffectCallback, type EffectNode, type MaybeCleanup, type MemoCallback, type MemoNode, type Scope, type Signal, type SignalOptions, type SinkNode, type StateNode, type TaskCallback, type TaskNode, activeOwner, activeSink, batch, batchDepth, createScope, DEFAULT_EQUALITY, SKIP_EQUALITY, FLAG_CLEAN, FLAG_DIRTY, FLAG_RELINK, flush, link, propagate, refresh, registerCleanup, runCleanup, runEffect, setState, trimSources, TYPE_COLLECTION, TYPE_LIST, TYPE_MEMO, TYPE_SENSOR, TYPE_STATE, TYPE_STORE, TYPE_TASK, unlink, untrack, };
