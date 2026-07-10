# Changelog

## [Unreleased]

### Added

- **`EffectConvergenceError`**: New error class (exported from the package root), thrown when queued effects keep re-triggering each other without settling within 1000 flush passes. Typical triggers: an effect that unconditionally writes a signal it reads (`createEffect(() => count.set(count.get() + 1))`), or two effects that write each other's dependencies. The error surfaces synchronously from the `set()`/`update()`/`batch()`/`createEffect()` call that triggered the runaway; other queued effects still run before it is thrown.

### Fixed

- **A throwing effect no longer skips sibling effects in the same flush** (`src/graph.ts`): Previously, an exception from one effect's callback propagated out of `flush()` immediately — all effects queued after it were silently skipped (their DOM updates and subscriptions lost until some arbitrary later flush), and the throwing effect was left stuck with `FLAG_RUNNING` set, so its next `refresh()` threw a spurious `CircularDependencyError`. Now `flush()` catches per-effect errors, drains the entire queue, and rethrows after: a single error is rethrown as-is (error identity preserved for existing `catch` code), multiple errors are wrapped in an `AggregateError`. `runEffect()` clears `FLAG_RUNNING` in its `finally`, so a previously-throwing effect re-runs normally on the next update.
- **Effects that write signals they depend on now converge** (`src/graph.ts`, `src/nodes/effect.ts`): Previously, `runEffect()` unconditionally overwrote the node's flags with `FLAG_CLEAN` after running, clobbering the dirty re-mark set by the effect's own write — so even a converging clamp effect (`if (v > 10) s.set(10)`) ended one run stale, having rendered the pre-clamp value while the signal held the clamped one; two subscribers of the same signal could disagree. Now `flush()` drains `queuedEffects` in passes over snapshots (effects re-queued during a pass run in the next pass), `propagate()` preserves `FLAG_RUNNING` on effects, and `runEffect()` preserves `FLAG_DIRTY`/`FLAG_CHECK` from the effect's own writes — a self-writing effect re-runs until the graph settles and its last run always observes the final signal values. Creation-time self-writes converge through the same path via a new internal `scheduleEffect()`, which also removes a re-entrant `runEffect` hazard (a write during an effect's creation run previously re-entered the still-running effect via the nested flush).
- **Mutual effect writes no longer hang the process** (`src/graph.ts`): Previously, two effects writing each other's dependencies re-queued each other forever inside one `flush()`, growing the queue until heap exhaustion — there was no loop guard. Now the flush-pass cap (1000) converts this into a loud `EffectConvergenceError` while sibling effects still run.
- **`List` and `Store` mutation methods leaked dependency edges into the caller's effect** (`src/nodes/list.ts`, `src/nodes/store.ts`, `src/nodes/collection.ts`): `List.set()`, `List.sort()`, `List.splice()`, `List.update()`, `Store.update()`, and `createCollection`'s `onChanges` change branch read child item signals without `untrack()`. Calling any of them inside an effect silently subscribed that effect to every item signal touched — causing over-broad re-runs on unrelated item mutations (persistent leak) or a spurious one-time re-run during setup (transient leak, removed by `trimSources` on the next run). `Store.set()` and `List.replace()` already had the correct `untrack` pattern; these methods now match it. The public read APIs (`get()`, `at()`, `byKey()`, `keys()`, `length`, iterator) remain deliberately tracking per [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md).

## 1.3.4

### Fixed

