import {
	DuplicateKeyError,
	NullishSignalValueError,
	UnsetSignalValueError,
	validateCallback,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	batch,
	batchDepth,
	type Cleanup,
	DEEP_EQUALITY,
	FLAG_DIRTY,
	FLAG_RELINK,
	flush,
	getAsyncSource,
	link,
	type MemoNode,
	makeSubscribe,
	propagate,
	refreshComposite,
	registerAsyncSource,
	SKIP_EQUALITY,
	TYPE_LIST,
	untrack,
} from '../graph'
import {
	isAsyncFunction,
	isFunction,
	isSignalOfType,
	isSyncFunction,
} from '../util'
import type { Cell, MutableCell, Signal } from './cell'
import { deriveComputed } from './memo'
import { createState } from './state'
import { createTask } from './task'

/* === Types === */

type UnknownRecord = Record<string, unknown>

type DiffResult = {
	changed: boolean
	add: UnknownRecord
	change: UnknownRecord
	remove: UnknownRecord
}

/**
 * Key generation strategy for `createList` items.
 * A string value is used as a prefix for auto-incremented keys (`prefix0`, `prefix1`, …).
 * A function receives each item and returns a stable string key, or `undefined` to fall back to auto-increment.
 *
 * @template T - The type of items in the list
 */
type KeyConfig<T> = string | ((item: T) => string | undefined)

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
 *   assignability ADR-0018 Revision Problem 1 closes elsewhere. See ADR-0018 and CE-011.
 */
type ItemSignalOptions<T extends {}, S extends Signal<T>> = {
	/** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
	keyConfig?: KeyConfig<T>
	/** Equality function for item state signals. Defaults to `DEEP_EQUALITY`. */
	itemEquals?: (a: T, b: T) => boolean
	/** Factory for per-item signals. Defaults to `createState`. */
	createItem?: (value: T) => S
}

/**
 * Configuration options for `createList`.
 *
 * @template T - The type of items in the list
 */
type ListOptions<
	T extends {},
	S extends Signal<T> & { set(value: T): void } = MutableCell<T>,
> = ItemSignalOptions<T, S> & {
	/** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. Stays active through structural mutations (add/remove/sort) — only the subscriber count matters. */
	watched?: () => Cleanup
}

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
	readonly [Symbol.toStringTag]: 'List'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<S>
	readonly length: number
	get(): T[]
	at(index: number): S | undefined
	keys(): IterableIterator<string>
	byKey(key: string): S | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
}

/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `MutableCell<T>`; structural changes (add/remove/sort) propagate reactively.
 *
 * @template T - The type of items in the list
 */
type MutableList<
	T extends {},
	S extends Signal<T> & { set(value: T): void } = MutableCell<T>,
> = List<T, S> & {
	set(next: T[]): void
	update(fn: (prev: T[]) => T[]): void
	add(value: T): string
	remove(keyOrIndex: string | number): void
	/**
	 * Updates an existing item by key and propagates to every sink.
	 * No-op if the key does not exist or the value is reference-equal to the current value.
	 * @param key - Stable key of the item to update
	 * @param value - New value for the item
	 */
	replace(key: string, value: T): void
	sort(compareFn?: (a: T, b: T) => number): void
	splice(start: number, deleteCount?: number, ...items: T[]): T[]
}

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
type ListSource<T extends {}> = List<T> | Cell<T[]>

/**
 * The minimal keyed interface the per-item derivation consumes from its source.
 * A `List` satisfies it directly; a plain `Cell<T[]>` is adapted to it.
 *
 * @template T - The type of items in the source
 */
type KeyedSource<T extends {}> = {
	keys(): IterableIterator<string>
	byKey(key: string): Cell<T> | undefined
}

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
type DeriveListOptions<
	T extends {},
	S extends Signal<T> = MutableCell<T>,
> = ItemSignalOptions<T, S> & {
	/** Initial items for an asynchronous derivation. Keeps the sequence readable before the first resolution. */
	initial?: T[]
	/** Lifecycle callback for an external-push origin. Required when `input` is a seed array. */
	watched?: ListCallback<T>
}

