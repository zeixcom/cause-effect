# Changelog

## [Unreleased]

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
