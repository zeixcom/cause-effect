# Changelog

## [Unreleased]

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
