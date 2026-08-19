import {
	DuplicateKeyError,
	UnresolvableKeyError,
	UnsetSignalValueError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batch,
	type Cleanup,
	DEEP_EQUALITY,
	FLAG_DIRTY,
	FLAG_RELINK,
	link,
	type MemoNode,
	makeSubscribe,
	propagate,
	refreshComposite,
	registerAsyncSource,
	type Signal,
	SKIP_EQUALITY,
	TYPE_COLLECTION,
	untrack,
} from '../graph'
import {
	isAsyncFunction,
	isFunction,
	isSignalOfType,
	isSyncFunction,
} from '../util'
import {
	diffArrays,
	getKeyGenerator,
	isMutableList,
	type KeyConfig,
	keysEqual,
	type MutableList,
} from './list'
import { createMemo, type Memo } from './memo'
import { createState, isState } from './state'
import { createTask } from './task'

/* === Types === */

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
type ListSource<T extends {}> = MutableList<T> | DerivedList<T> | Signal<T[]>

/**
 * A source `deriveCollection` can key and derive from, under its v1 name.
 *
 * @deprecated `CollectionSource` is removed in v2.0 — use `ListSource` instead (same type, same
 * behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the source
 */
type CollectionSource<T extends {}> = ListSource<T>

/**
 * The minimal keyed interface `deriveCollection` consumes from its source.
 * `MutableList` and `DerivedList` satisfy it directly; a plain `Signal<T[]>` is adapted to it.
 *
 * @template T - The type of items in the source
 */
type KeyedSource<T extends {}> = {
	keys(): IterableIterator<string>
	byKey(key: string): Signal<T> | undefined
}

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
	/**
	 * Key generation strategy for an unkeyed source. See `KeyConfig`. Defaults to positional
	 * keys. In the external-push form (`watched`), a function `keyConfig` is required for a
	 * `change`/`remove` entry to match an item that is not the exact tracked object reference —
	 * see `ListChanges`.
	 */
	keyConfig?: KeyConfig<T>
	/** Equality function for adapted per-item signals. Defaults to deep equality. */
	itemEquals?: (a: T, b: T) => boolean
	/** Seed value for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
	initial?: T[]
	/** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
	watched?: ListCallback<T>
	/** Factory for per-item signals in the external-push form. Defaults to `createState`. */
	createItem?: (value: T) => Signal<T>
}

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
	keyConfig?: KeyConfig<T>
	/** Equality function for adapted per-item signals. Defaults to deep equality. */
	itemEquals?: (a: T, b: T) => boolean
}

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
type PerItemCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abort: AbortSignal) => Promise<T>)

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
type DeriveCollectionCallback<T extends {}, U extends {}> = PerItemCallback<
	T,
	U
>

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
	readonly [Symbol.toStringTag]: 'Collection'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<S>
	keys(): IterableIterator<string>
	get(): T[]
	at(index: number): S | undefined
	byKey(key: string): S | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	/**
	 * @deprecated Use the top-level `deriveList(source, itemFn)` instead —
	 * `users.deriveCollection(f)` becomes `deriveList(users, f)`. Both `.deriveCollection()`
	 * forms are removed in v2.0. See `MIGRATION-2.0.md`.
	 */
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): DerivedList<R>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
	): DerivedList<R>
	readonly length: number
}

/**
 * The read-only keyed-sequence type, under its v1 name.
 *
 * @deprecated `Collection` is removed in v2.0 — use `DerivedList` (same type, same behavior
 * today). In v2.0, the readonly base is named `List`. See
 * [ADR-0018](../../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type Collection<T extends {}, S extends Signal<T> = Signal<T>> = DerivedList<
	T,
	S
>

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
	add?: T[]
	/**
	 * Items whose values have changed. Matched to existing entries by key. A non-content-based
	 * `keyConfig` matches only the exact tracked object reference — any other item throws
	 * `UnresolvableKeyError`.
	 */
	change?: T[]
	/**
	 * Items to remove. Matched to existing entries by key. A non-content-based `keyConfig`
	 * matches only the exact tracked object reference — any other item throws
	 * `UnresolvableKeyError`.
	 */
	remove?: T[]
}

