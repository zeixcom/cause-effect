import {
	DuplicateKeyError,
	InvalidStoreMutationError,
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
	link,
	type MemoNode,
	makeSubscribe,
	propagate,
	refresh,
	refreshComposite,
	registerAsyncSource,
	type Signal,
	type SinkNode,
	TYPE_STORE,
	untrack,
} from '../graph'
import {
	isAsyncFunction,
	isFunction,
	isRecord,
	isSignalOfType,
	isSyncFunction,
} from '../util'
import {
	createList,
	type DiffResult,
	isMutableList,
	keysEqual,
	type MutableList,
	type UnknownRecord,
} from './list'
import { createMemo } from './memo'
import { createState, type State } from './state'
import { createTask } from './task'

/* === Types === */

/**
 * Configuration options for `createStore`.
 */
type StoreOptions = {
	/** Runs when the store becomes watched. Returns a cleanup that runs when it is no longer watched. */
	watched?: () => Cleanup
}

type BaseStore<T extends UnknownRecord> = {
	readonly [Symbol.toStringTag]: 'Store'
	readonly [Symbol.isConcatSpreadable]: false
	[Symbol.iterator](): IterableIterator<
		[
			string,
			State<T[keyof T] & {}> | Store<UnknownRecord> | MutableList<unknown & {}>,
		]
	>
	keys(): IterableIterator<string>
	byKey<K extends keyof T & string>(
		key: K,
	): T[K] extends readonly (infer U extends {})[]
		? MutableList<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: T[K] extends unknown & {}
				? State<T[K] & {}>
				: State<T[K] & {}> | undefined
	get(): T
	set(next: T): void
	update(fn: (prev: T) => T): void
	add<K extends keyof T & string>(key: K, value: T[K]): K
	remove(key: string): void
}

/**
 * A reactive object with per-property reactivity.
 * Each property becomes a `State`, a nested `Store`, or a `List`, reachable through the proxy.
 * A write to one property re-runs only the effects that read that property.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type Store<T extends UnknownRecord> = BaseStore<T> & {
	[K in keyof T]: T[K] extends readonly (infer U extends {})[]
		? MutableList<U>
		: T[K] extends UnknownRecord
			? Store<T[K]>
			: T[K] extends unknown & {}
				? State<T[K] & {}>
				: State<T[K] & {}> | undefined
}

/**
 * The read-only projection of a Store, returned by `deriveStore`.
 * Each property is a `Signal`, reachable through the proxy exactly as on a `Store`.
 * There is no `set`, `update`, `add`, or `remove` — a derived record is written only by
 * its derivation.
 *
 * @template T - The plain-object type whose properties become reactive signals
 */
type BaseDerivedStore<T extends UnknownRecord> = {
	readonly [Symbol.toStringTag]: 'Store'
	readonly [Symbol.isConcatSpreadable]: false
	[Symbol.iterator](): IterableIterator<[string, Signal<T[keyof T] & {}>]>
	keys(): IterableIterator<string>
	byKey<K extends keyof T & string>(key: K): Signal<T[K] & {}> | undefined
	get(): T
}

type DerivedStore<T extends UnknownRecord> = BaseDerivedStore<T> & {
	[K in keyof T]: Signal<T[K] & {}> | undefined
}

/**
 * Setup callback for the external-push form of `deriveStore`.
 * Receives an `emit` function that merges a partial record into the store.
 *
 * @template T - The plain-object type held by the store
 */
type StoreCallback<T extends UnknownRecord> = (
	emit: (patch: Partial<T>) => void,
) => Cleanup

/**
 * Configuration options for `deriveStore`.
 *
 * @template T - The plain-object type held by the store
 */
type DeriveStoreOptions<T extends UnknownRecord> = {
	/** Seed value for an asynchronous derivation. Keeps the record readable before the first resolution. */
	initial?: T
	/** Lifecycle callback for an external-push origin. Required when `input` is a seed record. */
	watched?: StoreCallback<T>
}

/* === Functions === */

/**
 * The proxy handler shared by `createStore` and `deriveStore`.
 *
 * It reaches the child signals only through `byKey()` and `keys()`, which both store
 * shapes implement, so one handler serves the mutable and the read-only store alike.
 * Every write trap throws — see ADR-0017 for why a proxy assignment is rejected rather
 * than forwarded to the child signal.
 */
type ProxyTarget = {
	keys(): IterableIterator<string>
	byKey(key: never): unknown
}

