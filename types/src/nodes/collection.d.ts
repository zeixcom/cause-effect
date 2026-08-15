import { type Cleanup, type Signal } from '../graph';
import { type KeyConfig, type List } from './list';
/**
 * A source `deriveList` can key and derive from.
 *
 * A `List` (mutable or readonly) is already keyed, and its stable keys are used directly.
 * Any other `Signal<T[]>` — a synchronous derivation, an asynchronous derivation, an external
 * push, a `Slot` — is keyed on read by the adapter, which is what lets an asynchronous array
 * become a keyed sequence.
 *
 * @template T - The type of items in the source
 */
type ListSource<T extends {}> = List<T> | Signal<T[]>;
/**
 * Configuration options for `deriveList`.
 *
 * `keyConfig` and `itemEquals` apply when the source is a plain `Signal<T[]>` or the input
 * is a seed array; a `List` source carries its own keys and item equality already.
 *
 * @template T - The type of items in the derived sequence
 * @template S - The item-signal type of the external-push form; inferred from `createItem`
 */
type DeriveListOptions<T extends {}, S extends Signal<T> = Signal<T>> = {
    /** Key generation strategy for an unkeyed source or the external-push form. See `KeyConfig`. Defaults to positional keys. */
    keyConfig?: KeyConfig<T>;
    /** Equality function for per-item signals. Defaults to deep equality. */
    itemEquals?: (a: T, b: T) => boolean;
    /** Initial items for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
    initial?: T[];
    /** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
    watched?: ListCallback<T>;
    /** Factory for per-item signals in the external-push form. Defaults to `createState`. */
    createItem?: (value: T) => S;
};
/**
 * Granular mutation descriptor passed to the `emit` callback inside a `ListCallback`.
 *
 * @template T - The type of items in the sequence
 */
type ListChanges<T> = {
    /** Items to add. Each item is assigned a new key via the configured `keyConfig`. */
    add?: T[];
    /** Items whose values have changed. Matched to existing entries by key. */
    change?: T[];
    /** Items to remove. Matched to existing entries by key. */
    remove?: T[];
};
/**
 * Setup callback for the external-push form of `deriveList`. Runs when the sequence
 * becomes watched. Receives an `emit` function to push granular mutations into the graph.
 *
 * @template T - The type of items in the sequence
 * @param emit - Call with a `ListChanges` object to add, update, or remove items
 * @returns A cleanup function that runs when the sequence is no longer watched
 */
type ListCallback<T extends {}> = (emit: (changes: ListChanges<T>) => void) => Cleanup;
/**
 * Creates a read-only keyed sequence from any origin.
 *
 * The origin follows from `input`, so one factory covers every way a keyed sequence can
 * come to exist. A derived sequence has no mutators — the returned `List` is the
 * read-only shape — which is what makes an imperative write from inside an effect a
 * compile error rather than a convention.
 *
 * | `input` | `options` | Origin |
 * |---|---|---|
 * | sync function | — | Synchronous derivation |
 * | async function | `initial` required | Asynchronous derivation |
 * | array | `watched` required | External push |
 * | `Signal<U[]>` or `List` + item function | — | Per-item derivation |
 *
 * @since 1.5.0
 * @param input - A computation, a seed array, or a source signal to derive per item from
 * @param itemOrOptions - The per-item callback for a source input, otherwise the options
 * @param maybeOptions - Options, when a per-item callback is given
 * @returns A read-only List signal
 *
 * @example
 * ```ts
 * // Previously impossible without an effect: an async array as a keyed sequence.
 * const users = deriveList(async (_prev, abortSignal) => {
 *   const res = await fetch(`/api/users?q=${query.get()}`, { signal: abortSignal })
 *   return res.json()
 * }, { initial: [], keyConfig: (u: User) => u.id })
 *
 * createEffect(() => {
 *   if (isPending(users)) return showSpinner()
 *   for (const user of users) renderRow(user)
 * })
 * ```
 */
declare function deriveList<T extends {}>(input: () => T[], options?: DeriveListOptions<T>): List<T>;
declare function deriveList<T extends {}>(input: (prev: T[], abortSignal: AbortSignal) => Promise<T[]>, options: DeriveListOptions<T> & {
    initial: T[];
}): List<T>;
declare function deriveList<T extends {}, S extends Signal<T> = Signal<T>>(input: T[], options: DeriveListOptions<T, S> & {
    watched: ListCallback<T>;
}): List<T, S>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U) => T, options?: DeriveListOptions<U>): List<T>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U, abortSignal: AbortSignal) => Promise<T>, options?: DeriveListOptions<U>): List<T>;
export { type DeriveListOptions, deriveList, type ListCallback, type ListChanges, type ListSource, };
