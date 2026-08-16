import { type Cleanup, type Signal, TYPE_STORE } from '../graph';
import { type MutableList, type UnknownRecord } from './list';
import { type State } from './state';
/**
 * Configuration options for `createStore`.
 */
type StoreOptions = {
    /** Runs when the store becomes watched. Returns a cleanup that runs when it is no longer watched. */
    watched?: () => Cleanup;
};
type BaseMutableStore<T extends UnknownRecord> = {
    readonly [Symbol.toStringTag]: 'Store';
    readonly [Symbol.isConcatSpreadable]: false;
    [Symbol.iterator](): IterableIterator<[
        string,
        (State<T[keyof T] & {}> | MutableStore<UnknownRecord> | MutableList<unknown & {}>)
    ]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): T[K] extends readonly (infer U extends {})[] ? MutableList<U> : T[K] extends UnknownRecord ? MutableStore<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
    get(): T;
    set(next: T): void;
    update(fn: (prev: T) => T): void;
    add<K extends keyof T & string>(key: K, value: T[K]): K;
    remove(key: string): void;
};
/**
 * A reactive object with per-property reactivity.
 * Each property becomes a `State`, a nested `MutableStore`, or a `List`, reachable through the
 * proxy. A write to one property re-runs only the effects that read that property.
 *
 * The name this type carries in v2.0. `Store` is a deprecated alias of it.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type MutableStore<T extends UnknownRecord> = BaseMutableStore<T> & {
    [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? MutableList<U> : T[K] extends UnknownRecord ? MutableStore<T[K]> : T[K] extends unknown & {} ? State<T[K] & {}> : State<T[K] & {}> | undefined;
};
/**
 * The mutable keyed-record type, under its v1 name.
 *
 * @deprecated `Store`'s current mutable meaning ends in v2.0 — use `MutableStore` (same type,
 * same behavior today). In v2.0, `Store` is the readonly base, which is today's `DerivedStore`.
 * See [ADR-0018](../../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type Store<T extends UnknownRecord> = MutableStore<T>;
/**
 * The read-only projection of a Store, returned by `deriveStore`.
 * Each property is a `Signal`, reachable through the proxy exactly as on a `Store`.
 * There is no `set`, `update`, `add`, or `remove` — a derived record is written only by
 * its derivation.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type BaseDerivedStore<T extends UnknownRecord> = {
    readonly [Symbol.toStringTag]: 'Store';
    readonly [Symbol.isConcatSpreadable]: false;
    [Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T] & {}>]>;
    keys(): IterableIterator<string>;
    byKey<K extends keyof T & string>(key: K): Signal<T[K] & {}> | undefined;
    get(): T;
};
type DerivedStore<T extends UnknownRecord> = BaseDerivedStore<T> & {
    [K in keyof T]: Signal<T[K] & {}> | undefined;
};
/**
 * Setup callback for the external-push form of `deriveStore`.
 * Receives an `emit` function that merges a partial record into the store.
 *
 * @template T - The plain-object type held by the store
 */
type StoreCallback<T extends UnknownRecord> = (emit: (patch: Partial<T>) => void) => Cleanup;
/**
 * Configuration options for `deriveStore`.
 *
 * @template T - The plain-object type held by the store
 */
type DeriveStoreOptions<T extends UnknownRecord> = {
    /** Seed value for an asynchronous derivation. Keeps the record readable before the first resolution. */
    initial?: T;
    /** Lifecycle callback for an external-push origin. Required when `input` is a seed record. */
    watched?: StoreCallback<T>;
};
/**
 * Creates a reactive store with deeply nested reactive properties.
 * Each property becomes its own signal. A primitive becomes a State, an object becomes a
 * nested Store, and an array becomes a List. The proxy exposes each property directly.
 *
 * @since 0.15.0
 * @param value - Initial object value of the store
 * @param options - Optional configuration for watch lifecycle
 * @returns A MutableStore with reactive properties
 *
 * @example
 * ```ts
 * const user = createStore({ name: 'Alice', age: 30 });
 * user.name.set('Bob'); // Only sinks of the name property react
 * console.log(user.get()); // { name: 'Bob', age: 30 }
 * ```
 *
 * Direct property assignment, deletion, or `Object.defineProperty` through the
 * proxy throws `InvalidStoreMutationError` — use `store.key.set(value)`,
 * `store.set(next)`, `store.add(key, value)`, or `store.remove(key)` instead.
 * Properties are typed as signals rather than raw values, so destructuring preserves
 * reactivity. Proxy assignment is therefore a compile-time error for a typed store. The
 * runtime guard extends that protection to `any`-typed access, JavaScript callers, and
 * `Object.assign`. See ADR-0017 for the full rationale.
 *
 * Note: a data key that shares a name with a base method shadows that method under proxy
 * access. The base methods are `get`, `set`, `keys`, `update`, `add`, `remove`, and
 * `byKey`. Use `store.byKey(key)` to reach such a property.
 */