/**
 * Transformation callback for the per-item derivation, either sync or async.
 * A sync callback produces a `Cell<T>` per item. An async callback produces an
 * asynchronously derived `Cell<T>` per item, which cancels when the source item changes.
 *
 * @template T - The type of derived items
 * @template U - The type of source items
 */
type PerItemCallback<T extends {}, U extends {}> =
	| ((sourceValue: U) => T)
	| ((sourceValue: U, abortSignal: AbortSignal) => Promise<T>)

/**
 * Granular mutation descriptor passed to the `emit` callback inside a `ListCallback`.
 *
 * @template T - The type of items in the sequence
 */
type ListChanges<T> = {
	/** Items to add. Each item is assigned a new key via the configured `keyConfig`. */
	add?: T[]
	/** Items whose values have changed. Matched to existing entries by key. */
	change?: T[]
	/** Items to remove. Matched to existing entries by key. */
	remove?: T[]
}

/**
 * Configuration for the external-push constructor backing `deriveList(seed, { watched })`.
 * Module-private: `deriveList` is the only public route to an externally driven List.
 *
 * @template T - The type of items in the sequence
 */
type ExternalListOptions<T extends {}, S extends Signal<T> = MutableCell<T>> = {
	/** Initial items. Defaults to `[]`. */
	initial?: T[]
	/** Key generation strategy. See `KeyConfig`. Defaults to auto-increment. */
	keyConfig?: KeyConfig<T>
	/** Factory for per-item signals. Defaults to `createState`. */
	createItem?: (value: T) => S
	/** Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided. */
	itemEquals?: (a: T, b: T) => boolean
}

/**
 * Setup callback for the external-push form of `deriveList`. Runs when the sequence
 * becomes watched. Receives an `emit` function to push granular mutations into the graph.
 *
 * @template T - The type of items in the sequence
 * @param emit - Call with a `ListChanges` object to add, update, or remove items
 * @returns A cleanup function that runs when the sequence is no longer watched
 */
type ListCallback<T extends {}> = (
	emit: (changes: ListChanges<T>) => void,
) => Cleanup

/* === Functions === */

/** Shallow equality check for string arrays */
function keysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

function getKeyGenerator<T extends {}>(
	keyConfig?: KeyConfig<T>,
): [(item: T) => string, boolean] {
	let keyCounter = 0
	const contentBased = typeof keyConfig === 'function'
	return [
		typeof keyConfig === 'string'
			? () => `${keyConfig}${keyCounter++}`
			: contentBased
				? (item: T) => keyConfig(item) || String(keyCounter++)
				: () => String(keyCounter++),
		contentBased,
	]
}

/**
 * Fast diff for positional (non-content-based) keys.
 * Avoids Map/Set allocation by iterating both arrays in one pass.
 */
