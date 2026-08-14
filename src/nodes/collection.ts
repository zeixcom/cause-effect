import {
	DuplicateKeyError,
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
	isList,
	type KeyConfig,
	keysEqual,
	type List,
} from './list'
import { createMemo, type Memo } from './memo'
import { createState, isState } from './state'
import { createTask } from './task'

/* === Types === */

/**
 * A source `deriveCollection` can key and derive from.
 *
 * A `List` or `Collection` is already keyed, and its stable keys are used directly.
 * Any other `Signal<T[]>` — a `Memo`, a `Task`, a `State`, a `Slot` — is keyed on read
 * by the adapter, which is what lets an asynchronous array become a keyed collection.
 *
 * @template T - The type of items in the source
 */
type CollectionSource<T extends {}> = List<T> | Collection<T> | Signal<T[]>

/**
 * The minimal keyed interface `deriveCollection` consumes from its source.
 * `List` and `Collection` satisfy it directly; a plain `Signal<T[]>` is adapted to it.
 *
 * @template T - The type of items in the source
 */
type KeyedSource<T extends {}> = {
	keys(): IterableIterator<string>
	byKey(key: string): Signal<T> | undefined
}

/**
 * Configuration options for `deriveCollection`.
 *
 * Both options apply only when the source is a plain `Signal<T[]>`. A `List` or
 * `Collection` source carries its own keys and item equality already.
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
 * Configuration options for `deriveList`.
 *
 * @template T - The type of items in the derived sequence
 */
type DeriveListOptions<T extends {}> = DeriveCollectionOptions<T> & {
	/** Seed value for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
	initial?: T[]
	/** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
	watched?: CollectionCallback<T>
	/** Factory for per-item signals in the external-push form. Defaults to `createState`. */
	createItem?: (value: T) => Signal<T>
}

/**
 * Transformation callback for `deriveCollection`, either sync or async.
 * A sync callback produces a `Memo<T>` per item. An async callback produces a `Task<T>`
 * per item, which cancels when the source item changes.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type DeriveCollectionCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abort: AbortSignal) => Promise<T>)

/**
 * A read-only reactive keyed collection with per-item reactivity.
 * `createCollection()` creates an externally driven one. `.deriveCollection()` on a `List`
 * or a `Collection` creates a derived one.
 *
 * @template T - The type of items in the collection
 */
type Collection<T extends {}, S extends Signal<T> = Signal<T>> = {
	readonly [Symbol.toStringTag]: 'Collection'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<S>
	keys(): IterableIterator<string>
	get(): T[]
	at(index: number): S | undefined
	byKey(key: string): S | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
	deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): Collection<R>
	readonly length: number
}

/**
 * Granular mutation descriptor passed to the `applyChanges` callback inside a `CollectionCallback`.
 *
 * @template T - The type of items in the collection
 */
type CollectionChanges<T> = {
	/** Items to add. Each item is assigned a new key via the configured `keyConfig`. */
	add?: T[]
	/** Items whose values have changed. Matched to existing entries by key. */
	change?: T[]
	/** Items to remove. Matched to existing entries by key. */
	remove?: T[]
}

/**
 * Configuration options for `createCollection`.
 *
 * @template T - The type of items in the collection
 */
type CollectionOptions<T extends {}, S extends Signal<T> = Signal<T>> = {
	/** Initial items. Defaults to `[]`. */
	value?: T[]
	/** Key generation strategy. See `KeyConfig`. Defaults to auto-increment. */
	keyConfig?: KeyConfig<T>
	/** Factory for per-item signals. Defaults to `createState`. */
	createItem?: (value: T) => S
	/** Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided. */
	itemEquals?: (a: T, b: T) => boolean
}

/**
 * Setup callback for `createCollection`. Runs when the collection becomes watched.
 * Receives an `applyChanges` function to push granular mutations into the graph.
 *
 * @template T - The type of items in the collection
 * @param apply - Call with a `CollectionChanges` object to add, update, or remove items
 * @returns A cleanup function that runs when the collection is no longer watched
 */
