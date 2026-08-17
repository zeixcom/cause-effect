import { type Cleanup, TYPE_LIST } from '../graph';
import type { Cell, MutableCell, Signal } from './cell';
type UnknownRecord = Record<string, unknown>;
type DiffResult = {
    changed: boolean;
    add: UnknownRecord;
    change: UnknownRecord;
    remove: UnknownRecord;
};
/**
 * Key generation strategy for `createList` items.
 * A string value is used as a prefix for auto-incremented keys (`prefix0`, `prefix1`, …).
 * A function receives each item and returns a stable string key, or `undefined` to fall back to auto-increment.
 *
 * @template T - The type of items in the list
 */
type KeyConfig<T> = string | ((item: T) => string | undefined);
/**
 * The members `ListOptions` and `DeriveListOptions` share: how items are keyed,
 * compared, and turned into item signals. Private base — the two options types
 * differ in their `watched` (lifecycle-only on the mutable factory, external
 * push on the derive family), so they cannot extend one another.
 *
 * @template T - The type of items in the sequence
 * @template S - The item-signal type. Bound to the umbrella `Signal<T>`, not the narrow
 *   `Cell<T>` — `createItem` is an explicit, opt-in customization point, so a `Store`- or
 *   `List`-shaped item signal is legitimate here, unlike the accidental structural
 *   assignability ADR-0018 §1 closes elsewhere: a `List` is never structurally assignable to
 *   `Cell<T>` merely by having `get()`. See ADR-0018 and CE-011.
 */
type ItemSignalOptions<T extends {}, S extends Signal<T>> = {
    /** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
    keyConfig?: KeyConfig<T>;
    /** Equality function for item state signals. Defaults to `DEEP_EQUALITY`. */
    itemEquals?: (a: T, b: T) => boolean;
    /** Factory for per-item signals. Defaults to `createState`. */
    createItem?: (value: T) => S;
};
/**
 * Configuration options for `createList`.
 *
 * @template T - The type of items in the list
 */
type ListOptions<T extends {}, S extends Signal<T> & {
    set(value: T): void;
} = MutableCell<T>> = ItemSignalOptions<T, S> & {
    /** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. Stays active through structural mutations (add/remove/sort) — only the subscriber count matters. */
    watched?: () => Cleanup;
};
/**
 * A read-only reactive keyed sequence with per-item reactivity.
 * `deriveList()` returns one — from a computation, a seed with a watched lifecycle, or another
 * source derived per item. The shape all keyed-sequence factories converge on: `createList`
 * returns the mutable extension `MutableList<T,S>`, which is-a `List<T,S>`. See ADR-0018.
 *
 * @template T - The type of items in the sequence
 * @template S - The item-signal type. Defaults to the readonly `Cell<T>`, not `MutableCell<T>`
 *   — this is `List`'s own general default (used whenever the bare type is written directly,
 *   e.g. `ListSource<T>`, `isList<T>()`), not a specific construction's. It has to be the
 *   loosest covariant bound so a genuinely read-only List (`deriveList(fn)`, items built from
 *   `deriveComputed`) still satisfies it. Construction sites that default items to a mutable
 *   `MutableCell<T>` (`createExternalList`, `DeriveListOptions`) declare that default
 *   themselves; it doesn't come from here. See CE-011.
 */
type List<T extends {}, S extends Signal<T> = Cell<T>> = {
    readonly [Symbol.toStringTag]: 'List';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<S>;
    readonly length: number;
    get(): T[];
    at(index: number): S | undefined;
    keys(): IterableIterator<string>;
    byKey(key: string): S | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
};
/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `MutableCell<T>`; structural changes (add/remove/sort) propagate reactively.
 *
 * @template T - The type of items in the list
 */
type MutableList<T extends {}, S extends Signal<T> & {
    set(value: T): void;
} = MutableCell<T>> = List<T, S> & {
    set(next: T[]): void;
    update(fn: (prev: T[]) => T[]): void;
    add(value: T): string;
    remove(keyOrIndex: string | number): void;
    /**
     * Updates an existing item by key and propagates to every sink.
     * No-op if the key does not exist or the value is reference-equal to the current value.
     * @param key - Stable key of the item to update
     * @param value - New value for the item
     */
    replace(key: string, value: T): void;
    sort(compareFn?: (a: T, b: T) => number): void;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
};
/**
 * A source `deriveList` can key and derive from.
 *
 * A `List` (mutable or readonly) is already keyed, and its stable keys are used directly.
 * Any other `Cell<T[]>` — a synchronous derivation, an asynchronous derivation, an external
 * push, a `Slot` — is keyed on read by the adapter, which is what lets an asynchronous array
 * become a keyed sequence.
 *
 * @template T - The type of items in the source
 */