const storeProxyHandler: ProxyHandler<ProxyTarget> = {
	get(target, prop) {
		if (prop in target) return Reflect.get(target, prop)
		if (typeof prop !== 'symbol') return target.byKey(prop as never)
	},
	set(_target, prop) {
		throw new InvalidStoreMutationError(String(prop), 'assign to')
	},
	deleteProperty(_target, prop) {
		throw new InvalidStoreMutationError(String(prop), 'delete')
	},
	defineProperty(_target, prop) {
		throw new InvalidStoreMutationError(String(prop), 'define')
	},
	has(target, prop) {
		if (prop in target) return true
		return target.byKey(String(prop) as never) !== undefined
	},
	ownKeys(target) {
		return Array.from(target.keys())
	},
	getOwnPropertyDescriptor(target, prop) {
		if (prop in target) return Reflect.getOwnPropertyDescriptor(target, prop)
		if (typeof prop === 'symbol') return undefined
		const signal = target.byKey(String(prop) as never)
		return signal
			? { enumerable: true, configurable: true, writable: true, value: signal }
			: undefined
	},
}

/** Diff two records and return granular changes */
function diffRecords<T extends UnknownRecord>(prev: T, next: T): DiffResult {
	const add = {} as UnknownRecord
	const change = {} as UnknownRecord
	const remove = {} as UnknownRecord
	let changed = false

	const prevKeys = Object.keys(prev)
	const nextKeys = Object.keys(next)

	// Pass 1: iterate new keys — find additions and changes
	for (const key of nextKeys) {
		if (key in prev) {
			if (
				!DEEP_EQUALITY(prev[key] as unknown & {}, next[key] as unknown & {})
			) {
				change[key] = next[key]
				changed = true
			}
		} else {
			add[key] = next[key]
			changed = true
		}
	}

	// Pass 2: iterate old keys — find removals
	for (const key of prevKeys) {
		if (!(key in next)) {
			remove[key] = undefined
			changed = true
		}
	}

	return { add, change, remove, changed }
}

