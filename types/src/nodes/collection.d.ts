import { type Cleanup, type Signal } from '../graph';
import { type KeyConfig, type MutableList } from './list';
/**
 * A source `deriveList`/`deriveCollection` can key and derive from.
 *
 * A `MutableList` or `DerivedList` is already keyed, and its stable keys are used directly.
 * Any other `Signal<T[]>` — a `Memo`, a `Task`, a `State`, a `Slot` — is keyed on read
 * by the adapter, which is what lets an asynchronous array become a keyed collection.
 *
 * The name this type carries toward v2.0 — terminal vocabulary, unlike `DerivedList`, which
 * renames again at that boundary. `CollectionSource` is a deprecated alias of it.
 *
 * @template T - The type of items in the source
 */
type ListSource<T extends {}> = MutableList<T> | DerivedList<T> | Signal<T[]>;
/**
 * A source `deriveCollection` can key and derive from, under its v1 name.
 *
 * @deprecated `CollectionSource` is removed in v2.0 — use `ListSource` instead (same type, same
 * behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the source
 */
type CollectionSource<T extends {}> = ListSource<T>;
/**
 * Configuration options for `deriveList`.
 *
 * `keyConfig` and `itemEquals` apply only when the source is a plain `Signal<T[]>` — a `List`
 * or `Collection` source carries its own keys and item equality already. Folds what 1.x split
 * across `DeriveCollectionOptions` and `DeriveListOptions` into one shape, matching v2.0.
 *
 * @template T - The type of items in the derived sequence
 */
type DeriveListOptions<T extends {}> = {
    /** Key generation strategy for an unkeyed source. See `KeyConfig`. Defaults to positional keys. */
    keyConfig?: KeyConfig<T>;
    /** Equality function for adapted per-item signals. Defaults to deep equality. */
    itemEquals?: (a: T, b: T) => boolean;
    /** Seed value for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
    initial?: T[];
    /** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
    watched?: ListCallback<T>;
    /** Factory for per-item signals in the external-push form. Defaults to `createState`. */
    createItem?: (value: T) => Signal<T>;
};
/**
 * Configuration options for `deriveCollection`'s unkeyed-source case, under their v1 name.
 *
 * @deprecated Folded into `DeriveListOptions` in v2.0 — no separate name survives. Use
 * `DeriveListOptions` instead (same fields, plus `initial`/`watched`/`createItem`, all
 * optional). See [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and
 * `MIGRATION-2.0.md`.
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
 * Transformation callback for the per-item derivation, either sync or async.
 * A sync callback produces a `Memo<T>` per item. An async callback produces a `Task<T>`
 * per item, which cancels when the source item changes.
 *
 * The name this type carries toward v2.0 — terminal vocabulary. `DeriveCollectionCallback`
 * is a deprecated alias of it.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type PerItemCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abort: AbortSignal) => Promise<T>);
/**
 * Transformation callback for `deriveCollection`, under its v1 name.
 *
 * @deprecated `DeriveCollectionCallback` is removed in v2.0 — use `PerItemCallback` instead
 * (same type, same behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type DeriveCollectionCallback<T extends {}, U extends {}> = PerItemCallback<T, U>;
/**
 * A read-only reactive keyed sequence with per-item reactivity.
 * `deriveList()` returns one — from a computation, a seed with a watched lifecycle, or another
 * source derived per item. `.deriveCollection()` on a `MutableList` or a `DerivedList` creates
 * a derived one too.
 *
 * The name this type carries toward v2.0, where it becomes the readonly base `List`.
 * `Collection` is a deprecated alias of it.
 *
 * @template T - The type of items in the sequence
 */
type DerivedList<T extends {}, S extends Signal<T> = Signal<T>> = {
    readonly [Symbol.toStringTag]: 'Collection';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<S>;
    keys(): IterableIterator<string>;
    get(): T[];
    at(index: number): S | undefined;
    byKey(key: string): S | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    /**
     * @deprecated Use the top-level `deriveList(source, itemFn)` instead —
     * `users.deriveCollection(f)` becomes `deriveList(users, f)`. Both `.deriveCollection()`
     * forms are removed in v2.0. See `MIGRATION-2.0.md`.
     */
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): DerivedList<R>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): DerivedList<R>;
    readonly length: number;
};
/**
 * The read-only keyed-sequence type, under its v1 name.
 *
 * @deprecated `Collection` is removed in v2.0 — use `DerivedList` (same type, same behavior
 * today). In v2.0, the readonly base is named `List`. See
 * [ADR-0018](../../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type Collection<T extends {}, S extends Signal<T> = Signal<T>> = DerivedList<T, S>;
/**
 * Granular mutation descriptor passed to the `applyChanges` callback inside a `ListCallback`.
 *
 * The name this type carries toward v2.0 — terminal vocabulary. `CollectionChanges` is a
 * deprecated alias of it.
 *
 * @template T - The type of items in the collection
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
 * Granular mutation descriptor, under its v1 name.
 *
 * @deprecated `CollectionChanges` is removed in v2.0 — use `ListChanges` instead (same type,
 * same behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type CollectionChanges<T> = ListChanges<T>;
/**
 * Configuration options for `createCollection`.
 *
 * @deprecated `createCollection` is deprecated in favor of `deriveList(seed, { watched, ... })`
 * — this options type goes with it. Removed in v2.0, folded into `deriveList`'s own options
 * shape. See [MIGRATION-2.0.md](../../MIGRATION-2.0.md).
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
 * Setup callback for the external-push origin: `createCollection` and the seed-array form
 * of `deriveList`. Runs when the sequence becomes watched. Receives an `applyChanges`
 * function to push granular mutations into the graph.
 *
 * The name this type carries toward v2.0 — terminal vocabulary. `CollectionCallback` is a
 * deprecated alias of it.
 *
 * @template T - The type of items in the collection
 * @param apply - Call with a `ListChanges` object to add, update, or remove items
 * @returns A cleanup function that runs when the sequence is no longer watched
 */
