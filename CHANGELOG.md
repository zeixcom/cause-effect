# Changelog

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