/**
 * Granular mutation descriptor, under its v1 name.
 *
 * @deprecated `CollectionChanges` is removed in v2.0 — use `ListChanges` instead (same type,
 * same behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type CollectionChanges<T> = ListChanges<T>

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
	value?: T[]
	/**
	 * Key generation strategy. See `KeyConfig`. Defaults to auto-increment. A function
	 * `keyConfig` is required for a `change`/`remove` entry to match an item that is not the
	 * exact tracked object reference — see `ListChanges`.
	 */
	keyConfig?: KeyConfig<T>
	/** Factory for per-item signals. Defaults to `createState`. */
	createItem?: (value: T) => S
	/** Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided. */
	itemEquals?: (a: T, b: T) => boolean
}

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
type ListCallback<T extends {}> = (
	apply: (changes: ListChanges<T>) => void,
) => Cleanup

/**
 * Setup callback for `createCollection`, under its v1 name.
 *
 * @deprecated `CollectionCallback` is removed in v2.0 — use `ListCallback` instead (same type,
 * same behavior; this is the terminal 2.0 name). See
 * [ADR-0018](../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the collection
 */
type CollectionCallback<T extends {}> = ListCallback<T>

/* === Functions === */

/**
 * Adapts a plain `Signal<T[]>` to the keyed interface `deriveCollection` consumes.
 *
 * The array is diffed against the previous read with the same `diffArrays` used by
 * `List.set()`, so keys stay stable across recomputes: a content-based `keyConfig`
 * regenerates the same key for the same item, and the positional default reuses keys by
 * index. Without this, an auto-incrementing generator would mint fresh keys on every
 * rebuild and destroy item identity.
 *
 * `keys()` reads the source tracked, so a caller inside a computation gains the
 * structural edge. `byKey()` returns a per-item `Memo` that reads the source itself,
 * which is what gives an adapted source the same per-item granularity a `List` has.
 *
 * An `UnsetSignalValueError` from an unresolved `Task` source reads as an empty array
 * rather than propagating, so the collection is empty until the source first settles.
 */
function keyedAdapter<T extends {}>(
	source: Signal<T[]>,
	options?: DeriveListOptions<T>,
): KeyedSource<T> {
	const [generateKey, contentBased, positional] = getKeyGenerator(
		options?.keyConfig,
	)
	const itemEquals = options?.itemEquals ?? DEEP_EQUALITY
	const signals = new Map<string, Memo<T>>()
	const indices = new Map<string, number>()
	let keys: string[] = []
	let prev: T[] = []
	let syncedFrom: T[] | undefined

	// An unresolved Task source has no items yet — that is not an error here,
	// it is an empty collection. Any other read failure is the caller's problem.
	const readSource = (): T[] => {
		try {
			return source.get()
		} catch (e) {
			if (e instanceof UnsetSignalValueError) return []
			throw e
		}
	}

	// Reconciles the keys array and index map against `next`, at most once per
	// distinct source array — every item signal in one propagation pass reads the
	// same array, so only the first one pays for the diff and the pass stays O(n).
	//
	// Deliberately does NOT touch the `signals` map. This runs inside an item Memo's
	// own recompute (see `byKey`), where deleting the map entry of the Memo currently
	// running would be gnarly and would silently break identity for a consumer holding
	// that signal. Signal-map reconciliation happens in `keys()` instead.
	const ensureKeys = (next: T[]): void => {
		if (next === syncedFrom) return
		syncedFrom = next
		const diff = diffArrays(
			prev,
			next,
			keys,
			generateKey,
			contentBased,
			itemEquals,
			positional,
		)
		prev = next
		if (keysEqual(keys, diff.newKeys)) return
		keys = diff.newKeys
		indices.clear()
		for (let i = 0; i < keys.length; i++) indices.set(keys[i] as string, i)
	}

	return {
		keys() {
			ensureKeys(readSource())
			// Drop item signals whose key is gone. Safe here, and only here: this is
			// never reached from inside an item Memo's own recompute.
			for (const key of Array.from(signals.keys()))
				if (!indices.has(key)) signals.delete(key)
			return keys.values()
		},

		byKey(key: string) {
			if (!indices.has(key)) return undefined
			let signal = signals.get(key)
			if (!signal) {
				// Reads the source rather than closing over a value, so the item
				// signal is a real graph sink of the source and recomputes on change.
				signal = createMemo(
					() => {
						// Re-resolve the index against the array this recompute
						// actually sees. A consumer may hold this signal directly, so
						// it can run without the collection's own rebuild having run
						// first; an index resolved outside this closure would be stale
						// after a reorder and would return a different element under
						// the same key. See ADR-0018 §7.
						const items = readSource()
						ensureKeys(items)
						const at = indices.get(key)
						return (at !== undefined ? items[at] : undefined) as T
					},
					{ equals: itemEquals },
				)
				signals.set(key, signal)
			}
			return signal
		},
	}
}