type ListCallback<T extends {}> = (apply: (changes: ListChanges<T>) => void) => Cleanup;
/**
 * Setup callback for `createCollection`, under its v1 name.
 *
 * @deprecated `CollectionCallback` is removed in v2.0 — use `ListCallback` instead (same type,
 * same behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type CollectionCallback<T extends {}> = ListCallback<T>;
/**
 * Creates a derived Collection from a List or another Collection, with per-item memoization.
 * A sync callback creates a Memo per item. An async callback creates a Task per item.
 * The node reads the source keys, so a structural change propagates.
 *
 * A `List` or `Collection` source is used directly, keeping its stable keys. Any other
 * `Signal<U[]>` is keyed on read — see `keyedAdapter`. This is what lets an asynchronous
 * array (`Task<U[]>`) become a keyed collection without an intermediate effect.
 *
 * @param source - The source to derive from: a List, a Collection, or any `Signal<U[]>`
 * @param callback - Transformation function applied to each item
 * @param options - Key generation and item equality. Applies only to an unkeyed source.
 * @returns A Collection signal
 */
declare function deriveCollection<T extends {}, U extends {}>(source: ListSource<U>, callback: (sourceValue: U) => T, options?: DeriveListOptions<U>): DerivedList<T>;
declare function deriveCollection<T extends {}, U extends {}>(source: ListSource<U>, callback: (sourceValue: U, abort: AbortSignal) => Promise<T>, options?: DeriveListOptions<U>): DerivedList<T>;
/**
 * Creates an externally-driven Collection with a watched lifecycle.
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
 * @returns A read-only Collection signal
 */
declare function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(watched: ListCallback<T>, options?: CollectionOptions<T, S>): DerivedList<T, S>;
/**
 * Creates a read-only keyed sequence from any origin.
 *
 * The origin follows from `input`, so one factory covers every way a keyed sequence can
 * come to exist. A derived sequence has no mutators — the returned `Collection` is the
 * read-only shape — which is what makes an imperative write from inside an effect a
 * compile error rather than a convention.
 *
 * | `input` | `options` | Origin |
 * |---|---|---|
 * | sync function | — | Synchronous derivation |
 * | async function | `initial` required | Asynchronous derivation |
 * | array | `watched` required | External push |
 * | `Signal<U[]>`, `List`, or `Collection` + item function | — | Per-item derivation |
 *
 * @since 1.5.0
 * @param input - A computation, a seed array, or a source signal to derive per item from
 * @param itemOrOptions - The per-item callback for a source input, otherwise the options
 * @param maybeOptions - Options, when a per-item callback is given
 * @returns A read-only Collection signal
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
declare function deriveList<T extends {}>(input: () => T[], options?: DeriveListOptions<T>): DerivedList<T>;
declare function deriveList<T extends {}>(input: (prev: T[], abort: AbortSignal) => Promise<T[]>, options: DeriveListOptions<T> & {
    initial: T[];
}): DerivedList<T>;
declare function deriveList<T extends {}>(input: T[], options: DeriveListOptions<T> & {
    watched: ListCallback<T>;
}): DerivedList<T>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U) => T, options?: DeriveListOptions<U>): DerivedList<T>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U, abort: AbortSignal) => Promise<T>, options?: DeriveListOptions<U>): DerivedList<T>;
/**
 * Checks if a value is a read-only derived List signal.
 *
 * The name this guard carries toward v2.0, where it becomes `isList`.
 * `isCollection` is a deprecated alias of it.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a read-only derived List
 */
declare function isDerivedList<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is DerivedList<T, S>;
/**
 * Checks if a value is a Collection signal.
 *
 * @deprecated Use `isDerivedList` — in v2.0 the readonly base is named `List`, guarded by
 * `isList`.
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a Collection
 */
declare function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is Collection<T, S>;
export { type Collection, type CollectionCallback, type CollectionChanges, type CollectionOptions, type CollectionSource, createCollection, type DeriveCollectionCallback, type DeriveCollectionOptions, type DerivedList, type DeriveListOptions, deriveCollection, deriveList, isCollection, isDerivedList, type ListCallback, type ListChanges, type ListSource, type PerItemCallback, };
