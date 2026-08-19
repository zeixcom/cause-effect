import {
	DuplicateKeyError,
	NullishSignalValueError,
	validateSignalValue,
} from '../errors'
import {
	batch,
	batchDepth,
	type Cleanup,
	DEEP_EQUALITY,
	FLAG_DIRTY,
	FLAG_RELINK,
	flush,
	type MemoNode,
	makeSubscribe,
	propagate,
	refreshComposite,
	TYPE_LIST,
	untrack,
} from '../graph'
import type { MutableSignal } from '../signal'
import { isFunction, isSignalOfType } from '../util'
import {
	type DerivedList,
	deriveCollection,
	type ListSource,
	type PerItemCallback,
} from './collection'
import { createState } from './state'

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
 * Configuration options for `createList`.
 *
 * @template T - The type of items in the list
 */
type ListOptions<
	T extends {},
	S extends MutableSignal<T> = MutableSignal<T>,
> = {
	/** Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment. */
	keyConfig?: KeyConfig<T>
	/** Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function. Stays active through structural mutations (add/remove/sort) — only the subscriber count matters. */
	watched?: () => Cleanup
	/** Equality function for item state signals. Defaults to `DEEP_EQUALITY`. */
	itemEquals?: (a: T, b: T) => boolean
	/** Factory for per-item signals. Defaults to `createState`. */
	createItem?: (value: T) => S
}

/**
 * A reactive ordered array with stable keys and per-item reactivity.
 * Each item is a `MutableSignal<T>`; structural changes (add/remove/sort) propagate reactively.
 *
 * The name this type carries in v2.0. `List` is a deprecated alias of it.
 *
 * @template T - The type of items in the list
 */
type MutableList<
	T extends {},
	S extends MutableSignal<T> = MutableSignal<T>,
> = {
	readonly [Symbol.toStringTag]: 'List'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<S>
	readonly length: number
	get(): T[]
	/**
	 * Replaces the list's content in one step, diffing against the previous value.
	 * With a `keyConfig`, an item keeps its key only while its content stays equal to the
	 * previous item at that position — changed content gets a new key instead of the old one.
	 * Without a `keyConfig`, array position is the item's identity, so the key at each index
	 * stays the same regardless of content.
	 * @param next - The desired content
	 */
	set(next: T[]): void
	update(fn: (prev: T[]) => T[]): void
	at(index: number): S | undefined
	keys(): IterableIterator<string>
	byKey(key: string): S | undefined
	keyAt(index: number): string | undefined
	indexOfKey(key: string): number
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
}

/**
 * The mutable keyed-sequence type, under its v1 name.
 *
 * @deprecated `List`'s current mutable meaning ends in v2.0 — use `MutableList` (same type,
 * same behavior today). In v2.0, `List` is the readonly base, which is today's `Collection`.
 * See [ADR-0018](../../../adr/0018-shape-indexed-signal-types.md) and `MIGRATION-2.0.md`.
 *
 * @template T - The type of items in the list
 */
type List<
	T extends {},
	S extends MutableSignal<T> = MutableSignal<T>,
> = MutableList<T, S>

/* === Functions === */

/** Shallow equality check for string arrays */
function keysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

function getKeyGenerator<T extends {}>(
	keyConfig?: KeyConfig<T>,
): [(item: T) => string, boolean, boolean] {
	let keyCounter = 0
	const contentBased = typeof keyConfig === 'function'
	// No keyConfig at all: array position is the identity contract (a plain
	// createList([1, 2, 3]) has no notion of per-value identity beyond its
	// slot). Any keyConfig — string prefix or function — signals the caller
	// wants persistent per-item identity, so a content mismatch at a shared
	// index must retire the old key rather than reuse it under new content.
	const positional = keyConfig === undefined
	return [
		typeof keyConfig === 'string'
			? () => `${keyConfig}${keyCounter++}`
			: contentBased
				? (item: T) => keyConfig(item) || String(keyCounter++)
				: () => String(keyCounter++),
		contentBased,
		positional,
	]
}

/**
 * Fast diff for positional (non-content-based) keys.
 * Avoids Map/Set allocation by iterating both arrays in one pass.
 *
 * @param positional - When true (no keyConfig given), a shared index keeps its key across a
 *   content change — position is identity. When false (string or function keyConfig), a
 *   content change at a shared index retires the old key and mints a fresh one instead of
 *   reusing it, since the caller asked for identity distinct from position.
 */