- **`recomputeTask` left a Task permanently stuck after a synchronous throw** (`src/graph.ts`): The early `return` in the `catch` block skipped both `setState(node.pendingNode, true)` and `node.flags = FLAG_CLEAN`, leaving `FLAG_RUNNING` set. Every subsequent read then threw a spurious `CircularDependencyError` (via the `FLAG_RUNNING` guard in `refresh()`), even though no cycle existed. Now the `catch` clears `FLAG_RUNNING` and resets pending, so the node stays recoverable and subsequent reads report the original error.
- **`List` silently dropped `undefined` elements, causing a `length`/`get()` mismatch** (`src/nodes/list.ts`): The init loop and `diffArrays` skipped `undefined` via `if (val === undefined) continue`, leaving `keys` sparse (`keys.length` > actual signal count) while `node.value` retained the original array with the `undefined`. Now `undefined` is rejected with `NullishSignalValueError`, consistent with `null`.
- **`createCollection` `applyChanges` silently overwrote duplicate keys** (`src/nodes/collection.ts`): The add-path called `signals.set(key, ...)` without checking for an existing key, orphaning the previous signal's subscribers. Now throws `DuplicateKeyError`, matching `List.add` and `Store.add`. Additions are staged into a `Map` first, so a duplicate anywhere in the batch — including against another item in the same batch — leaves `signals`/`keys`/`itemToKey` untouched instead of partially applied.
- **`Store.set()` leaked dependency edges when called inside an effect** (`src/nodes/store.ts`): `buildValue()` was called without `untrack()`, so child `.get()` calls created edges from each child `State` to the active effect, causing over-broad re-runs. Now wrapped in `untrack()`, mirroring `List`.
- **`Store.set()` misrouted primitive↔array type changes** (`src/nodes/store.ts`): The type-change check `isRecord(val) !== isStore(signal)` returned `false` for arrays (not records), so `State<number>` → array fell into `signal.set(array)` instead of routing through `addSignal`/`createList`. Now compares shape categories (list/store/state).
- **`DEEP_EQUALITY` stack-overflowed on cyclic input and rejected equal `Date`/`RegExp`** (`src/graph.ts`): `deepEqual` had no cycle guard and treated `Date`/`RegExp` as non-records (returning `false`). Now has a path-scoped `WeakSet` guard — entries are removed in a `finally` once each comparison returns, so only genuine cycles on the active recursion path resolve as equal, not every object visited during the call — plus explicit `Date` (`getTime`) and `RegExp` (`source`+`flags`) branches. See [ADR-0016](adr/0016-path-scoped-cycle-detection-in-deep-equality.md).
- **`valueString` threw inside `Error` constructors on circular values** (`src/util.ts`): `JSON.stringify` throws on circular references, masking the original validation failure. Now wrapped in try/catch with a `String(value)` fallback.
- **`Slot.set()` stack-overflowed on circular delegation** (`src/nodes/slot.ts`): Mutual delegation (A→B→A) infinite-looped. Now detects the cycle and throws a descriptive error.
- **`DuplicateKeyError` dropped falsy values from its message** (`src/errors.ts`): The truthy check `value ? ... : ''` omitted `0`, `''`, and `false` from the message. Now checks `value != null`.
- **Non-`async` callback returning a `Promise` was silently misclassified as a `Memo`** (`src/graph.ts`, `src/errors.ts`): `createComputed`/`createSignal` route to `Memo` or `Task` by checking whether the callback is declared `async` (`isAsyncFunction`) — a check made on the callback itself, before it ever runs. A callback that forgot `async` but still returned a `Promise` (e.g. `createComputed(() => fetch(url).then(r => r.json()))`) was created as a `Memo`, which then cached the `Promise` object itself as its value; `equals`/`guard` ran against the `Promise`, not the resolved data. Now `recomputeMemo()` checks the computed value with `next instanceof Promise` and throws a new `PromiseValueError` instead — this is the shared recompute path for Memo, Slot, and the internal structural nodes of List/Store/Collection, so the check covers `Slot`/`SlotDescriptor.get()` misuse too.

### Changed

- **Composite signal accessors now subscribe to structural changes**: The direct-lookup methods (`at()`, `byKey()`, `keyAt()`, `indexOfKey()`) and the `Symbol.iterator` on `List` and `Collection`, plus the `Symbol.iterator` on `Store`, previously created no graph edge — reading them inside an effect or memo silently failed to re-run when keys were added, removed, or reordered. Each now calls `subscribe()` (or `ensureFresh()` for `deriveCollection`, whose node can be stale from upstream tracked changes), establishing the same O(1) structural-consumer edge that `keys()`, `length`, and `get()` already create. The defensive `keys()` pre-read workaround is no longer required, and `list.replace(key, value)` now reaches iterator-subscribers (previously silent). See [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md). **Migration:** effects that read *only* these accessors will now re-run on structural changes where they previously did not — the intended fix, but a behavior change to be aware of. This is not type- or API-surface-breaking.
- **`Store` per-property access stays granular**: `Store.byKey()` and the proxy property access (`store.prop`) deliberately remain untracked for structural changes, because proxy reads are already granular — `store.name` returns the child `State`, whose `.get()` forms a property-level edge. Adding a structural edge would make `store.set({ name, age })` spuriously re-run the `name` effect. The only untracked accessors in the library are now these Store per-property paths; whole-store traversal (`get()`, `keys()`, iterator) tracks consistently. The principled line within Store is whole-store vs per-property.
- **`List.replace()` is batched internally**: The item-signal `set()` and the structural node propagation are now wrapped in `batch()` so subscribers holding both an item-level edge and a structural edge (e.g. an effect calling `byKey(k).get()`) flush once instead of up to three times. This was a latent redundancy exposed by the accessor-tracking change above.
- **`isComputed` return type corrected** (`src/signal.ts`): Was `value is Memo<T>` despite accepting `Task`s. Now `value is Memo<T> | Task<T>`, reflecting that a `Task` does not satisfy `Memo<T>`'s shape (no `isPending`/`abort`).