declare function createStore<T extends UnknownRecord>(value: T, options?: StoreOptions): MutableStore<T>;
/**
 * Creates a read-only reactive record from any origin.
 *
 * The origin follows from `input`, so one factory covers every way a keyed record can come
 * to exist. This closes the largest gap in the derivation matrix: before it, no `Store`
 * could be derived from anything, and the only way to build one from a `Task` or a `Memo`
 * was an imperative write from inside an effect.
 *
 * | `input` | `options` | Origin |
 * |---|---|---|
 * | sync function | — | Synchronous derivation |
 * | async function | `initial` required | Asynchronous derivation |
 * | record | `watched` required | External push |
 *
 * Each property is a `Memo` that reads the source itself, so a write to one property of
 * the source re-runs only the effects that read that property — the same per-property
 * granularity `createStore` gives. Unlike `createStore`, nested records and arrays are
 * not recursively converted to nested `Store`s and `List`s; a nested property is a plain
 * `Signal` of the nested value. Call `deriveStore` or `deriveList` again on that property
 * to go deeper.
 *
 * @since 1.5.0
 * @param input - A computation or a seed record
 * @param options - Seed value for an async derivation, or the watched lifecycle
 * @returns A read-only Store signal
 *
 * @example
 * ```ts
 * const user = deriveStore(
 *   async (_prev, abort) => {
 *     const res = await fetch(`/api/users/${id.get()}`, { signal: abort })
 *     return res.json() as Promise<{ name: string; email: string }>
 *   },
 *   { initial: { name: '', email: '' } },
 * )
 *
 * // Per-property reactivity: this effect ignores changes to email.
 * createEffect(() => render(user.name?.get()))
 * ```
 */
declare function deriveStore<T extends UnknownRecord>(input: () => T, options?: DeriveStoreOptions<T>): DerivedStore<T>;
declare function deriveStore<T extends UnknownRecord>(input: (prev: T, abort: AbortSignal) => Promise<T>, options: DeriveStoreOptions<T> & {
    initial: T;
}): DerivedStore<T>;
declare function deriveStore<T extends UnknownRecord>(input: T, options: DeriveStoreOptions<T> & {
    watched: StoreCallback<T>;
}): DerivedStore<T>;
/**
 * Checks if a value is a mutable Store signal.
 *
 * The name this guard carries in v2.0. `isStore` is a deprecated alias of the tag check this
 * builds on, widened by the write-capability requirement — so unlike `isStore`, a `DerivedStore`
 * does not match.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a mutable Store
 */
declare function isMutableStore<T extends UnknownRecord>(value: unknown): value is MutableStore<T>;
/**
 * Checks if a value is a Store signal.
 *
 * @deprecated `Store`'s current mutable meaning ends in v2.0 — use `isMutableStore` to require
 * write access. This guard checks the shape tag only, so it matches the mutable store and the
 * `DerivedStore` alike today; in v2.0 it narrows to the readonly base (today's `DerivedStore`).
 * See [ADR-0018](../../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a Store
 */
declare function isStore<T extends UnknownRecord>(value: unknown): value is Store<T>;
export { createStore, type DerivedStore, type DeriveStoreOptions, deriveStore, isMutableStore, isStore, type MutableStore, type Store, type StoreCallback, type StoreOptions, TYPE_STORE, };
