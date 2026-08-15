import { type Cleanup, type Signal } from '../graph';
import { type KeyConfig, type List } from './list';
/**
 * A source `deriveCollection` can key and derive from.
 *
 * A `List` (mutable or readonly) is already keyed, and its stable keys are used directly.
 * Any other `Signal<T[]>` — a synchronous derivation, an asynchronous derivation, an external
 * push, a `Slot` — is keyed on read by the adapter, which is what lets an asynchronous array
 * become a keyed collection.
 *
 * @template T - The type of items in the source
 */
type CollectionSource<T extends {}> = List<T> | Signal<T[]>;
/**
 * Configuration options for `deriveCollection`.
 *
 * Both options apply only when the source is a plain `Signal<T[]>`. A `List` or
 * readonly `List` source carries its own keys and item equality already.
 *
 * @template T - The type of items in the source
 */
type DeriveCollectionOptions<T extends {}> = {
    /** Key generation strategy for an unkeyed source. See `KeyConfig`. Defaults to positional keys. */
    keyConfig?: KeyConfig<T>;
    /** Equality function for adapted per-item signals. Defaults to deep equality. */
    itemEquals?: (a: T, b: T) => boolean;
};
/**
 * Configuration options for `deriveList`.
 *
 * @template T - The type of items in the derived sequence
 */
type DeriveListOptions<T extends {}> = DeriveCollectionOptions<T> & {
    /** Seed value for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
    initial?: T[];
    /** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
    watched?: CollectionCallback<T>;
    /** Factory for per-item signals in the external-push form. Defaults to `createState`. */
    createItem?: (value: T) => Signal<T>;
};
/**
 * Transformation callback for `deriveCollection`, either sync or async.
 * A sync callback produces a `Signal<T>` per item. An async callback produces an
 * asynchronously derived `Signal<T>` per item, which cancels when the source item changes.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type DeriveCollectionCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
/**
 * Granular mutation descriptor passed to the `applyChanges` callback inside a `CollectionCallback`.
 *
 * @template T - The type of items in the collection
 */
type CollectionChanges<T> = {
    /** Items to add. Each item is assigned a new key via the configured `keyConfig`. */
    add?: T[];
    /** Items whose values have changed. Matched to existing entries by key. */
    change?: T[];
    /** Items to remove. Matched to existing entries by key. */
    remove?: T[];
};
/**
 * Configuration options for `createCollection`.
 *
 * @template T - The type of items in the collection
 */
type CollectionOptions<T extends {}, S extends Signal<T> = Signal<T>> = {
    /** Initial items. Defaults to `[]`. */
    value?: T[];
    /** Key generation strategy. See `KeyConfig`. Defaults to auto-increment. */
    keyConfig?: KeyConfig<T>;
    /** Factory for per-item signals. Defaults to `createState`. */
    createItem?: (value: T) => S;
    /** Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided. */
    itemEquals?: (a: T, b: T) => boolean;
};
/**
 * Setup callback for `createCollection`. Runs when the collection becomes watched.
 * Receives an `applyChanges` function to push granular mutations into the graph.
 *
 * @template T - The type of items in the collection
 * @param apply - Call with a `CollectionChanges` object to add, update, or remove items
 * @returns A cleanup function that runs when the collection is no longer watched
 */
type CollectionCallback<T extends {}> = (apply: (changes: CollectionChanges<T>) => void) => Cleanup;
/**
 * Creates a derived List from a List, with per-item memoization.
 * A sync callback creates a Signal per item. An async callback creates an asynchronously
 * derived Signal per item. The node reads the source keys, so a structural change propagates.
 *
 * A `List` source is used directly, keeping its stable keys. Any other `Signal<U[]>` is keyed
 * on read — see `keyedAdapter`. This is what lets an asynchronously derived array become a
 * keyed sequence without an intermediate effect.
 *
 * @since 0.18.0
 * @param source - The source to derive from: a List, or any `Signal<U[]>`
 * @param callback - Transformation function applied to each item
 * @param options - Key generation and item equality. Applies only to an unkeyed source.
 * @returns A List signal
 */
declare function deriveCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U) => T, options?: DeriveCollectionOptions<U>): List<T>;
declare function deriveCollection<T extends {}, U extends {}>(source: CollectionSource<U>, callback: (sourceValue: U, abort: AbortSignal) => Promise<T>, options?: DeriveCollectionOptions<U>): List<T>;
/**
 * Creates an externally-driven List with a watched lifecycle.
 *
 * The watched callback receives an `applyChanges(changes)` helper to manage items. The
 * collection activates when an effect first reads it, and deactivates when it is no longer
 * watched. A structural mutation through `applyChanges` does not restart that lifecycle.
 *
 * @deprecated Use `deriveList(seed, { watched })` — the external-push form of `deriveList`
 * replaces this factory in v2.0. The seed takes the place of the `value` option; every other
 * option carries over unchanged.
 *
 * @since 0.18.0
 * @param watched - Callback that runs when the collection becomes watched. Receives the applyChanges helper.
 * @param options - Optional configuration including initial value, key generation, and item signal creation
 * @returns A read-only List signal
 */
declare function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(watched: CollectionCallback<T>, options?: CollectionOptions<T, S>): List<T, S>;
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
 * const users = deriveList(async (_prev, abort) => {
 *   const res = await fetch(`/api/users?q=${query.get()}`, { signal: abort })
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
declare function deriveList<T extends {}>(input: (prev: T[], abort: AbortSignal) => Promise<T[]>, options: DeriveListOptions<T> & {
    initial: T[];
}): List<T>;
declare function deriveList<T extends {}>(input: T[], options: DeriveListOptions<T> & {
    watched: CollectionCallback<T>;
}): List<T>;
declare function deriveList<T extends {}, U extends {}>(input: CollectionSource<U>, itemCallback: (sourceValue: U) => T, options?: DeriveCollectionOptions<U>): List<T>;
declare function deriveList<T extends {}, U extends {}>(input: CollectionSource<U>, itemCallback: (sourceValue: U, abort: AbortSignal) => Promise<T>, options?: DeriveCollectionOptions<U>): List<T>;
export { type CollectionCallback, type CollectionChanges, type CollectionOptions, type CollectionSource, createCollection, type DeriveCollectionCallback, type DeriveCollectionOptions, type DeriveListOptions, deriveCollection, deriveList, };