/**
 * Creates a reactive store with deeply nested reactive properties.
 * Each property becomes its own signal. A primitive becomes a State, an object becomes a
 * nested Store, and an array becomes a List. The proxy exposes each property directly.
 *
 * @since 0.15.0
 * @param value - Initial object value of the store
 * @param options - Optional configuration for watch lifecycle
 * @returns A Store with reactive properties
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
function createStore<T extends UnknownRecord>(
	value: T,
	options?: StoreOptions,
): Store<T> {
	validateSignalValue(TYPE_STORE, value, isRecord)

	const signals = new Map<
		string,
		State<unknown & {}> | Store<UnknownRecord> | MutableList<unknown & {}>
	>()

	// --- Internal helpers ---

	const addSignal = (key: string, val: unknown): void => {
		validateSignalValue(`${TYPE_STORE} for key "${key}"`, val)
		if (Array.isArray(val)) signals.set(key, createList(val))
		else if (isRecord(val)) signals.set(key, createStore(val))
		else signals.set(key, createState(val as unknown & {}))
	}

	// Returns the reactive node category a value maps to, mirroring addSignal.
	// Used to detect type changes (e.g. primitive -> array) that require
	// replacing the child signal rather than calling .set on the existing one.
	type ShapeCategory = 'list' | 'store' | 'state'
	const shapeCategory = (val: unknown): ShapeCategory => {
		if (Array.isArray(val)) return 'list'
		if (isRecord(val)) return 'store'
		return 'state'
	}
	const signalCategory = (
		signal:
			| State<unknown & {}>
			| Store<UnknownRecord>
			| MutableList<unknown & {}>,
	): ShapeCategory => {
		if (isMutableList(signal)) return 'list'
		if (isStore(signal)) return 'store'
		return 'state'
	}

	// Build current value from child signals
	const buildValue = (): T => {
		const record = {} as UnknownRecord
		for (const [key, signal] of signals) record[key] = signal.get()
		return record as T
	}

	// Structural tracking node — not a general-purpose Memo.
	// On first get(): refresh() establishes edges from child signals.
	// On subsequent get(): untrack(buildValue) rebuilds without re-linking.
	// Mutation methods set FLAG_RELINK to force re-establishment on next read.
	const node: MemoNode<T> = {
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
			addSignal(key, changes.add[key])
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
					validateSignalValue(`${TYPE_STORE} for key "${key}"`, val)
					const signal = signals.get(key)
					if (signal) {
						// Type changed (e.g. primitive -> array, array -> object):
						// replace the child signal. Comparing shape categories
						// catches array<->primitive and array<->record transitions
						// that isRecord-only checks miss (arrays are not records).
						if (shapeCategory(val) !== signalCategory(signal)) {
							addSignal(key, val)
							structural = true
						} else signal.set(val as never)
					}
				}
			})
		}

		// Removals
		for (const key in changes.remove) {
			signals.delete(key)
			structural = true
		}

		if (structural) node.flags |= FLAG_RELINK

		return changes.changed
	}

	const subscribe = makeSubscribe(node, options?.watched)

	// --- Initialize ---
	for (const key of Object.keys(value)) addSignal(key, value[key])

	// --- Store object ---
	const store: BaseStore<T> = {
		[Symbol.toStringTag]: TYPE_STORE,
		[Symbol.isConcatSpreadable]: false as const,

		*[Symbol.iterator]() {
			subscribe()
			for (const [key, signal] of signals) {
				yield [key, signal] as [
					string,
					(
						| State<T[keyof T] & {}>
						| Store<UnknownRecord>
						| MutableList<unknown & {}>
					),
				]
			}
		},

		keys() {
			subscribe()
			return signals.keys()
		},

		byKey<K extends keyof T & string>(key: K) {
			return signals.get(key) as T[K] extends readonly (infer U extends {})[]
				? MutableList<U>
				: T[K] extends UnknownRecord
					? Store<T[K]>
					: T[K] extends unknown & {}
						? State<T[K] & {}>
						: State<T[K] & {}> | undefined
		},

		get() {
			subscribe()
			refreshComposite(node, buildValue)
			return node.value
		},

		set(next: T) {
			// Use cached value if clean, recompute if dirty. untrack prevents
			// buildValue's child .get() calls from leaking edges into whatever
			// effect is currently active (which would cause over-broad re-runs).
			const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value

			const changes = diffRecords(prev, next)
			if (applyChanges(changes)) {
				node.flags |= FLAG_DIRTY
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},

		update(fn: (prev: T) => T) {
			store.set(fn(untrack(() => store.get())))
		},

		add<K extends keyof T & string>(key: K, value: T[K]) {
			if (signals.has(key)) throw new DuplicateKeyError(TYPE_STORE, key, value)
			addSignal(key, value)
			node.flags |= FLAG_DIRTY | FLAG_RELINK
			for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
			if (batchDepth === 0) flush()
			return key
		},

		remove(key: string) {
			const ok = signals.delete(key)
			if (ok) {
				node.flags |= FLAG_DIRTY | FLAG_RELINK
				for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
				if (batchDepth === 0) flush()
			}
		},
	}

	// --- Proxy ---
	return new Proxy(
		store as unknown as ProxyTarget,
		storeProxyHandler,
	) as unknown as Store<T>
}

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
function deriveStore<T extends UnknownRecord>(
	input: () => T,
	options?: DeriveStoreOptions<T>,
): DerivedStore<T>
function deriveStore<T extends UnknownRecord>(
	input: (prev: T, abort: AbortSignal) => Promise<T>,
	options: DeriveStoreOptions<T> & { initial: T },
): DerivedStore<T>
function deriveStore<T extends UnknownRecord>(
	input: T,
	options: DeriveStoreOptions<T> & { watched: StoreCallback<T> },
): DerivedStore<T>
function deriveStore<T extends UnknownRecord>(
	input: (() => T) | ((prev: T, abort: AbortSignal) => Promise<T>) | T,
	options?: DeriveStoreOptions<T>,
): DerivedStore<T> {
	// External push: a seed record plus a watched lifecycle. A mutable Store already
	// implements exactly this — granular child signals driven from outside — so it
	// backs the read-only facade rather than being reimplemented.
	if (!isFunction(input)) {
		validateSignalValue(TYPE_STORE, input, isRecord)
		const watched = options?.watched as StoreCallback<T>
		validateCallback(TYPE_STORE, watched, isSyncFunction)
		let inner: Store<T>
		const emit = (patch: Partial<T>): void => {
			inner.update(prev => ({ ...prev, ...patch }))
		}
		inner = createStore(input as T, { watched: () => watched(emit) })
		return readonlyFacade(
			() => inner.get(),
			() => inner.keys(),
			key => inner.byKey(key) as unknown as Signal<T[keyof T & string] & {}>,
		) as DerivedStore<T>
	}

	// Normalize the computation to a single-value source. `initial` defaults to an
	// empty record rather than throwing: the contract is that the record is never
	// unset, and an empty seed satisfies it. `isPending()` carries the loading state.
	const task = isAsyncFunction(input)
		? createTask(input as (prev: T, abort: AbortSignal) => Promise<T>, {
				value: (options?.initial ?? {}) as T,
			})
		: undefined
	const source: Signal<T> =
		(task as Signal<T> | undefined) ??
		(createMemo(input as () => T) as Signal<T>)

	// An unresolved Task source has no properties yet — that is an empty record here,
	// not an error. Any other read failure is the caller's problem.
	const readSource = (): T => {
		try {
			return source.get()
		} catch (e) {
			if (e instanceof UnsetSignalValueError) return {} as T
			throw e
		}
	}

	const signals = new Map<string, Signal<unknown & {}>>()
	let keys: string[] = []

	// Each property reads the source itself rather than being written to, which is what
	// keeps this a derivation: the property signal is a real graph sink of the source,
	// and its `equals` stops propagation for a property that did not change.
	const addSignal = (key: string): void => {
		signals.set(
			key,
			createMemo(() => readSource()[key] as unknown & {}, {
				equals: DEEP_EQUALITY,
			}),
		)
	}

	// Intentionally side-effectful: reconciles the private signals map and keys array,
	// and flags the node for relinking when the key set changed.
	const syncKeys = (next: T): void => {
		const nextKeys = Object.keys(next)
		if (keysEqual(keys, nextKeys)) return
		const nextSet = new Set(nextKeys)
		for (const key of keys) if (!nextSet.has(key)) signals.delete(key)
		for (const key of nextKeys) if (!signals.has(key)) addSignal(key)
		keys = nextKeys
		node.flags |= FLAG_RELINK
	}

	// Reads the source to sync the signals map and — during refresh() — to establish
	// the source → node edge, then composes the record from the property signals.
	function buildValue(): T {
		syncKeys(readSource())
		const record = {} as UnknownRecord
		for (const key of keys) {
			try {
				const v = signals.get(key)?.get()
				if (v !== undefined) record[key] = v
			} catch (e) {
				// Skip a pending async property; rethrow a real error.
				if (!(e instanceof UnsetSignalValueError)) throw e
			}
		}
		return record as T
	}

	const node: MemoNode<T> = {
		fn: buildValue,
		value: (options?.initial ?? {}) as T,
		flags: FLAG_DIRTY,
		sources: null,
		sourcesTail: null,
		sinks: null,
		sinksTail: null,
		equals: DEEP_EQUALITY,
		error: undefined,
	}

	// buildValue() discovers key changes itself, so this is the derived variant.
	const ensureFresh = (): void => {
		refreshComposite(node, buildValue, true)
	}

	// Populate the signals map for direct access. untrack suppresses edge creation;
	// the first refresh() establishes the real graph edges.
	syncKeys(untrack(readSource))
	node.flags = FLAG_DIRTY

	const derived = readonlyFacade(
		() => {
			if (activeSink) link(node, activeSink)
			ensureFresh()
			return node.value
		},
		() => {
			if (activeSink) link(node, activeSink)
			ensureFresh()
			return keys.values()
		},
		// No structural edge here, matching createStore: a property read is already
		// granular, and subscribing it to "any key added or removed" would defeat the
		// per-property reactivity that is the point of a Store. ensureFresh() still
		// runs so the signals map reflects the current source. See ADR-0015.
		key => {
			ensureFresh()
			return signals.get(key) as Signal<T[keyof T & string] & {}> | undefined
		},
	) as DerivedStore<T>

	// The asynchrony lives in the internal Task, so `isPending(derived)` and
	// `abort(derived)` resolve through it. See ADR-0018.
	if (task) registerAsyncSource(derived, task)
	return derived
}

/**
 * Builds the read-only Store facade shared by both `deriveStore` origins.
 * The proxy mirrors `createStore`'s: a property that is not a base method resolves to the
 * child signal, and every write trap throws.
 */