type CollectionCallback<T extends {}> = (
	apply: (changes: CollectionChanges<T>) => void,
) => Cleanup

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
	options?: DeriveCollectionOptions<T>,
): KeyedSource<T> {
	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)
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
): Collection<T, S> {
	const collection: Collection<T, S> = {
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

		deriveCollection<R extends {}>(
			cb: DeriveCollectionCallback<R, T>,
		): Collection<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: CollectionSource<U2>,
					callback: DeriveCollectionCallback<T2, U2>,
				) => Collection<T2>
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
 * @since 0.18.0
 * @param source - The source to derive from: a List, a Collection, or any `Signal<U[]>`
 * @param callback - Transformation function applied to each item
 * @param options - Key generation and item equality. Applies only to an unkeyed source.
 * @returns A Collection signal
 */
function deriveCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U) => T,
	options?: DeriveCollectionOptions<U>,
): Collection<T>
function deriveCollection<T extends {}, U extends {}>(
	source: CollectionSource<U>,
	callback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
	options?: DeriveCollectionOptions<U>,
): Collection<T>
function deriveCollection<T extends {}, U extends {}>(
	sourceInput: CollectionSource<U>,
	// Optional only for the internal pass-through form used by `deriveList(fn)`; every
	// public overload requires it.
	callback?: DeriveCollectionCallback<T, U>,
	options?: DeriveCollectionOptions<U>,
): Collection<T> {
	if (callback) validateCallback(TYPE_COLLECTION, callback)

	// A List or Collection is already keyed; anything else is adapted. The guards
	// must come first, because both also satisfy the structural `Signal<U[]>` type.
	const source: KeyedSource<U> =
		isList<U>(sourceInput) || isCollection<U>(sourceInput)
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
 * @since 0.18.0
 * @param watched - Callback that runs when the collection becomes watched. Receives the applyChanges helper.
 * @param options - Optional configuration including initial value, key generation, and item signal creation
 * @returns A read-only Collection signal
 */
function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(
	watched: CollectionCallback<T>,
	options?: CollectionOptions<T, S>,
): Collection<T, S> {
	const value = options?.value ?? []
	if (value.length) validateSignalValue(TYPE_COLLECTION, value, Array.isArray)
	validateCallback(TYPE_COLLECTION, watched, isSyncFunction)

	const signals = new Map<string, S>()
	const keys: string[] = []
	const itemToKey = new Map<T, string>()

	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)

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

	// Initialize signals for initial value
	for (const item of value) {
		const key = generateKey(item)
		signals.set(key, itemFactory(item))
		itemToKey.set(item, key)
		keys.push(key)
	}
	node.value = value
	node.flags = FLAG_DIRTY // First refresh() will establish child edges

	const onChanges = (changes: CollectionChanges<T>): void => {
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

			// Changes — only for State signals
			if (change) {
				for (const item of change) {
					const key = resolveKey(item)
					if (!key) continue
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

			// Removals
			if (remove) {
				for (const item of remove) {
					const key = resolveKey(item)
					if (!key) continue
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
): Collection<T>
function deriveList<T extends {}>(
	input: (prev: T[], abort: AbortSignal) => Promise<T[]>,
	options: DeriveListOptions<T> & { initial: T[] },
): Collection<T>
function deriveList<T extends {}>(
	input: T[],
	options: DeriveListOptions<T> & { watched: CollectionCallback<T> },
): Collection<T>
function deriveList<T extends {}, U extends {}>(
	input: CollectionSource<U>,
	itemCallback: (sourceValue: U) => T,
	options?: DeriveCollectionOptions<U>,
): Collection<T>
function deriveList<T extends {}, U extends {}>(
	input: CollectionSource<U>,
	itemCallback: (sourceValue: U, abort: AbortSignal) => Promise<T>,
	options?: DeriveCollectionOptions<U>,
): Collection<T>
function deriveList<T extends {}, U extends {}>(
	input:
		| (() => T[])
		| ((prev: T[], abort: AbortSignal) => Promise<T[]>)
		| T[]
		| CollectionSource<U>,
	itemOrOptions?: DeriveCollectionCallback<T, U> | DeriveListOptions<T>,
	maybeOptions?: DeriveCollectionOptions<U>,
): Collection<T> {
	// Per-item derivation: the second argument is the callback, not the options.
	if (isFunction(itemOrOptions))
		return deriveCollection(
			input as CollectionSource<U>,
			itemOrOptions as (sourceValue: U) => T,
			maybeOptions,
		)

	const options = itemOrOptions as DeriveListOptions<T> | undefined

	// Pass-through: the source is built here, so `deriveCollection` adapts it and uses
	// the adapter's slices as the derived slices — one Memo per item, not two. The cast
	// reaches the implementation signature; no public overload omits the callback.
	const passthrough = deriveCollection as unknown as <V extends {}>(
		source: CollectionSource<V>,
		callback: undefined,
		options?: DeriveCollectionOptions<V>,
	) => Collection<V>

	// External push: a seed array plus a watched lifecycle. Checked before the
	// function branches because an array is never a computation.
	if (!isFunction(input)) {
		validateSignalValue(TYPE_COLLECTION, input, Array.isArray)
		validateCallback(TYPE_COLLECTION, options?.watched, isSyncFunction)
		// `initial` and `watched` are ignored by createCollection; the rest of the
		// options are shared verbatim.
		return createCollection(options?.watched as CollectionCallback<T>, {
			...(options as CollectionOptions<T>),
			value: input as T[],
		}) as Collection<T>
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
			options as DeriveCollectionOptions<T>,
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
		options as DeriveCollectionOptions<T>,
	)
}

/**
 * Checks if a value is a Collection signal.
 *
 * @since 0.17.2
 * @param value - The value to check
 * @returns True if the value is a Collection
 */
function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(
	value: unknown,
): value is Collection<T, S> {
	return isSignalOfType(value, TYPE_COLLECTION)
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
	type DeriveListOptions,
	deriveCollection,
	deriveList,
	isCollection,
}