function diffPositional<T extends {}>(
	prev: T[],
	next: T[],
	prevKeys: string[],
	generateKey: (item: T) => string,
	itemEquals: (a: T, b: T) => boolean,
	positional: boolean,
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
		// biome-ignore lint/style/noNonNullAssertion: bounded by minLen
		const prevItem = prev[i]!
		// biome-ignore lint/style/noNonNullAssertion: bounded by minLen
		const nextItem = next[i]!
		if (itemEquals(prevItem, nextItem)) {
			nextKeys.push(key)
			continue
		}
		changed = true
		if (positional) {
			nextKeys.push(key)
			change[key] = nextItem
		} else {
			remove[key] = null
			const newKey = generateKey(nextItem)
			nextKeys.push(newKey)
			add[newKey] = nextItem
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
 * @param positional - When true (no keyConfig given), a shared index keeps its key across a
 *   content change. Ignored when contentBased is true. See `diffPositional`.
 * @returns The differences in DiffResult format plus updated keys array
 */
function diffArrays<T extends {}>(
	prev: T[],
	next: T[],
	prevKeys: string[],
	generateKey: (item: T) => string,
	contentBased: boolean,
	itemEquals: (a: T, b: T) => boolean,
	positional: boolean,
): DiffResult & { newKeys: string[] } {
	if (!contentBased)
		return diffPositional(
			prev,
			next,
			prevKeys,
			generateKey,
			itemEquals,
			positional,
		)

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
 * Creates a reactive list with stable keys and per-item reactivity.
 *
 * @since 0.18.0
 * @param value - Initial array of items
 * @param options.keyConfig - Key generation strategy: string prefix or `(item) => string | undefined`. Defaults to auto-increment.
 * @param options.watched - Lifecycle callback that runs when the list becomes watched. Must return a cleanup function.
 * @returns A `MutableList` signal with reactive per-item `MutableSignal`s
 */
function createList<
	T extends {},
	S extends MutableSignal<T> = MutableSignal<T>,
>(value: T[], options?: ListOptions<T, S>): MutableList<T, S> {
	validateSignalValue(TYPE_LIST, value, Array.isArray)

	const signals = new Map<string, S>()
	let keys: string[] = []

	const [generateKey, contentBased, positional] = getKeyGenerator(
		options?.keyConfig,
	)
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
		const key = generateKey(val)
		if (signals.has(key)) throw new DuplicateKeyError(TYPE_LIST, key, val)
		keys[i] = key
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
				positional,
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

			// Stage the whole inserted batch — including duplicates within the batch
			// and nullish items — before touching signals/keys, so an invalid splice
			// leaves the list unchanged. Matches createCollection's onChanges staging.
			const staged = new Set<string>()
			let index = 0
			for (const item of items) {
				// Validate before generateKey: a content-based keyConfig reading a
				// property of null/undefined would throw a bare TypeError otherwise.
				validateSignalValue(`${TYPE_LIST} item ${actualStart + index}`, item)
				index++
				const key = generateKey(item)
				if (key in remove) {
					// Same key removed and re-inserted: route to change, not add+remove.
					// A second occurrence of the same key after this hits
					// signals.has(key) — the removal has not been applied yet —
					// and throws, which is correct.
					delete remove[key]
					change[key] = item
					hasChange = true
				} else if (signals.has(key) || staged.has(key)) {
					throw new DuplicateKeyError(TYPE_LIST, key, item)
				} else {
					add[key] = item
					hasAdd = true
					staged.add(key)
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

		deriveCollection<R extends {}>(cb: PerItemCallback<R, T>): DerivedList<R> {
			return (
				deriveCollection as <T2 extends {}, U2 extends {}>(
					source: ListSource<U2>,
					callback: PerItemCallback<T2, U2>,
				) => DerivedList<T2>
			)(list, cb)
		},
	}

	return list
}

/**
 * Checks if a value is a mutable List signal.
 *
 * The name this guard carries in v2.0. `isList` is a deprecated alias of it.
 *
 * @since 1.5.0
 * @param value - The value to check
 * @returns True if the value is a mutable List
 */
function isMutableList<
	T extends {},
	S extends MutableSignal<T> = MutableSignal<T>,
>(value: unknown): value is MutableList<T, S> {
	return isSignalOfType(value, TYPE_LIST)
}

/**
 * Checks if a value is a List signal.
 *
 * @deprecated Use `isMutableList` — this guard matches only the mutable list today and
 * widens to the readonly base in v2.0.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a List
 */
function isList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(
	value: unknown,
): value is List<T, S> {
	return isMutableList<T, S>(value)
}

/* === Exports === */

export {
	createList,
	type DiffResult,
	diffArrays,
	getKeyGenerator,
	isList,
	isMutableList,
	type KeyConfig,
	keysEqual,
	type List,
	type ListOptions,
	type MutableList,
	TYPE_LIST,
	type UnknownRecord,
}