## 1.3.3

### Changed

- **`List.buildValue()` uses a `push` loop instead of `map/filter`**: Eliminates the intermediate `(T | undefined)[]` allocation that `map()` produced before `filter()` could remove `undefined` entries. Now builds the result in a single pre-allocated pass.
- **`List.sort()` uses an imperative loop**: Replaces `keys.map(key => [key, signals.get(key)?.get()]).sort(...).map(([key]) => key)` with a single `entries` build loop and a separate `newOrder` accumulation loop, removing two intermediate array allocations.
- **`List.splice()` and `List.replace()` use boolean flags for change detection**: Replaces `Object.keys(changes.change).length` (iterates all keys to count) with an early-exit `for...in` loop that sets a flag on the first key found.
- **`List.add()` drops redundant `keys.includes(key)` guard**: The preceding `signals.has(key)` check already throws `DuplicateKeyError` for duplicate keys; `keys.includes(key)` was unreachable dead code.
- **`diffArrays` split into `diffPositional` for non-content-based keys**: Positional-key lists now take a dedicated fast path (`diffPositional`) that walks both arrays in a single `O(n)` pass with no `Map` or `Set` allocation. Content-based diffing retains the `Map`/`Set` approach for key-stability tracking.
- **`syncKeys` in `deriveCollection` reduces `Set` allocations**: Previously constructed two `Set`s (`new Set(keys)` and `new Set(nextKeys)`). Now constructs only `nextSet = new Set(nextKeys)` for deletion detection and uses the existing `signals` `Map` directly (`signals.has(key)`) to decide whether a key needs to be added.
- **`Store.buildValue()` and `Store[Symbol.iterator]` iterate `Map` entries directly**: `buildValue` replaces `signals.forEach((signal, key) => ...)` with `for (const [key, signal] of signals)`. The iterator replaces `Array.from(signals.keys())` and a secondary `signals.get(key)` lookup with a single `for...of` over `signals` entries, eliminating an intermediate array allocation.
- **`Slot` type assertion cleanup**: Removed `as any` casts in `isSignalOrDescriptor` and `createSlot.set`; used `return void delegated.set(next)` in the Slot-to-Slot delegation path to avoid implicitly returning the inner call's result.

## 1.3.2

### Fixed