function diffPositional<T extends {}>(
	prev: T[],
	next: T[],
	prevKeys: string[],
	generateKey: (item: T) => string,
	itemEquals: (a: T, b: T) => boolean,
): DiffResult & { newKeys: string[] } {
	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	const nextKeys: string[] = []
	let changed = false

	const minLen = Math.min(prev.length, next.length)

	for (let i = 0; i < minLen; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by minLen
		const key = prevKeys[i]!
		nextKeys.push(key)
		// biome-ignore lint/style/noNonNullAssertion: bounded by minLen
		if (!itemEquals(prev[i]!, next[i]!)) {
			// biome-ignore lint/style/noNonNullAssertion: bounded by minLen
			change[key] = next[i]!
			changed = true
		}
	}

	for (let i = minLen; i < next.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by next.length
		const val = next[i]!
		const key = generateKey(val)
		nextKeys.push(key)
		add[key] = val
		changed = true
	}

	for (let i = minLen; i < prev.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by prev.length
		remove[prevKeys[i]!] = null
		changed = true
	}

	return { add, change, remove, newKeys: nextKeys, changed }
}

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
function diffArrays<T extends {}>(
	prev: T[],
	next: T[],
	prevKeys: string[],
	generateKey: (item: T) => string,
	contentBased: boolean,
	itemEquals: (a: T, b: T) => boolean,
): DiffResult & { newKeys: string[] } {
	if (!contentBased)
		return diffPositional(prev, next, prevKeys, generateKey, itemEquals)

	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	const nextKeys: string[] = []
	let changed = false

	// Build a map of old values by key for quick lookup
	const prevByKey = new Map<string, T>()
	for (let i = 0; i < prev.length; i++) {
		const key = prevKeys[i]
		const item = prev[i]
		if (key && item !== undefined) prevByKey.set(key, item)
	}

	// Track which old keys we've seen
	const seenKeys = new Set<string>()

	// Process new array and build new keys array
	for (let i = 0; i < next.length; i++) {
		const val = next[i]
		// Reject undefined/null elements up front, consistent with init.
		// Skipping `undefined` would leave holes in keys, so that length
		// and get() disagree.
		validateSignalValue(`${TYPE_LIST} item at index ${i}`, val)

		const key = generateKey(val)

		if (seenKeys.has(key)) throw new DuplicateKeyError(TYPE_LIST, key, val)

		nextKeys.push(key)
		seenKeys.add(key)

		// Check if this key existed before
		if (!prevByKey.has(key)) {
			add[key] = val
			changed = true
		} else if (!itemEquals(prevByKey.get(key) as T, val)) {
			change[key] = val
			changed = true
		}
	}

	// Find removed keys (existed in old but not in new)
	for (const [key] of prevByKey) {
		if (!seenKeys.has(key)) {
			remove[key] = null
			changed = true
		}
	}

	// Detect reorder even when no values changed
	if (!changed && !keysEqual(prevKeys, nextKeys)) changed = true

	return { add, change, remove, newKeys: nextKeys, changed }
}

/**
 * Adapts a plain `Cell<T[]>` to the keyed interface the per-item derivation consumes.
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
 * rather than propagating, so the sequence is empty until the source first settles.
 */