type ListSource<T extends {}> = List<T> | Cell<T[]>;
/**
 * Configuration options for `deriveList`.
 *
 * `keyConfig` and `itemEquals` apply when the source is a plain `Cell<T[]>` or the input
 * is a seed array; a `List` source carries its own keys and item equality already.
 *
 * @template T - The type of items in the derived sequence
 * @template S - The item-signal type of the external-push form; inferred from `createItem`.
 *   Defaults to `MutableCell<T>`, matching `createState` — the item factory `createItem`
 *   itself defaults to when omitted (see `createExternalList`).
 */
type DeriveListOptions<T extends {}, S extends Signal<T> = MutableCell<T>> = ItemSignalOptions<T, S> & {
    /** Initial items for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
    initial?: T[];
    /** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
    watched?: ListCallback<T>;
};
/**
 * Transformation callback for the per-item derivation, either sync or async.
 * A sync callback produces a `Cell<T>` per item. An async callback produces an
 * asynchronously derived `Cell<T>` per item, which cancels when the source item changes.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type PerItemCallback<T extends {}, U extends {}> = ((sourceValue: U) => T) | ((sourceValue: U, abortSignal: AbortSignal) => Promise<T>);
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
/** Shallow equality check for string arrays */
declare function keysEqual(a: string[], b: string[]): boolean;
declare function getKeyGenerator<T extends {}>(keyConfig?: KeyConfig<T>): [(item: T) => string, boolean];
/**
 * Compares two arrays using existing keys and returns differences as a DiffResult.
 * Avoids object conversion by working directly with arrays and keys.
 *
 * @since 0.18.0
 * @param prev - The old array
 * @param next - The new array
 * @param prevKeys - Current keys array (may be sparse or shorter than oldArray)
 * @param generateKey - Function to generate keys for new items
 * @param contentBased - When true, always use generateKey (content-based keys);
 *   when false, reuse positional keys from currentKeys (synthetic keys)
 * @returns The differences in DiffResult format plus updated keys array
 */
declare function diffArrays<T extends {}>(prev: T[], next: T[], prevKeys: string[], generateKey: (item: T) => string, contentBased: boolean, itemEquals: (a: T, b: T) => boolean): DiffResult & {
    newKeys: string[];
};
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
 * | `Cell<U[]>` or `List` + item function | — | Per-item derivation |
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
declare function deriveList<T extends {}, S extends Signal<T> = MutableCell<T>>(input: T[], options: DeriveListOptions<T, S> & {
    watched: ListCallback<T>;
}): List<T, S>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U) => T, options?: DeriveListOptions<U>): List<T>;
declare function deriveList<T extends {}, U extends {}>(input: ListSource<U>, itemCallback: (sourceValue: U, abortSignal: AbortSignal) => Promise<T>, options?: DeriveListOptions<U>): List<T>;
/**
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * `S`'s bound is the umbrella `Signal` (a custom `createItem` may return a `Store`- or
 * `List`-shaped item, see ADR-0018/CE-011), not the narrow `Cell`. If the call sits in a
 * contextual position without an explicit type argument — `const x: List<T> = createList([...])`
 * — provide `T` explicitly (`createList<T>([...])`); TS's inference for a generic default
 * can otherwise resolve `S` to the bound instead of `MutableCell<T>` when a wider contextual
 * type is also in play, and only `List<T>`'s own default (not this call's) would apply.
 *
 * @since 0.18.0
 * @param value - Initial array of items
 * @param options.keyConfig - Key generation strategy: string prefix or `(item) => string | undefined`. Defaults to auto-increment.
 * @param options.watched - Lifecycle callback that runs when the list becomes watched. Must return a cleanup function.
 * @returns A `MutableList` signal with reactive per-item `MutableCell`s
 */
declare function createList<T extends {}, S extends Signal<T> & {
    set(value: T): void;
} = MutableCell<T>>(value: T[], options?: ListOptions<T, S>): MutableList<T, S>;
/**
 * Checks if a value is a List signal — the readonly base, matching both the mutable and
 * readonly keyed-sequence shapes. Use `isMutableList` to also require write access.
 *
 * @since 2.0.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
declare function isList<T extends {}, S extends Signal<T> = Cell<T>>(value: unknown): value is List<T, S>;
/**
 * Checks if a value is a mutable List signal.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a mutable List
 */
declare function isMutableList<T extends {}, S extends Signal<T> & {
    set(value: T): void;
} = MutableCell<T>>(value: unknown): value is MutableList<T, S>;
export { createList, type DeriveListOptions, type DiffResult, deriveList, diffArrays, getKeyGenerator, isList, isMutableList, type KeyConfig, keysEqual, type List, type ListCallback, type ListChanges, type ListOptions, type ListSource, type MutableList, type PerItemCallback, TYPE_LIST, type UnknownRecord, };