- **Stale value and lost propagation after all consumers of a `Slot` or `Memo` disconnect and reconnect**: Previously, when the last `Effect` unsubscribed from a `Slot` (or any intermediate `MemoNode`), `unlink` correctly cascaded into the `MemoNode` via `trimSources` — pruning the upstream `State → MemoNode` edge — but left `flags` as `FLAG_CLEAN`. On reconnect, `refresh()` saw `FLAG_CLEAN` and returned immediately without calling `recomputeMemo`: the source edge was never re-established, the node returned its stale cached value, and subsequent `State.set()` calls did not propagate at all (the source's sink list no longer contained the `MemoNode`). Now `sinkNode.flags |= FLAG_DIRTY` is set after the cascade `trimSources` in `unlink` (`src/graph.ts`). The next `refresh()` triggers `recomputeMemo`, which re-runs `fn` with `activeSink = node`, re-links the upstream edge via `link()`, and returns a fresh value. Downstream propagation then works correctly for the lifetime of the new consumer.

## 1.3.1

### Added
- `createScope` now accepts an optional `ScopeOptions` second argument; `{ root: true }` creates a root scope that is not registered on the current parent owner – the returned `dispose` is the sole teardown mechanism. Export new `ScopeOptions` type.

### Changed
- Improved type inference for `createList` and `createCollection` when providing a custom `createItem` factory (e.g. `createStore`). The generic type of the returned item signal is now properly inferred without requiring type assertions.

## 1.3.0

### Added

- **`SlotDescriptor` support for bi-directional derivations**: `createSlot()` and `Slot#replace()` now accept a duck-typed `SlotDescriptor<T>` object (`{ get(): T, set?(next: T): void }`) in addition to a `Signal<T>`. This allows establishing stable, native reactive edges for derived `{ get, set }` pairs without the need for an intermediary `Computed` signal, which prevents edge corruption during cascading graph updates. If a descriptor omits the `set` function, the slot safely behaves as read-only.
- **Configurable `itemEquals` for `List` and `Collection`**: Added an `itemEquals` option to both `ListOptions` and `CollectionOptions`. It defaults to `DEEP_EQUALITY`. This prevents spurious reactive propagation when spread-based updates (`list.replace(key, { ...item.get(), field: newValue })`) produce structurally identical items.
- **Configurable `createItem` factory for `List`**: Added a `createItem?: (value: T) => MutableSignal<T>` option to `ListOptions`, bringing it to parity with `CollectionOptions`. This allows backing list items with custom mutable signals, such as `createStore` for granular, per-property reactivity within a list. `List` methods like `at()`, `byKey()`, and its iterator now correctly return `MutableSignal<T>` instead of strictly `State<T>`.

## 1.2.1

### Fixed

- **`match()` `stale` handler not firing on re-fetches**: Previously, `stale` only fired on the first effect run when a task had a seeded value and its initial fetch was in progress. On subsequent re-fetches (when a task source dependency changed), the effect silently became `FLAG_CLEAN` without running: `propagate(taskNode)` sent only `FLAG_CHECK` to downstream effects, so `refresh(effectNode)` called `refresh(taskNode)` → `recomputeTask()`, which returned synchronously with no value change — the effect saw no `FLAG_DIRTY` and was cleaned without executing. Now `recomputeTask()` calls `setState(node.pendingNode, true)` immediately after the synchronous fn preamble. This propagates `FLAG_DIRTY` to subscribed effects mid-refresh, causing the source-check loop in `refresh()` to break and run the effect, which then routes to `stale` as expected.
- **`task.isPending()` is now reactive**: Previously a plain boolean read (`!!node.controller`) that created no graph edges. Now backed by an internal `pendingNode: StateNode<boolean>` and subscribed via `makeSubscribe` — calling `isPending()` inside a reactive context (effect, `match()`) creates a dependency edge. The effect re-runs when the task transitions from not-pending to pending (fetch starts) in addition to when it transitions from pending to not-pending (fetch resolves, handled by value propagation). Effects that do not call `isPending()` are unaffected. Promise `.then`/`.catch` handlers reset `pendingNode` to `false` inside a `batch()` alongside any value propagation to prevent double effect runs.

## 1.2.0

### Added

- **`stale` handler for `match()`**: Both `MatchHandlers<T>` and `SingleMatchHandlers<T>` now accept an optional `stale?: () => MaybePromise<MaybeCleanup>` branch. It fires when all signals have a retained value but at least one `Task` signal is currently executing (`isPending() === true`). Routing precedence is `nil` > `err` > `stale` > `ok`; omitting `stale` falls back to `ok`, showing the retained value unchanged while the task re-fetches. Any cleanup returned by `stale` is registered on the owner and runs before the next handler dispatches — the right place to remove a refresh indicator or dim overlay. In React Query terms: `nil` maps to `isLoading` (no data yet); `stale` maps to `isFetching` with existing data.
- **`isSignalOfType<T>(value, type)` utility**: New exported function that replaces `isObjectOfType` for signal type guards. Checks `value != null && value[Symbol.toStringTag] === type` directly — zero string allocations, O(1). All eight internal `is*()` guards (`isState`, `isMemo`, `isTask`, `isSensor`, `isSlot`, `isStore`, `isList`, `isCollection`) now use it.
- **`DEEP_EQUALITY` equality preset**: New exported constant for deep structural comparison of plain objects and arrays. Uses `Object.is` as a fast path, then recursively compares array elements by index and own enumerable keys of plain-object records (`Object.getPrototypeOf(v) === Object.prototype`). Non-plain objects (class instances, `Map`, `Set`) are never structurally equal unless they are the same reference. Pass to the `equals` option to suppress propagation when a signal holding an object or array recomputes to a structurally identical value.
- **`DEFAULT_EQUALITY` exported from `index.ts`**: The `===`-based equality preset was already used internally throughout the library but was not part of the public API. It is now exported, allowing callers to restore the default explicitly when composing or selectively overriding `SignalOptions`.

### Changed

- **`isSignal` uses a module-level `Set` with direct `Symbol.toStringTag` access**: Previously allocated two strings per call via `Object.prototype.toString.call(value).slice(8, -1)` and scanned an inline array with `Array.includes()`. Now checks `SIGNAL_TYPES.has(value[Symbol.toStringTag])` — one hash lookup, zero allocations, `Set` built once at module load.
- **`isRecord` uses a prototype check instead of `Object.prototype.toString`**: Previously `Object.prototype.toString.call(value) === '[object Object]'`, which returns `true` for class instances without a custom `Symbol.toStringTag`. Now checks `Object.getPrototypeOf(value) === Object.prototype`, which excludes class instances. Affects `createSignal` and `createMutableSignal`: a class instance with no `Symbol.toStringTag` previously resolved to a `Store`; now it falls through to `createState`. Class instances are not plain records, so this is the correct behavior.
- **`isEqual` / `DEEP_EQUALITY` cycle detection removed**: Previously, the deep equality function in `list.ts` and `store.ts` allocated a `WeakSet` on every `List.set()` / `Store.set()` call, added both operands before recursing, and threw `CircularDependencyError` on a circular reference. The `try/finally` block cleaned up the `WeakSet` entries after each call. All of this is removed — the implementation is now plain recursion (`deepEqual` in `graph.ts`) with no allocations. Circular data causes a stack overflow rather than a thrown error. Signal values are expected to be plain JSON-like data; circular references are a programming error.
- **Equality presets unified in `graph.ts`**: `DEFAULT_EQUALITY`, `SKIP_EQUALITY`, and `DEEP_EQUALITY` are all defined in `graph.ts` alongside `SignalOptions`. Previously `isEqual` (the deep equality implementation) lived in `list.ts` as a private function and was imported by `store.ts`. Both files now import `DEEP_EQUALITY` from `graph.ts`; the `CircularDependencyError` import in `list.ts` is removed.

### Deprecated

- **`isObjectOfType(value, type)`**: Marked `@deprecated`. Allocates two strings per call (`Object.prototype.toString.call()` plus a template literal). Use `isSignalOfType(value, type)` for signal type guards instead. The function remains exported for backward compatibility and will be removed in a future release.
- **`isEqual`**: Deprecated alias for `DEEP_EQUALITY`. Previously the private deep equality implementation in `list.ts`, now re-exported from `index.ts` as a deprecated alias pointing to `DEEP_EQUALITY` in `graph.ts`. Replace all uses with `DEEP_EQUALITY`.

### Fixed

- **`createScope` effect leak on throw**: Previously, if `fn()` threw after creating child effects, `dispose` was never created or registered with the parent owner — child effects leaked and continued running indefinitely. Now `dispose` is created before the `try` block and registered with `prevOwner` in the `finally` clause, so cleanup always executes regardless of whether `fn()` throws.
- **`list.replace()` spurious dependency edge**: Previously, calling `replace()` from inside an effect linked the item signal to the calling effect as a dependency (via the unguarded `signal.get()` equality check). The effect re-ran — and permanently acquired the dependency — after each `replace()` call. Now the check uses `untrack(() => signal.get())`, so no edge is created during the early-exit test.
- **`list.splice()` signal corruption on same-key replace**: Previously, splicing out an item and inserting a new item with the same content-based key left the key in `keys` but absent from `signals` — `byKey()` returned `undefined` silently. Now `splice` detects the key overlap and routes to `change` instead of an add+remove pair.
- **`match()` `err` cleanup silently dropped on thrown errors**: Previously, the catch branch called `err([...])` without capturing the return value — cleanup functions or `Promise<MaybeCleanup>` returned by `err` were silently discarded (memory leak in the error path). Now `out = err([...])` captures the return value for cleanup registration, matching the try-branch behavior.

## 1.1.1

### Fixed

- **`Slot.set()` now forwards through Slot-to-Slot chains**: Previously, writing to a Slot whose backing signal was itself a Slot threw `ReadonlySignalError` because `isMutableSignal` does not include `Slot` (by design — a Slot wrapping a read-only signal is not mutable). `set()` now recursively delegates to the next Slot in the chain, allowing the terminal backing signal to determine write permissions. Chains of arbitrary depth are resolved correctly.

## 1.1.0

### Added

- **Single-signal overload for `match()`**: `match(signal, handlers)` now accepts a bare signal (not wrapped in an array). The `ok` handler receives the resolved value directly as `(value: T)`, and `err` receives a single `Error` rather than `readonly Error[]`. The existing tuple form is unchanged. This eliminates the boilerplate of wrapping a single source in `[source]`, destructuring `values[0]` in `ok`, and unwrapping `errors[0]!` in `err`.
- **`SingleMatchHandlers<T>` type**: New exported type that describes the handler object for the single-signal overload. Counterpart to the existing `MatchHandlers<T>` for tuple usage.

### Changed

- **Async handler documentation**: Added `@remarks` to the `match()` JSDoc and an expanded section in `README.md` clarifying that async `ok`/`err` handlers are intended for external side effects only (logging, DOM writes, analytics). Any async work that needs to drive reactive state should use a `Task` node, which receives an `AbortSignal` and is auto-cancelled on re-run. Documents the known limitation that rejected async handlers from stale (superseded) runs still call `err`, since the library cannot cancel operations it did not initiate.

## 1.0.2

### Added

- **`List.replace(key, value)` — guaranteed item mutation**: Updates the value of an existing item in place, propagating to all subscribers regardless of how they subscribed. `byKey(key).set(value)` only propagates through `itemSignal → listNode` edges, which are established lazily when `list.get()` is called; effects that subscribed via `list.keys()`, `list.length`, or the iterator never trigger that path and receive no notification. `replace()` closes this gap by also walking `node.sinks` directly — the same structural propagation path used by `add()`, `remove()`, and `sort()`. Signal identity is preserved: the `State<T>` returned by `byKey(key)` is the same object before and after. No-op if the key does not exist or the value is reference-equal to the current value.

## 1.0.1

### Added

- **`cause-effect` skill for consumer projects**: New Claude Code skill with self-contained API knowledge in `references/` — no library source access required. Covers three workflows: `use-api`, `debug`, and `answer-question`.
- **`README.md` Utilities section**: Documents the previously undocumented `createSignal`, `createMutableSignal`, `createComputed` factories and `isSignal`, `isMutableSignal`, `isComputed` predicates exported from `index.ts`.

### Changed

- **`cause-effect-dev` skill restructured**: Refactored to progressive disclosure pattern with separate `workflows/` and `references/` modules. Scoped explicitly to library development; external references to `REQUIREMENTS.md`, `ARCHITECTURE.md`, and `src/` are now clearly library-repo-only.
- **Documentation alignment**: Corrected wrong graph node type for `State` in `ARCHITECTURE.md`; added missing `FLAG_RELINK` and `src/signal.ts` to `copilot-instructions.md`; updated `REQUIREMENTS.md` stability section to reflect 1.0 release; completed and corrected JSDoc across `Sensor`, `Memo`, `Store`, `List`, `Collection`, and utility types. No runtime behaviour changed.
- **TypeScript 6 compatibility**: Added `erasableSyntaxOnly` to `tsconfig.json` (requires TS ≥5.8); replaced `@types/bun` with `bun-types` directly and added `"types": ["bun-types"]` to `tsconfig.json` to fix module resolution under TypeScript 6.
- **Package management cleanup**: Added `typescript` to `devDependencies` (was only in `peerDependencies`, causing stale version installs); updated `peerDependencies` range to `>=5.8.0`; removed `package-lock.json` and gitignored npm/yarn/pnpm lockfiles — Bun is required for development.
- **Zed editor configuration**: Disabled ESLint language server for JS/TS/TSX in `.zed/settings.json` — project uses Biome for linting.

## 1.0.0

### Changed

- **Stricter TypeScript configuration**: Enabled `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noUncheckedSideEffectImports`, and `noFallthroughCasesInSwitch` in `tsconfig.json`. All internal array and indexed object accesses have been updated to satisfy these checks. Runtime behaviour is unchanged.
- **`stop` on node types now typed as `Cleanup | undefined`**: The `stop` property in `SourceFields` (and by extension `StateNode`, `MemoNode`, `TaskNode`) is now declared `stop?: Cleanup | undefined` rather than `stop?: Cleanup`. Under `exactOptionalPropertyTypes`, this is required to allow clearing the property by assignment (`= undefined`) rather than deletion — preserving V8 hidden-class stability on hot-path nodes. Consumers reading `stop` from a node should already be handling `undefined` since the property is optional, but TypeScript will now surface this requirement explicitly.
- **`guard` on options types now requires explicit presence**: Under `exactOptionalPropertyTypes`, passing `{ guard: undefined }` to `SignalOptions`, `ComputedOptions`, or `SensorOptions` is now a type error. Omit the property entirely to leave it unset.

## 0.18.5

### Added

- **`unown(fn)` — escape hatch for DOM-owned component lifecycles**: Runs a callback with `activeOwner` set to `null`, preventing any `createScope` or `createEffect` calls inside from being registered as children of the current active owner. Use this in `connectedCallback` (or any external lifecycle hook) when a component manages its own cleanup independently via `disconnectedCallback` rather than through the reactive ownership tree.

### Fixed

- **Scope disposal bug when `connectedCallback` fires inside a re-runnable effect**: Previously, calling `createScope` inside a reactive effect (e.g. a list sync effect) registered the scope's `dispose` on that effect's cleanup list. When the effect re-ran — for example, because a `MutationObserver` fired — it called `runCleanup`, disposing all child scopes including those belonging to already-connected custom elements. This silently removed event listeners and reactive subscriptions from components that were still live in the DOM. Wrapping the `connectedCallback` body in `unown(() => createScope(...))` detaches the scope from the effect's ownership, so effect re-runs no longer dispose it.

## 0.18.4

### Fixed

- **Watched `invalidate()` now respects `equals` at every graph level**: Previously, calling `invalidate()` from a Memo or Task `watched` callback propagated `FLAG_DIRTY` directly to effect sinks, causing unconditional re-runs even when the recomputed value was unchanged. Now `invalidate()` delegates to `propagate(node)`, which marks the node itself `FLAG_DIRTY` and propagates `FLAG_CHECK` to downstream sinks. During flush, effects verify their sources via `refresh()` — if the memo's `equals` function determines the value is unchanged, the effect is cleaned without running. This eliminates unnecessary effect executions for watched memos with custom equality or stable return values.

### Changed

- **`propagate()` supports `FLAG_CHECK` for effect nodes**: The effect branch of `propagate()` now respects the `newFlag` parameter instead of unconditionally setting `FLAG_DIRTY`. Effects are enqueued only on first notification; subsequent propagations escalate the flag (e.g., `CHECK` → `DIRTY`) without re-enqueuing.
- **`flush()` processes `FLAG_CHECK` effects**: The flush loop now calls `refresh()` on effects with either `FLAG_DIRTY` or `FLAG_CHECK`, enabling the check-sources-first path for effects.
- **Task `invalidate()` aborts eagerly**: Task watched callbacks now abort in-flight computations immediately during `propagate()` rather than deferring to `recomputeTask()`, consistent with the normal dependency-change path.

## 0.18.3

### Added

- **Slot signal (`createSlot`, `isSlot`)**: A stable reactive source that delegates reads and writes to a swappable backing signal. Designed for integration layers (e.g. custom element systems) where a property position must switch its backing signal — from a local writable `State` to a parent-controlled `Memo` — without breaking existing subscribers. The slot object doubles as a property descriptor for `Object.defineProperty()`. `replace(nextSignal)` swaps the backing signal and invalidates downstream subscribers; `current()` returns the currently delegated signal. Options mirror State: optional `guard` and `equals`.

### Fixed

- **`match()` now preserves tuple types**: The `ok` handler correctly receives per-position types (e.g., `[number, string]`) instead of a widened union (e.g., `(number | string)[]`). The `signals` parameter and `MatchHandlers` type now use `readonly [...T]` to preserve tuple inference.

## 0.18.2

### Fixed

- **`watched` propagation through `deriveCollection()` chains**: When an effect reads a derived collection, the `watched` callback on the source List, Store, or Collection now activates correctly — even through multiple levels of `.deriveCollection()` chaining. Previously, `deriveCollection` did not propagate sink subscriptions back to the source's `watched` lifecycle.
- **Stable `watched` lifecycle during mutations**: Adding, removing, or sorting items on a List (or Store/Collection) consumed through `deriveCollection()` no longer tears down and restarts the `watched` callback. The watcher remains active as long as at least one downstream effect is subscribed.
- **Cleanup cascade on disposal**: When the last effect unsubscribes from a derived collection chain, cleanup now propagates upstream through all intermediate nodes to the source, correctly invoking the `watched` cleanup function.

### Changed

- **`FLAG_RELINK` replaces source-nulling in composite signals**: Store, List, Collection, and deriveCollection no longer null out `node.sources`/`node.sourcesTail` on structural mutations. Instead, a new `FLAG_RELINK` bitmap flag triggers a tracked `refresh()` on the next `.get()` call, re-establishing edges cleanly via `link()`/`trimSources()` without orphaning them.
- **Cascading `trimSources()` in `unlink()`**: When a MemoNode loses all sinks, its own sources are now trimmed recursively, ensuring upstream `watched` cleanup propagates correctly through intermediate nodes.
- **Three-path `ensureFresh()` in `deriveCollection`**: The internal freshness check now distinguishes between fast path (has sources, clean), first subscriber (has sinks but no sources yet), and no subscriber (untracked build). This prevents premature `watched` activation during initialization.

## 0.18.1

### Added

- **Memo `watched(invalidate)` option**: `createMemo(fn, { watched })` accepts a lazy lifecycle callback that receives an `invalidate` function. Calling `invalidate()` marks the memo dirty and triggers re-evaluation. The callback is invoked on first sink attachment and cleaned up when the last sink detaches. This enables patterns like DOM observation where a memo re-derives its value in response to external events (e.g., MutationObserver) without needing a separate Sensor.
- **Task `watched(invalidate)` option**: Same pattern as Memo. Calling `invalidate()` aborts any in-flight computation and triggers re-execution.
- **`CollectionChanges<T>` type**: New typed interface for collection mutations with `add?: T[]`, `change?: T[]`, `remove?: T[]` arrays. Replaces the untyped `DiffResult` records previously used by `CollectionCallback`.
- **`SensorOptions<T>` type**: Dedicated options type for `createSensor`, extending `SignalOptions<T>` with optional `value`.
- **`CollectionChanges` export** from public API (`index.ts`).
- **`SensorOptions` export** from public API (`index.ts`).

### Changed

- **`createSensor` parameter renamed**: `start` → `watched` for consistency with Store/List lifecycle terminology.
- **`createSensor` options type**: `ComputedOptions<T>` → `SensorOptions<T>`. This decouples Sensor options from `ComputedOptions`, which now carries the `watched(invalidate)` field for Memo/Task.
- **`createCollection` parameter renamed**: `start` → `watched` for consistency.
- **`CollectionCallback` is now generic**: `CollectionCallback` → `CollectionCallback<T>`. The `applyChanges` parameter accepts `CollectionChanges<T>` instead of `DiffResult`.
- **`CollectionOptions.createItem` signature**: `(key: string, value: T) => Signal<T>` → `(value: T) => Signal<T>`. Key generation is now handled internally.
- **`KeyConfig<T>` return type relaxed**: Key functions may now return `string | undefined`. Returning `undefined` falls back to synthetic key generation.

### Removed

- **`DiffResult` removed from public API**: No longer re-exported from `index.ts`. The type remains available from `src/nodes/list.ts` for internal use but is superseded by `CollectionChanges<T>` for collection mutations.

## 0.18.0

Baseline release. Factory function API (`createState`, `createMemo`, `createTask`, `createEffect`, `createStore`, `createList`, `createCollection`, `createSensor`) with linked-list graph engine.