function keyedAdapter<T extends {}>(
	source: Cell<T[]>,
	options?: DeriveListOptions<T>,
): KeyedSource<T> {
	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)
	const itemEquals = options?.itemEquals ?? DEEP_EQUALITY
	const signals = new Map<string, Cell<T>>()
	const indices = new Map<string, number>()
	let keys: string[] = []
	let prev: T[] = []
	let syncedFrom: T[] | undefined

	// An unresolved Task source has no items yet — that is not an error here,
	// it is an empty sequence. Any other read failure is the caller's problem.
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
				signal = deriveComputed(
					() => {
						// Re-resolve the index against the array this recompute
						// actually sees. A consumer may hold this signal directly, so
						// it can run without the sequence's own rebuild having run
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
 * Builds the List accessor object shared by the external-push and per-item
 * derivation constructors.
 *
 * The two differ only in what has to happen before an access, which is what `prepare` and
 * `prepareValue` carry: an externally driven sequence maintains its keys through
 * `onChanges()` and only needs the watched lifecycle activated, while a derived one
 * discovers its keys inside `buildValue()` and must refresh on every access.
 *
 * @param node - The structural tracking node
 * @param getKeys - Reads the current key order; a getter because the array is reassigned
 * @param signals - The per-key child signals
 * @param prepare - Runs before a structural access
 * @param prepareValue - Runs before `get()`; must leave `node.value` current
 */
function listFacade<T extends {}, S extends Signal<T>>(
	node: MemoNode<T[]>,
	getKeys: () => string[],
	signals: Map<string, S>,
	prepare: () => void,
	prepareValue: () => void,
): List<T, S> {
	const list: List<T, S> = {
		[Symbol.toStringTag]: TYPE_LIST,
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
	}

	return list
}

/**
 * Creates a derived List from a source, with per-item memoization.
 * Module-private: `deriveList(source, itemFn)` is the public entry to this path.
 * A sync callback creates a Cell per item. An async callback creates an asynchronously
 * derived Cell per item. The node reads the source keys, so a structural change propagates.
 *
 * A `List` source is used directly, keeping its stable keys. Any other `Cell<U[]>` is keyed
 * on read — see `keyedAdapter`. This is what lets an asynchronously derived array become a
 * keyed sequence without an intermediate effect.
 *
 * @param source - The source to derive from: a List, or any `Cell<U[]>`
 * @param callback - Transformation function applied to each item
 * @param options - Key generation and item equality. Applies only to an unkeyed source.
 * @returns A List signal
 */
function derivePerItem<T extends {}, U extends {}>(
	source: ListSource<U>,
	callback: (sourceValue: U) => T,
	options?: DeriveListOptions<U>,
): List<T>
function derivePerItem<T extends {}, U extends {}>(
	source: ListSource<U>,
	callback: (sourceValue: U, abortSignal: AbortSignal) => Promise<T>,
	options?: DeriveListOptions<U>,
): List<T>
function derivePerItem<T extends {}, U extends {}>(
	sourceInput: ListSource<U>,
	// Optional only for the internal pass-through form used by `deriveList(fn)`; every
	// public overload requires it.
	callback?: PerItemCallback<T, U>,
	options?: DeriveListOptions<U>,
): List<T> {
	if (callback) validateCallback('deriveList', callback)

	// A List (mutable or readonly) is already keyed; anything else is adapted. The guard
	// must come first, because it also satisfies the structural `Cell<U[]>` type.
	const source: KeyedSource<U> = isList<U>(sourceInput)
		? (sourceInput as KeyedSource<U>)
		: keyedAdapter(sourceInput as Cell<U[]>, options)

	const isAsync = isAsyncFunction(callback)
	const signals = new Map<string, Cell<T>>()
	let keys: string[] = []

	const addSignal = (key: string): void => {
		// No callback: the source's own slice is the derived slice, so it is used
		// directly instead of being wrapped in an identity Memo. Only reachable from
		// `deriveList(fn)`, where the source is an internally built `keyedAdapter` and
		// its slices are therefore `Memo`s. It is NOT safe for a `List` source, whose
		// `byKey` returns a *mutable* signal — exposing that would leak `.set()`
		// through a read-only sequence.
		if (!callback) {
			const passthrough = untrack(() => source.byKey(key))
			if (passthrough) signals.set(key, passthrough as unknown as Cell<T>)
			return
		}

		const signal = isAsync
			? createTask(async (prev: T | undefined, abortSignal: AbortSignal) => {
					// Look up the item signal without a structural edge (byKey now
					// tracks structure), then read its value tracked so the Task
					// depends on the item's value but not on structural changes.
					// syncKeys() synchronizes the keys by reading source.keys().
					const itemSignal = untrack(() => source.byKey(key))
					if (!itemSignal) return prev as T
					const sourceValue = itemSignal.get() as U
					if (sourceValue == null) return prev as T
					return (
						callback as (sourceValue: U, abortSignal: AbortSignal) => Promise<T>
					)(sourceValue, abortSignal)
				})
			: deriveComputed(() => {
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

		signals.set(key, signal as Cell<T>)
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

	// Structural tracking node — mirrors the List/Store/external-push pattern.
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

	return listFacade<T, Cell<T>>(node, () => keys, signals, prepare, prepare)
}

/**
 * Local capability check for a writable item signal — narrower than importing
 * `isMutableCell`/`isMutableSignal`, and it keeps the item-signal contract explicit.
 * Structural, not tag-based: a custom `createItem` factory may return any `Signal`-shaped
 * item (a `Cell`, but also a `Store` or `List`), not only the narrow single-value shape.
 */
function isMutableItem<T extends {}>(
	value: Signal<T>,
): value is Signal<T> & { set(next: T): void } {
	return typeof (value as Record<string, unknown>).set === 'function'
}

/**
 * Creates an externally-driven List with a watched lifecycle.
 * Module-private: `deriveList(seed, { watched })` is the only public route here.
 *
 * The watched callback receives an `emit(changes)` helper to manage items. The
 * sequence activates when an effect first reads it, and deactivates when it is no
 * longer watched. A structural mutation through `emit` does not restart that lifecycle.
 *
 * @param options - Configuration including the watched lifecycle, initial items, key generation, and item signal creation
 * @param options.watched - Callback that runs when the sequence becomes watched. Receives the emit helper.
 * @returns A read-only List signal
 */
function createExternalList<T extends {}, S extends Signal<T> = MutableCell<T>>(
	options: ExternalListOptions<T, S> & { watched: ListCallback<T> },
): List<T, S> {
	const watched = options.watched
	const initial = options.initial ?? []
	if (initial.length) validateSignalValue('deriveList', initial, Array.isArray)
	validateCallback('deriveList', watched, isSyncFunction)

	const signals = new Map<string, S>()
	const keys: string[] = []
	const itemToKey = new Map<T, string>()

	const [generateKey, contentBased] = getKeyGenerator(options.keyConfig)

	const resolveKey = (item: T): string | undefined =>
		itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined)

	const itemFactory = (options.createItem ??
		((item: T) =>
			createState(item, {
				equals: options.itemEquals ?? DEEP_EQUALITY,
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
		value: initial,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: SKIP_EQUALITY, // Always rebuild — structural changes are managed externally
		error: undefined,
	}

	// Initialize signals for the initial items
	for (const item of initial) {
		const key = generateKey(item)
		signals.set(key, itemFactory(item))
		itemToKey.set(item, key)
		keys.push(key)
	}
	node.value = initial
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
						throw new DuplicateKeyError('deriveList', key, item)
					staged.set(key, item)
				}
				for (const [key, item] of staged) {
					signals.set(key, itemFactory(item))
					itemToKey.set(item, key)
					if (!keys.includes(key)) keys.push(key)
					structural = true
				}
			}

			// Changes — only for a writable item signal
			if (change) {
				for (const item of change) {
					const key = resolveKey(item)
					if (!key) continue
					const signal = signals.get(key)
					if (signal && isMutableItem(signal)) {
						// Update reverse map: remove old reference, add new.
						// untrack prevents the read from leaking an edge into
						// the caller's effect when emit is called inside one.
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
	return listFacade<T, S>(
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
function deriveList<T extends {}>(
	input: () => T[],
	options?: DeriveListOptions<T>,
): List<T>
function deriveList<T extends {}>(
	input: (prev: T[], abortSignal: AbortSignal) => Promise<T[]>,
	options: DeriveListOptions<T> & { initial: T[] },
): List<T>
function deriveList<T extends {}, S extends Signal<T> = MutableCell<T>>(
	input: T[],
	options: DeriveListOptions<T, S> & { watched: ListCallback<T> },
): List<T, S>
function deriveList<T extends {}, U extends {}>(
	input: ListSource<U>,
	itemCallback: (sourceValue: U) => T,
	options?: DeriveListOptions<U>,
): List<T>
function deriveList<T extends {}, U extends {}>(
	input: ListSource<U>,
	itemCallback: (sourceValue: U, abortSignal: AbortSignal) => Promise<T>,
	options?: DeriveListOptions<U>,
): List<T>
function deriveList<
	T extends {},
	U extends {},
	S extends Signal<T> = MutableCell<T>,
>(
	input:
		| (() => T[])
		| ((prev: T[], abortSignal: AbortSignal) => Promise<T[]>)
		| T[]
		| ListSource<U>,
	itemOrOptions?: PerItemCallback<T, U> | DeriveListOptions<T, S>,
	maybeOptions?: DeriveListOptions<U>,
): List<T, S> {
	// Per-item derivation: the second argument is the callback, not the options.
	// S participates only in the external-push overload; here it defaults to Cell<T>.
	if (isFunction(itemOrOptions))
		return derivePerItem(
			input as ListSource<U>,
			itemOrOptions as (sourceValue: U) => T,
			maybeOptions,
		) as List<T, S>

	const options = itemOrOptions as DeriveListOptions<T, S> | undefined

	// Pass-through: the source is built here, so `derivePerItem` adapts it and uses
	// the adapter's slices as the derived slices — one Memo per item, not two. The cast
	// reaches the implementation signature; no public overload omits the callback.
	const passthrough = derivePerItem as unknown as <V extends {}>(
		source: ListSource<V>,
		callback: undefined,
		options?: DeriveListOptions<V>,
	) => List<V>

	// External push: a seed array plus a watched lifecycle. Checked before the
	// function branches because an array is never a computation.
	if (!isFunction(input)) {
		validateSignalValue('deriveList', input, Array.isArray)
		validateCallback('deriveList', options?.watched, isSyncFunction)
		// The seed takes the place of `initial`; the rest of the options are
		// shared verbatim with the external-push constructor.
		return createExternalList({
			...(options as ExternalListOptions<T, S>),
			watched: options?.watched as ListCallback<T>,
			initial: input as T[],
		}) as List<T, S>
	}

	// Asynchronous derivation. `initial` defaults to empty rather than throwing:
	// the contract is that the sequence is never unset, and an empty seed satisfies
	// it. `isPending()` carries the loading distinction instead of the value.
	if (isAsyncFunction(input)) {
		const task = createTask(
			input as (prev: T[], abortSignal: AbortSignal) => Promise<T[]>,
			{ initial: options?.initial ?? [] },
		)
		const derived = passthrough<T>(
			task as Cell<T[]>,
			undefined,
			// keyedAdapter/derivePerItem never read `options.createItem` on this path — the
			// sync/async-fn-derivation origin always builds items via deriveComputed/createTask
			// regardless of what a caller passes there — so the value doesn't need to satisfy
			// DeriveListOptions's own (MutableCell-defaulted) createItem field, only the shape
			// passthrough's signature declares. The double cast documents that gap explicitly.
			options as unknown as DeriveListOptions<T>,
		)
		// The asynchrony lives in the internal asynchronous derivation, so `isPending(derived)`
		// and `abort(derived)` resolve through it. See ADR-0018.
		const asyncSource = getAsyncSource(task)
		if (asyncSource) registerAsyncSource(derived, asyncSource)
		return derived as List<T, S>
	}

	// Synchronous derivation.
	return passthrough<T>(
		deriveComputed(input as () => T[]) as Cell<T[]>,
		undefined,
		// See the async branch above: this path never reads options.createItem either.
		options as unknown as DeriveListOptions<T>,
	) as List<T, S>
}

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
function createList<
	T extends {},
	S extends Signal<T> & { set(value: T): void } = MutableCell<T>,
>(value: T[], options?: ListOptions<T, S>): MutableList<T, S> {
	validateSignalValue(TYPE_LIST, value, Array.isArray)

	const signals = new Map<string, S>()
	let keys: string[] = []

	const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig)
	const itemEquals = options?.itemEquals ?? DEEP_EQUALITY
	const itemFactory = (options?.createItem ??
		((item: T) => createState(item, { equals: itemEquals }))) as (value: T) => S

	// --- Internal helpers ---

	// Build current value from child signals
	const buildValue = (): T[] => {
		const result: T[] = []
		for (const key of keys) {
			const v = signals.get(key)?.get()
			if (v !== undefined) result.push(v)
		}
		return result
	}

	// Structural tracking node — not a general-purpose Memo.
	// On first get(): refresh() establishes edges from child signals.
	// On subsequent get(): untrack(buildValue) rebuilds without re-linking.
	// Mutation methods set FLAG_RELINK to force re-establishment on next read.
	const node: MemoNode<T[]> = {
		fn: buildValue,
		value,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: DEEP_EQUALITY,
		error: undefined,
	}

	const applyChanges = (changes: DiffResult): boolean => {
		let structural = false

		// Additions
		for (const key in changes.add) {
			const val = changes.add[key] as T
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val)
			signals.set(key, itemFactory(val))
			structural = true
		}

		// Changes
		let hasChange = false
		for (const _key in changes.change) {
			hasChange = true
			break
		}
		if (hasChange) {
			batch(() => {
				for (const key in changes.change) {
					const val = changes.change[key]
					validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val)
					const signal = signals.get(key)
					if (signal) signal.set(val as T)
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
			const index = keys.indexOf(key)
			if (index !== -1) keys.splice(index, 1)
			structural = true
		}

		if (structural) node.flags |= FLAG_RELINK

		return changes.changed
	}

	const subscribe = makeSubscribe(node, options?.watched)

	// --- Initialize ---
	for (let i = 0; i < value.length; i++) {
		const val = value[i]
		if (val == null) throw new NullishSignalValueError(`${TYPE_LIST} item ${i}`)
		let key = keys[i]
		if (!key) {
			key = generateKey(val)
			keys[i] = key
		}
		signals.set(key, itemFactory(val))
	}

	// Stays dirty: the initial value is correct, but child signals are not
	// yet linked as sources of this node. get()'s first-access branch relies
	// on refresh() calling recomputeMemo() (which only runs when FLAG_DIRTY
	// is set) to tracked-call buildValue() and establish those edges — a
	// clean node here would make refresh() a no-op and leave get() returning
	// this same unlinked snapshot forever, even after a nested item signal
	// (e.g. a Store) changes directly.
	node.value = value

	// --- List object ---
	const list: MutableList<T, S> = {
		[Symbol.toStringTag]: TYPE_LIST,
		[Symbol.isConcatSpreadable]: true as const,

		*[Symbol.iterator]() {
			subscribe()
			for (const key of keys) {
				const signal = signals.get(key)
				if (signal) yield signal
			}
		},

		get length() {
			subscribe()
			return keys.length
		},

		get() {
			subscribe()
			refreshComposite(node, buildValue)
			return node.value
		},

		set(next: T[]) {
			// Use cached value if clean, recompute if dirty. untrack prevents
			// buildValue's child .get() calls from leaking edges into whatever
			// effect is currently active (which would cause over-broad re-runs).
			const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value
			const changes = diffArrays(
				prev,
				next,
				keys,
				generateKey,
				contentBased,
				itemEquals,
			)
			if (changes.changed) {
				keys = changes.newKeys
				applyChanges(changes)
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		update(fn: (prev: T[]) => T[]) {
			list.set(fn(untrack(() => list.get())))
		},

		at(index: number) {
			subscribe()
			const key = keys[index]
			return key !== undefined ? signals.get(key) : undefined
		},

		keys() {
			subscribe()
			return keys.values()
		},

		byKey(key: string) {
			subscribe()
			return signals.get(key)
		},

		keyAt(index: number) {
			subscribe()
			return keys[index]
		},

		indexOfKey(key: string) {
			subscribe()
			return keys.indexOf(key)
		},

		add(value: T) {
			const key = generateKey(value)
			if (signals.has(key)) throw new DuplicateKeyError(TYPE_LIST, key, value)
			keys.push(key)
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value)
			signals.set(key, itemFactory(value))
			node.flags |= FLAG_DIRTY | FLAG_RELINK
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			if (batchDepth === 0) flush()
			return key
		},

		remove(keyOrIndex: string | number) {
			const key = typeof keyOrIndex === 'number' ? keys[keyOrIndex] : keyOrIndex
			if (key === undefined) return
			const ok = signals.delete(key)
			if (ok) {
				const index =
					typeof keyOrIndex === 'number' ? keyOrIndex : keys.indexOf(key)
				if (index >= 0) keys.splice(index, 1)
				node.flags |= FLAG_DIRTY | FLAG_RELINK
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		replace(key: string, value: T) {
			const signal = signals.get(key)
			if (!signal) return
			validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value)
			if (
				itemEquals(
					untrack(() => signal.get()),
					value,
				)
			)
				return
			// Batch the item-signal set and the structural node propagation so
			// sinks that hold both edges (e.g. byKey(k).get()) flush once
			// instead of once per edge. Without the batch, signal.set() flushes
			// immediately, then the node propagation flushes again.
			batch(() => {
				signal.set(value)
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			})
			if (batchDepth === 0) flush()
		},

		sort(compareFn?: (a: T, b: T) => number) {
			const entries: [string, T][] = []
			untrack(() => {
				for (const key of keys) {
					const v = signals.get(key)?.get()
					if (v !== undefined) entries.push([key, v])
				}
			})
			entries.sort(
				isFunction(compareFn)
					? (a, b) => compareFn(a[1], b[1])
					: (a, b) => String(a[1]).localeCompare(String(b[1])),
			)
			const newOrder: string[] = []
			for (const [key] of entries) newOrder.push(key)

			if (!keysEqual(keys, newOrder)) {
				keys = newOrder
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		splice(start: number, deleteCount?: number, ...items: T[]) {
			const length = keys.length
			const actualStart =
				start < 0 ? Math.max(0, length + start) : Math.min(start, length)
			const actualDeleteCount = Math.max(
				0,
				Math.min(
					deleteCount ?? Math.max(0, length - Math.max(0, actualStart)),
					length - actualStart,
				),
			)

			const add = {} as Record<string, T>
			const remove = {} as Record<string, T>
			let hasRemove = false

			// Collect items to delete — untrack the reads so the caller's
			// effect does not gain edges to the deleted item signals.
			untrack(() => {
				for (let i = 0; i < actualDeleteCount; i++) {
					const index = actualStart + i
					const key = keys[index]
					if (key) {
						const signal = signals.get(key)
						if (signal) {
							remove[key] = signal.get()
							hasRemove = true
						}
					}
				}
			})

			// Build new key order
			const newOrder = keys.slice(0, actualStart)
			const change = {} as Record<string, T>
			let hasAdd = false
			let hasChange = false

			for (const item of items) {
				const key = generateKey(item)
				if (key in remove) {
					// Same key removed and re-inserted: route to change, not add+remove
					delete remove[key]
					change[key] = item
					hasChange = true
				} else if (signals.has(key)) {
					throw new DuplicateKeyError(TYPE_LIST, key, item)
				} else {
					add[key] = item
					hasAdd = true
				}
				newOrder.push(key)
			}

			newOrder.push(...keys.slice(actualStart + actualDeleteCount))

			const changed = hasAdd || hasRemove || hasChange

			if (changed) {
				applyChanges({
					add,
					change,
					remove,
					changed,
				})
				keys = newOrder
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}

			return Object.values(remove)
		},
	}

	return list
}

/**
 * Checks if a value is a List signal — the readonly base, matching both the mutable and
 * readonly keyed-sequence shapes. Use `isMutableList` to also require write access.
 *
 * @since 2.0.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
function isList<T extends {}, S extends Signal<T> = Cell<T>>(
	value: unknown,
): value is List<T, S> {
	return isSignalOfType(value, TYPE_LIST)
}

/**
 * Checks if a value is a mutable List signal.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a mutable List
 */
function isMutableList<
	T extends {},
	S extends Signal<T> & { set(value: T): void } = MutableCell<T>,
>(value: unknown): value is MutableList<T, S> {
	return (
		isList(value) &&
		typeof (value as Record<string, unknown>).add === 'function'
	)
}

/* === Exports === */

export {
	createList,
	type DeriveListOptions,
	type DiffResult,
	deriveList,
	diffArrays,
	getKeyGenerator,
	isList,
	isMutableList,
	type KeyConfig,
	keysEqual,
	type List,
	type ListCallback,
	type ListChanges,
	type ListOptions,
	type ListSource,
	type MutableList,
	type PerItemCallback,
	TYPE_LIST,
	type UnknownRecord,
}