function readonlyFacade<T extends UnknownRecord>(
	read: () => T,
	readKeys: () => IterableIterator<string>,
	readByKey: (key: string) => Signal<unknown & {}> | undefined,
): DerivedStore<T> {
	const store: BaseDerivedStore<T> = {
		[Symbol.toStringTag]: TYPE_STORE,
		[Symbol.isConcatSpreadable]: false as const,

		*[Symbol.iterator]() {
			for (const key of readKeys()) {
				const signal = readByKey(key)
				if (signal) yield [key, signal] as [string, Signal<T[keyof T] & {}>]
			}
		},

		keys: readKeys,

		byKey<K extends keyof T & string>(key: K) {
			return readByKey(key) as Signal<T[K] & {}> | undefined
		},

		get: read,
	}

	return new Proxy(
		store as unknown as ProxyTarget,
		storeProxyHandler,
	) as unknown as DerivedStore<T>
}

/**
 * Checks if a value is a Store signal.
 *
 * @since 0.15.0
 * @param value - The value to check
 * @returns True if the value is a Store
 */
function isStore<T extends UnknownRecord>(value: unknown): value is Store<T> {
	return isSignalOfType(value, TYPE_STORE)
}

/* === Exports === */

export {
	createStore,
	type DerivedStore,
	type DeriveStoreOptions,
	deriveStore,
	isStore,
	type Store,
	type StoreCallback,
	type StoreOptions,
	TYPE_STORE,
}