/**
 * Builds the Collection accessor object shared by `createCollection` and `deriveCollection`.
 *
 * The two differ only in what has to happen before an access, which is what `prepare` and
 * `prepareValue` carry: an externally driven collection maintains its keys through
 * `onChanges()` and only needs the watched lifecycle activated, while a derived one
 * discovers its keys inside `buildValue()` and must refresh on every access.
 *
 * @param node - The structural tracking node
 * @param getKeys - Reads the current key order; a getter because the array is reassigned
 * @param signals - The per-key child signals
 * @param prepare - Runs before a structural access
 * @param prepareValue - Runs before `get()`; must leave `node.value` current
 */
function collectionFacade<T extends {}, S extends Signal<T>>(
	node: MemoNode<T[]>,
	getKeys: () => string[],
	signals: Map<string, S>,
	prepare: () => void,
	prepareValue: () => void,
): DerivedList<T, S> {
	const collection: DerivedList<T, S> = {
		[Symbol.toStringTag]: TYPE_COLLECTION,
		[Symbol.isConcatSpreadable]: true as const,

		*[Symbol.iterator]() {
			prepare()
			for (const key of getKeys()) {
				const signal = signals.get(key)
				if (signal) yield signal
			}
		},

		get length() {
			prepare()
			return getKeys().length
		},

		keys() {
			prepare()
			return getKeys().values()
		},

		get() {
			prepareValue()
			return node.value
		},

		at(index: number) {
			prepare()
			const key = getKeys()[index]
			return key !== undefined ? signals.get(key) : undefined
		},

		byKey(key: string) {
			prepare()
			return signals.get(key)
		},

		keyAt(index: number) {
			prepare()
			return getKeys()[index]
		},

		indexOfKey(key: string) {
			prepare()
			return getKeys().indexOf(key)
		},

		deriveCollection<R extends {}>(cb: PerItemCallback<R, T>): DerivedList<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: ListSource<U2>,
					callback: PerItemCallback<T2, U2>,
				) => DerivedList<T2>
			)(collection, cb)
		},
	}

	return collection
}

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
function deriveCollection<T extends {}, U extends {}>(
	source: ListSource<U>,
	callback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
	options?: DeriveListOptions<U>,
): DerivedList<T>
function deriveCollection<T extends {}, U extends {}>(
	source: ListSource<U>,
	callback: (sourceValue: U) => T,
	options?: DeriveListOptions<U>,
): DerivedList<T>
function deriveCollection<T extends {}, U extends {}>(
	sourceInput: ListSource<U>,
	// Optional only for the internal pass-through form used by `deriveList(fn)`; every
	// public overload requires it.
	callback?: PerItemCallback<T, U>,
	options?: DeriveListOptions<U>,
): DerivedList<T> {
	if (callback) validateCallback(TYPE_COLLECTION, callback)

	// A List or Collection is already keyed; anything else is adapted. The guards
	// must come first, because both also satisfy the structural `Signal<U[]>` type.
	const source: KeyedSource<U> =
		isMutableList<U>(sourceInput) || isDerivedList<U>(sourceInput)
			? (sourceInput as KeyedSource<U>)
			: keyedAdapter(sourceInput as Signal<U[]>, options)

	const isAsync = isAsyncFunction(callback)
	const signals = new Map<string, Memo<T>>()
	let keys: string[] = []

	const addSignal = (key: string): void => {
		// No callback: the source's own slice is the derived slice, so it is used
		// directly instead of being wrapped in an identity Memo. Only reachable from
		// `deriveList(fn)`, where the source is an internally built `keyedAdapter` and
		// its slices are therefore `Memo`s. It is NOT safe for a `List` source, whose
		// `byKey` returns a *mutable* signal — exposing that would leak `.set()`
		// through a read-only collection.
		if (!callback) {
			const passthrough = untrack(() => source.byKey(key))
			if (passthrough) signals.set(key, passthrough as unknown as Memo<T>)
			return
		}

		const signal = isAsync
			? createTask(async (prev: T | undefined, abort: AbortSignal) => {
					// Look up the item signal without a structural edge (byKey now
					// tracks structure), then read its value tracked so the Task
					// depends on the item's value but not on structural changes.
					// syncKeys() synchronizes the keys by reading source.keys().
					const itemSignal = untrack(() => source.byKey(key))
					if (!itemSignal) return prev as T
					const sourceValue = itemSignal.get() as U
					if (sourceValue == null) return prev as T
					return (
						callback as (sourceValue: U, abort: AbortSignal) => Promise<T>
					)(sourceValue, abort)
				})
			: createMemo(() => {
					// Look up the item signal without a structural edge (byKey now
					// tracks structure), then read its value tracked so the Memo
					// depends on the item's value but not on structural changes.
					// syncKeys() synchronizes the keys by reading source.keys().
					const itemSignal = untrack(() => source.byKey(key))
					if (!itemSignal) return undefined as unknown as T
					const sourceValue = itemSignal.get() as U
					if (sourceValue == null) return undefined as unknown as T
					return (callback as (sourceValue: U) => T)(sourceValue)
				})

		signals.set(key, signal as Memo<T>)
	}

	// Sync signals map with the given keys.
	// Intentionally side-effectful: mutates the private signals map and keys
	// array. Sets FLAG_RELINK on the node if keys changed.
	function syncKeys(nextKeys: string[]): void {
		if (!keysEqual(keys, nextKeys)) {
			const nextSet = new Set(nextKeys)
			for (const key of keys) if (!nextSet.has(key)) signals.delete(key)
			for (const key of nextKeys) if (!signals.has(key)) addSignal(key)
			keys = nextKeys
			node.flags |= FLAG_RELINK
		}
	}

	// Build current value from child signals.
	// Reads source.keys() to sync the signals map and — during refresh() —
	// to establish a graph edge from source → this node.
	function buildValue(): T[] {
		syncKeys(Array.from(source.keys()))
		const result: T[] = []
		for (const key of keys) {
			try {
				const v = signals.get(key)?.get()
				if (v != null) result.push(v)
			} catch (e) {
				// Skip pending async items; rethrow real errors
				if (!(e instanceof UnsetSignalValueError)) throw e
			}
		}
		return result
	}

	// Shallow reference equality for value arrays — prevents unnecessary downstream
	// propagation when re-evaluation produces the same item references. Same algorithm
	// as keysEqual, which is written for strings but compares by identity either way.
	const valuesEqual = keysEqual as unknown as (a: T[], b: T[]) => boolean

	// Structural tracking node — mirrors the List/Store/createCollection pattern.
	// fn (buildValue) syncs keys then reads child signals to produce T[].
	// Keys are tracked separately in a local variable.
	const node: MemoNode<T[]> = {
		fn: buildValue,
		value: [],
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: valuesEqual,
		error: undefined,
	}

	// Unlike List/Store (whose mutation methods set FLAG_RELINK explicitly before this
	// runs), buildValue() discovers key changes itself via syncKeys() — the derived
	// variant.
	const ensureFresh = (): void => {
		refreshComposite(node, buildValue, true)
	}

	// Initialize signals for current source keys. untrack suppresses edge
	// creation (activeSink linking) during construction — that keys on
	// node.sinks via makeSubscribe, not activeSink. The first refresh()
	// (triggered by an effect) will establish proper graph edges; this just
	// populates the signals map for direct access.
	const initialKeys = Array.from(untrack(() => source.keys()))
	for (const key of initialKeys) addSignal(key)
	keys = initialKeys
	// Keep FLAG_DIRTY so the first refresh() establishes edges.

	// Every access links the structural node and refreshes, because keys are
	// discovered by buildValue() rather than maintained by mutation methods.
	const prepare = (): void => {
		if (activeSink) link(node, activeSink)
		ensureFresh()
	}

	return collectionFacade<T, Memo<T>>(
		node,
		() => keys,
		signals,
		prepare,
		prepare,
	)
}

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
function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(
	watched: ListCallback<T>,
	options?: CollectionOptions<T, S>,
): DerivedList<T, S> {
	const value = options?.value ?? []
	if (value.length) validateSignalValue(TYPE_COLLECTION, value, Array.isArray)
	validateCallback(TYPE_COLLECTION, watched, isSyncFunction)

	const signals = new Map<string, S>()
	const keys: string[] = []
	const itemToKey = new Map<T, string>()

	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)

	// With a content-based keyConfig, generateKey(item) can always compute a key from the
	// item's content, so this never falls through to undefined. Without one, a change/remove
	// entry can only be resolved by object identity — a real limitation for externally-sourced
	// data (e.g. freshly-parsed JSON), which is rarely reference-equal across messages. See
	// the throw in onChanges() below.
	const resolveKey = (item: T): string | undefined =>
		itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined)

	const itemFactory = (options?.createItem ??
		((item: T) =>
			createState(item, {
				equals: options?.itemEquals ?? DEEP_EQUALITY,
			}))) as (value: T) => S

	// Build current value from child signals
	function buildValue(): T[] {
		const result: T[] = []
		for (const key of keys) {
			try {
				const v = signals.get(key)?.get()
				if (v != null) result.push(v)
			} catch (e) {
				// Skip pending async items; rethrow real errors
				if (!(e instanceof UnsetSignalValueError)) throw e
			}
		}
		return result
	}

	const node: MemoNode<T[]> = {
		fn: buildValue,
		value,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: SKIP_EQUALITY, // Always rebuild — structural changes are managed externally
		error: undefined,
	}

	// Initialize signals for initial value. The duplicate check precedes every
	// mutation — a rejected seed leaves signals, keys, and itemToKey untouched.
	for (const item of value) {
		const key = generateKey(item)
		if (signals.has(key))
			throw new DuplicateKeyError(TYPE_COLLECTION, key, item)
		signals.set(key, itemFactory(item))
		itemToKey.set(item, key)
		keys.push(key)
	}
	node.value = value
	node.flags = FLAG_DIRTY // First refresh() will establish child edges

	const onChanges = (changes: ListChanges<T>): void => {
		const { add, change, remove } = changes
		if (!add?.length && !change?.length && !remove?.length) return
		let structural = false

		batch(() => {
			// Additions — validate the whole batch (including duplicates within
			// the batch itself) before mutating any state. Mirrors List.splice():
			// staging first means a duplicate anywhere in the batch leaves
			// signals/keys/itemToKey untouched, instead of committing earlier
			// items and then throwing with node.flags/propagate() never run.
			if (add) {
				const staged = new Map<string, T>()
				for (const item of add) {
					const key = generateKey(item)
					// Reject duplicate keys up front — matches List.add / Store.add.
					// An overwrite would orphan the sinks of the existing child signal.
					if (signals.has(key) || staged.has(key))
						throw new DuplicateKeyError(TYPE_COLLECTION, key, item)
					staged.set(key, item)
				}
				for (const [key, item] of staged) {
					signals.set(key, itemFactory(item))
					itemToKey.set(item, key)
					if (!keys.includes(key)) keys.push(key)
					structural = true
				}
			}

			// Changes — only for State signals. Keys are resolved for the whole batch
			// before any mutation, so an unresolvable entry throws before anything commits
			// — mirrors the add-loop's staging above.
			if (change) {
				const resolved: [string, T][] = []
				for (const item of change) {
					const key = resolveKey(item)
					if (!key) throw new UnresolvableKeyError(TYPE_COLLECTION, item)
					resolved.push([key, item])
				}
				for (const [key, item] of resolved) {
					const signal = signals.get(key)
					if (signal && isState(signal)) {
						// Update reverse map: remove old reference, add new.
						// untrack prevents the read from leaking an edge into
						// the caller's effect when applyChanges is called inside one.
						itemToKey.delete(untrack(() => signal.get()))
						signal.set(item)
						itemToKey.set(item, key)
					}
				}
			}

			// Removals — same staging rationale as changes above.
			if (remove) {
				const resolved: [string, T][] = []
				for (const item of remove) {
					const key = resolveKey(item)
					if (!key) throw new UnresolvableKeyError(TYPE_COLLECTION, item)
					resolved.push([key, item])
				}
				for (const [key, item] of resolved) {
					itemToKey.delete(item)
					signals.delete(key)
					const index = keys.indexOf(key)
					if (index !== -1) keys.splice(index, 1)
					structural = true
				}
			}

			// Mark DIRTY so next get() rebuilds; propagate to sinks
			node.flags = FLAG_DIRTY | (structural ? FLAG_RELINK : 0)
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
		})
	}

	const subscribe = makeSubscribe(node, () => watched(onChanges))

	// Keys and signals are maintained by onChanges(), so a structural access only
	// has to activate the watched lifecycle. Only get() rebuilds the value.
	return collectionFacade<T, S>(
		node,
		() => keys,
		signals,
		subscribe,
		() => {
			subscribe()
			refreshComposite(node, buildValue)
		},
	)
}

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
function deriveList<T extends {}>(
	input: () => T[],
	options?: DeriveListOptions<T>,
): DerivedList<T>
function deriveList<T extends {}>(
	input: (prev: T[], abort: AbortSignal) => Promise<T[]>,
	options: DeriveListOptions<T> & { initial: T[] },
): DerivedList<T>
function deriveList<T extends {}>(
	input: T[],
	options: DeriveListOptions<T> & { watched: ListCallback<T> },
): DerivedList<T>
function deriveList<T extends {}, U extends {}>(
	input: ListSource<U>,
	itemCallback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
	options?: DeriveListOptions<U>,
): DerivedList<T>
function deriveList<T extends {}, U extends {}>(
	input: ListSource<U>,
	itemCallback: (sourceValue: U) => T,
	options?: DeriveListOptions<U>,
): DerivedList<T>
function deriveList<T extends {}, U extends {}>(
	input:
		| (() => T[])
		| ((prev: T[], abort: AbortSignal) => Promise<T[]>)
		| T[]
		| ListSource<U>,
	itemOrOptions?: PerItemCallback<T, U> | DeriveListOptions<T>,
	maybeOptions?: DeriveListOptions<U>,
): DerivedList<T> {
	// Per-item derivation: the second argument is the callback, not the options.
	if (isFunction(itemOrOptions))
		return deriveCollection(
			input as ListSource<U>,
			itemOrOptions as (sourceValue: U) => T,
			maybeOptions,
		)

	const options = itemOrOptions as DeriveListOptions<T> | undefined

	// Pass-through: the source is built here, so `deriveCollection` adapts it and uses
	// the adapter's slices as the derived slices — one Memo per item, not two. The cast
	// reaches the implementation signature; no public overload omits the callback.
	const passthrough = deriveCollection as unknown as <V extends {}>(
		source: ListSource<V>,
		callback: undefined,
		options?: DeriveListOptions<V>,
	) => DerivedList<V>

	// External push: a seed array plus a watched lifecycle. Checked before the
	// function branches because an array is never a computation.
	if (!isFunction(input)) {
		validateSignalValue(TYPE_COLLECTION, input, Array.isArray)
		validateCallback(TYPE_COLLECTION, options?.watched, isSyncFunction)
		// `initial` and `watched` are ignored by createCollection; the rest of the
		// options are shared verbatim.
		return createCollection(options?.watched as ListCallback<T>, {
			...(options as CollectionOptions<T>),
			value: input as T[],
		}) as DerivedList<T>
	}

	// Asynchronous derivation. `initial` defaults to empty rather than throwing:
	// the contract is that the sequence is never unset, and an empty seed satisfies
	// it. `isPending()` carries the loading distinction instead of the value.
	if (isAsyncFunction(input)) {
		const task = createTask(
			input as (prev: T[], abort: AbortSignal) => Promise<T[]>,
			{ value: options?.initial ?? [] },
		)
		const derived = passthrough<T>(
			task as Signal<T[]>,
			undefined,
			options as DeriveListOptions<T>,
		)
		// The asynchrony lives in the internal Task, so `isPending(derived)` and
		// `abort(derived)` resolve through it. See ADR-0018.
		registerAsyncSource(derived, task)
		return derived
	}

	// Synchronous derivation.
	return passthrough<T>(
		createMemo(input as () => T[]) as Signal<T[]>,
		undefined,
		options as DeriveListOptions<T>,
	)
}

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
function isDerivedList<T extends {}, S extends Signal<T> = Signal<T>>(
	value: unknown,
): value is DerivedList<T, S> {
	return isSignalOfType(value, TYPE_COLLECTION)
}

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
function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(
	value: unknown,
): value is Collection<T, S> {
	return isDerivedList<T, S>(value)
}

/* === Exports === */

export {
	type Collection,
	type CollectionCallback,
	type CollectionChanges,
	type CollectionOptions,
	type CollectionSource,
	createCollection,
	type DeriveCollectionCallback,
	type DeriveCollectionOptions,
	type DerivedList,
	type DeriveListOptions,
	deriveCollection,
	deriveList,
	isCollection,
	isDerivedList,
	type ListCallback,
	type ListChanges,
	type ListSource,
	type PerItemCallback,
}
