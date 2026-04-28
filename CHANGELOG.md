# Changelog

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
