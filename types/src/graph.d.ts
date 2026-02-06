type SourceFields<T extends {}> = {
    value: T;
    sinks: Edge | null;
    sinksTail: Edge | null;
    stop?: Cleanup;
};
type OptionsFields<T extends {}> = {
    equals: (a: unknown, b: unknown) => boolean;
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
type RefNode<T extends {}> = SourceFields<T>;
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
type SourceNode = RefNode<unknown & {}>;
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
 * A type guard function that validates whether an unknown value is of type T.
 * Used to ensure type safety when updating signals.
 *
 * @template T - The type to guard against
 * @param value - The value to check
 * @returns True if the value is of type T
 */
type Guard<T extends {}> = (value: unknown) => value is T;
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
    equals?: (a: unknown, b: unknown) => boolean;
};
type ComputedOptions<T extends {}> = SignalOptions<T> & {
    /**
     * Optional initial value.
     * Useful for reducer patterns so that calculations start with a value of correct type.
     */
    value?: T;
};
/**
 * A callback function for memos that computes a value based on the previous value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @returns The new computed value
 */
type MemoCallback<T extends {}> = (prev: T) => T;
/**
 * A callback function for tasks that asynchronously computes a value.
 *
 * @template T - The type of value computed
 * @param prev - The previous computed value
 * @param signal - An AbortSignal that will be triggered if the task is aborted
 * @returns A promise that resolves to the new computed value
 */
type TaskCallback<T extends {}> = (prev: T, signal: AbortSignal) => Promise<T>;
/**
 * A callback function for effects that can perform side effects.
 *
 * @param match - A function to register cleanup callbacks that will be called before the effect re-runs or is disposed
 */
type EffectCallback = () => MaybeCleanup;
declare const TYPE_STATE = "State";
declare const TYPE_MEMO = "Memo";
declare const TYPE_TASK = "Task";
declare const FLAG_CLEAN = 0;
declare const FLAG_DIRTY: number;
declare let activeSink: SinkNode | null;
declare let activeOwner: OwnerNode | null;
declare let batchDepth: number;
declare const defaultEquals: (a: unknown, b: unknown) => boolean;
declare const link: (source: SourceNode, sink: SinkNode) => void;
declare const unlink: (edge: Edge) => Edge | null;
declare const trimSources: (node: SinkNode) => void;
declare const propagate: (node: SinkNode, newFlag?: number) => void;
declare const setState: <T extends {}>(node: StateNode<T>, next: T) => void;
declare const registerCleanup: (owner: OwnerNode, fn: Cleanup) => void;
declare const runCleanup: (owner: OwnerNode) => void;
declare const runEffect: (node: EffectNode) => void;
declare const refresh: (node: SinkNode) => void;
declare const flush: () => void;
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
declare const batch: (fn: () => void) => void;
/**
 * Creates a new ownership scope for managing cleanup of nested effects and resources.
 * All effects created within the scope will be automatically disposed when the scope is disposed.
 * Scopes can be nested - disposing a parent scope disposes all child scopes.
 *
 * @template T - The type of value returned by the scope function
 * @param fn - The function to execute within the scope, receives an onCleanup callback
 * @returns A tuple of [result, dispose] where result is the return value of fn and dispose cleans up the scope
 *
 * @example
 * ```ts
 * const [value, dispose] = createScope((onCleanup) => {
 *   const count = createState(0);
 *
 *   createEffect(() => {
 *     console.log(count.get());
 *   });
 *
 *   onCleanup(() => console.log('Scope disposed'));
 *
 *   return count;
 * });
 *
 * dispose(); // Cleans up the effect and runs cleanup callbacks
 * ```
 *
 * @example
 * ```ts
 * // Nested scopes
 * const [outer, disposeOuter] = createScope(() => {
 *   const [inner, disposeInner] = createScope(() => {
 *     // ...
 *   });
 *   // disposeOuter() will also dispose inner scope
 * });
 * ```
 */
declare const createScope: <T>(fn: (onCleanup: (fn: Cleanup) => void) => T) => [T, Cleanup];
declare const validateSignalValue: <T extends {}>(where: string, value: unknown, guard?: Guard<T>) => void;
declare const validateCallback: (where: string, value: unknown, guard?: (value: unknown) => boolean) => void;
/**
 * Error thrown on re-entrance on an already running function.
 */
declare class CircularDependencyError extends Error {
    /**
     * Constructs a new CircularDependencyError.
     *
     * @param where - The location where the error occurred.
     */
    constructor(where: string);
}
/**
 * Error thrown when a signal value is invalid.
 */
declare class InvalidSignalValueError extends TypeError {
    /**
     * Constructs a new InvalidSignalValueError.
     *
     * @param where - The location where the error occurred.
     * @param value - The invalid value.
     */
    constructor(where: string, value: unknown);
}
/**
 * Error thrown when a callback is invalid.
 */
declare class InvalidCallbackError extends TypeError {
    /**
     * Constructs a new InvalidCallbackError.
     *
     * @param where - The location where the error occurred.
     * @param value - The invalid value.
     */
    constructor(where: string, value: unknown);
}
export { type Cleanup, type ComputedOptions, type EffectCallback, type EffectNode, type Guard, type MaybeCleanup, type MemoCallback, type MemoNode, type RefNode, type Scope, type Signal, type SignalOptions, type SinkNode, type StateNode, type TaskCallback, type TaskNode, activeOwner, activeSink, batch, batchDepth, CircularDependencyError, createScope, defaultEquals, FLAG_CLEAN, FLAG_DIRTY, flush, InvalidCallbackError, InvalidSignalValueError, link, propagate, refresh, registerCleanup, runCleanup, runEffect, setState, trimSources, TYPE_MEMO, TYPE_STATE, TYPE_TASK, unlink, validateSignalValue, validateCallback, };
