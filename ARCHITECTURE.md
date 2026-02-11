# Cause & Effect v0.18 - Signal Graph Architecture

This document describes the reactive signal graph engine implemented in `src/graph.ts` and the node types built on top of it in `src/nodes/`.

## Overview

The engine maintains a directed acyclic graph (DAG) of signal nodes connected by edges. Nodes come in two roles: **sources** produce values, **sinks** consume them. Some nodes (Memo, Task, Store, List, Collection) are both source and sink. Edges are created and destroyed automatically as computations run, ensuring the graph always reflects the true dependency structure.

The design optimizes for three properties:

1. **Minimal work**: Only dirty nodes recompute; unchanged values stop propagation.
2. **Minimal memory**: Edges are stored as doubly-linked lists embedded in nodes, avoiding separate data structures.
3. **Correctness**: Dynamic dependency tracking means the graph never has stale edges.

## Core Data Structures

### Edges

An `Edge` connects a source to a sink. Each edge participates in two linked lists simultaneously:

```
type Edge = {
  source: SourceNode       // the node being depended on
  sink: SinkNode           // the node that depends on source
  nextSource: Edge | null  // next edge in the sink's source list
  prevSink: Edge | null    // previous edge in the source's sink list
  nextSink: Edge | null    // next edge in the source's sink list
}
```

Each source maintains a singly-linked list of its sinks (`sinks` → `sinksTail`), threaded through `nextSink`/`prevSink`. Each sink maintains a singly-linked list of its sources (`sources` → `sourcesTail`), threaded through `nextSource`. The `prevSink` pointer enables O(1) removal from the source's sink list.

### Node Field Mixins

Nodes are composed from field groups rather than using class inheritance:

| Mixin | Fields | Purpose |
|-------|--------|---------|
| `SourceFields<T>` | `value`, `sinks`, `sinksTail`, `stop?` | Holds a value and tracks dependents |
| `OptionsFields<T>` | `equals`, `guard?` | Equality check and type validation |
| `SinkFields` | `fn`, `flags`, `sources`, `sourcesTail` | Holds a computation and tracks dependencies |
| `OwnerFields` | `cleanup` | Manages disposal of child effects/scopes |
| `AsyncFields` | `controller`, `error` | AbortController for async cancellation |

### Concrete Node Types

| Node | Composed From | Role |
|------|---------------|------|
| `StateNode<T>` | SourceFields + OptionsFields | Source only |
| `MemoNode<T>` | SourceFields + OptionsFields + SinkFields + `error` | Source + Sink |
| `TaskNode<T>` | SourceFields + OptionsFields + SinkFields + AsyncFields | Source + Sink |
| `EffectNode` | SinkFields + OwnerFields | Sink only |
| `Scope` | OwnerFields | Owner only (not in graph) |

## Automatic Dependency Tracking

### The `activeSink` Protocol

A module-level variable `activeSink` points to the sink node currently executing its computation. When a signal's `.get()` method is called, it checks `activeSink` and, if non-null, calls `link(source, activeSink)` to establish an edge.

```
signal.get()
  └─ if (activeSink) link(thisNode, activeSink)
```

Before a sink recomputes, the engine sets `activeSink = node`, ensuring all `.get()` calls during execution are captured. After execution, `activeSink` is restored.

### Edge Creation: `link(source, sink)`

`link()` creates a new edge from source to sink, appending it to both the source's sink list and the sink's source list. It includes three fast-path optimizations:

1. **Same source as last**: If `sink.sourcesTail.source === source`, the edge already exists — skip.
2. **Edge reuse during recomputation**: When `FLAG_RUNNING` is set, `link()` checks if the next existing edge in the sink's source list already points to this source. If so, it advances the `sourcesTail` pointer instead of creating a new edge. This handles the common case where dependencies are the same across recomputations.
3. **Duplicate sink check**: If the source's last sink edge already points to this sink, skip creating a duplicate.

### Edge Removal: `trimSources(node)` and `unlink(edge)`

After a sink finishes recomputing, `trimSources()` removes any edges beyond `sourcesTail` — these are dependencies from the previous execution that were not accessed this time. This is how the graph adapts to conditional dependencies.

`unlink()` removes an edge from the source's sink list. If the source's sink list becomes empty and the source has a `stop` callback, that callback is invoked — this is how lazy resources (Sensor, Collection, watched Store/List) are deallocated when no longer observed.

### Dependency Tracking Opt-Out: `untrack(fn)`

`untrack()` temporarily sets `activeSink = null`, executing `fn` without creating any edges. This prevents dependency pollution when an effect creates subcomponents with their own internal signals.

## Change Propagation

### Flag-Based Dirty Tracking

Each sink node has a `flags` field with four states:

| Flag | Value | Meaning |
|------|-------|---------|
| `FLAG_CLEAN` | 0 | Value is up to date |
| `FLAG_CHECK` | 1 | A transitive dependency may have changed — verify before recomputing |
| `FLAG_DIRTY` | 2 | A direct dependency changed — recomputation required |
| `FLAG_RUNNING` | 4 | Currently executing (used for circular dependency detection and edge reuse) |

### The `propagate(node)` Function

When a source value changes, `propagate()` walks its sink list:

- **Memo/Task sinks** (have `sinks` field): Flagged `DIRTY`. Their own sinks are recursively flagged `CHECK`. If the node has an in-flight `AbortController`, it is aborted immediately.
- **Effect sinks** (no `sinks` field): Flagged `DIRTY` and pushed onto the `queuedEffects` array for later execution.

The two-level flagging (`DIRTY` for direct dependents, `CHECK` for transitive) avoids unnecessary recomputation. A `CHECK` node only recomputes if, upon inspection during `refresh()`, one of its sources turns out to have actually changed.

### The `refresh(node)` Function

`refresh()` is called when a sink's value is read (pull-based evaluation). It handles two cases:

1. **FLAG_CHECK**: Walk the node's source list. For each source that is itself a sink (Memo/Task), recursively `refresh()` it. If at any point the node gets upgraded to `DIRTY`, stop checking.
2. **FLAG_DIRTY**: Recompute the node by calling `recomputeMemo()`, `recomputeTask()`, or `runEffect()` depending on the node type.

If `FLAG_RUNNING` is encountered, a `CircularDependencyError` is thrown.

### The `setState(node, next)` Function

`setState()` is the entry point for value changes on `StateNode`-based signals (State, Sensor). It:

1. Checks equality — if unchanged, returns immediately.
2. Updates `node.value`.
3. Walks the sink list, calling `propagate()` on each dependent.
4. If not inside a `batch()`, calls `flush()` to execute queued effects.

## Effect Scheduling

### Batching

`batch(fn)` increments a `batchDepth` counter before executing `fn` and decrements it after. Effects are only flushed when `batchDepth` returns to 0. Batches nest — only the outermost batch triggers a flush.

### The `flush()` Function

`flush()` iterates over `queuedEffects`, calling `refresh()` on each effect that is still `DIRTY`. A `flushing` guard prevents re-entrant flushes. Effects that were enqueued during the flush (due to async resolution or nested state changes) are processed in the same pass, since `flush()` reads the array length dynamically.

### Effect Lifecycle

When an effect runs:

1. `runCleanup(node)` disposes previous cleanup callbacks.
2. `activeSink` and `activeOwner` are set to the effect node.
3. The effect function executes; `.get()` calls create edges.
4. If the function returns a cleanup function, it is registered via `registerCleanup()`.
5. `activeSink` and `activeOwner` are restored.
6. `trimSources()` removes stale edges.

## Ownership and Cleanup

### The `activeOwner` Protocol

`activeOwner` points to the current owner node (an `EffectNode` or `Scope`). When `createEffect()` is called, the new effect's dispose function is registered on `activeOwner`. This creates a tree of ownership: disposing a parent disposes all children.

### Cleanup Storage

Cleanup functions are stored on the `cleanup` field of owner nodes. The field is polymorphic for efficiency:

- `null` — no cleanups registered.
- A single function — one cleanup registered.
- An array of functions — multiple cleanups registered.

`registerCleanup()` promotes from `null` → function → array as needed. `runCleanup()` executes all registered cleanups and resets the field to `null`.

### `createScope(fn)`

Creates an ownership scope without an effect. The scope becomes `activeOwner` during `fn` execution. Returns a `dispose` function. If the scope is created inside another owner, its disposal is automatically registered on the parent.

## Signal Types

### State (`src/nodes/state.ts`)

**Graph node**: `StateNode<T>` (source only)

A mutable value container. The simplest signal type — `get()` links and returns the value, `set()` validates, calls `setState()`, which propagates changes to dependents.

`update(fn)` is sugar for `set(fn(get()))` with validation.

### Sensor (`src/nodes/sensor.ts`)

**Graph node**: `StateNode<T>` (source only)

A read-only signal that tracks external input. The `start` callback receives a `set` function that updates the node's value via `setState()`. Sensors cover two patterns:

1. **Tracking external values** (default): Receives replacement values from events (mouse position, resize events). Equality checking (`Object.is` by default) prevents unnecessary propagation.
2. **Observing mutable objects** (with `SKIP_EQUALITY`): Holds a stable reference to a mutable object (DOM element, Map, Set). `set(sameRef)` with `equals: SKIP_EQUALITY` always propagates, notifying consumers that the object's internals have changed.

The value starts undefined unless `options.value` is provided. Reading a sensor before its `start` callback has called `set()` (and without `options.value`) throws `UnsetSignalValueError`.

**Lazy lifecycle**: The `start` callback is invoked on first sink attachment. The returned cleanup is stored as `node.stop` and called when the last sink detaches (via `unlink()`).

### Memo (`src/nodes/memo.ts`)

**Graph node**: `MemoNode<T>` (source + sink)

A synchronous derived computation. The `fn` receives the previous value (or `undefined` on first run) and returns a new value. Dependencies are tracked automatically during execution.

Memos use lazy evaluation — they only recompute when read (`get()` calls `refresh()`). If the recomputed value is equal to the previous (per the `equals` function), downstream sinks are not flagged dirty, stopping propagation. This is the key mechanism for avoiding unnecessary work.

The `error` field preserves thrown errors: if `fn` throws, the error is stored and re-thrown on subsequent `get()` calls until the memo successfully recomputes.

**Reducer pattern**: The `prev` parameter enables state accumulation across recomputations without writable state.

### Task (`src/nodes/task.ts`)

**Graph node**: `TaskNode<T>` (source + sink)

An asynchronous derived computation. Like Memo but `fn` returns a `Promise` and receives an `AbortSignal`. When dependencies change while a task is in flight, the `AbortController` is aborted and a new computation starts.

During dependency tracking, only the synchronous preamble of `fn` is tracked (before the first `await`). The promise resolution triggers propagation and flush asynchronously.

`isPending()` returns `true` while a computation is in flight. `abort()` cancels the current computation manually. Errors are preserved like Memo, but old values are retained on errors (the last successful result remains accessible).

### Effect (`src/nodes/effect.ts`)

**Graph node**: `EffectNode` (sink only)

A side-effecting computation that runs immediately and re-runs when dependencies change. Effects are terminal — they have no value and no sinks. They are pushed onto the `queuedEffects` array during propagation and executed during `flush()`.

Effects double as owners: they have a `cleanup` field and become `activeOwner` during execution. Child effects and scopes created during execution are automatically disposed when the parent effect re-runs or is disposed.

### Store (`src/nodes/store.ts`)

**Graph node**: `MemoNode<T>` (source + sink, used for structural reactivity)

A reactive object where each property is its own signal. Properties are automatically wrapped: primitives become `State`, nested objects become `Store`, arrays become `List`. A `Proxy` provides direct property access (`store.name` returns the `State` signal for that property).

**Structural reactivity**: The internal `MemoNode` tracks edges from child signals to the store node. When consumers call `store.get()`, the node acts as both a source (to the consumer) and a sink (of its child signals). Changes to any child signal propagate through the store to its consumers.

**Two-path access**: On first `get()`, `refresh()` executes `buildValue()` with `activeSink = storeNode`, establishing edges from each child signal to the store. Subsequent reads use a fast path: `untrack(buildValue)` rebuilds the value without re-establishing edges. Structural mutations (`add`/`remove`) call `invalidateEdges()` (nulling `node.sources`) to force re-establishment on the next read.

**Diff-based updates**: `store.set(newObj)` diffs the new object against the current state, applying only the granular changes to child signals. This preserves identity of unchanged child signals and their downstream edges.

**Watched lifecycle**: An optional `watched` callback in options provides lazy resource allocation, following the same pattern as Sensor — activated on first sink, cleaned up when the last sink detaches.

### List (`src/nodes/list.ts`)

**Graph node**: `MemoNode<T[]>` (source + sink, used for structural reactivity)

A reactive array with stable keys and per-item reactivity. Each item becomes a `State<T>` signal, keyed by a configurable key generation strategy (auto-increment, string prefix, or custom function).

**Structural reactivity**: Uses the same `MemoNode` + `invalidateEdges` + two-path access pattern as Store. The `buildValue()` function reads all child signals in key order, establishing edges on the refresh path.

**Stable keys**: Keys survive sorting and reordering. `byKey(key)` returns a stable `State<T>` reference regardless of the item's current index. `sort()` reorders the keys array without destroying signals.

**Diff-based updates**: `list.set(newArray)` uses `diffArrays()` to compute granular additions, changes, and removals. Changed items update their existing `State` signals; structural changes (add/remove) trigger `invalidateEdges()`.

### Collection (`src/nodes/collection.ts`)

Collection implements two creation patterns that share the same `Collection<T>` interface:

#### `createCollection(start, options?)` — externally driven

**Graph node**: `MemoNode<T[]>` (source + sink, tracks item values)

An externally-driven reactive collection with a watched lifecycle, mirroring `createSensor(start, options?)`. The `start` callback receives an `applyChanges(diffResult)` function for granular add/change/remove operations. Initial items are provided via `options.value` (default `[]`).

**Lazy lifecycle**: Like Sensor, the `start` callback is invoked on first sink attachment. The returned cleanup is stored as `node.stop` and called when the last sink detaches (via `unlink()`). The `startWatching()` guard ensures `start` fires before `link()` so synchronous mutations inside `start` update `node.value` before the activating effect reads it.

**External mutation via `applyChanges`**: Additions create new item signals (via configurable `createItem` factory, default `createState`). Changes update existing `State` signals. Removals delete signals and keys. Structural changes null out `node.sources` to force edge re-establishment. The node uses `equals: () => false` since structural changes are managed externally rather than detected by diffing.

**Two-path access**: Same pattern as Store/List — first `get()` uses `refresh()` to establish edges from child signals to the collection node; subsequent reads use `untrack(buildValue)` to avoid re-linking.

#### `deriveCollection(source, callback)` — internally derived

**Graph node**: `MemoNode<string[]>` (source + sink, tracks keys not values)

An internal factory (not exported from the public API) that creates a read-only derived transformation of a List or another Collection. Exposed to users via the `.deriveCollection(callback)` method on List and Collection. Each source item is individually memoized: sync callbacks create `Memo` signals, async callbacks create `Task` signals.

**Two-level reactivity**: The derived collection's `MemoNode` tracks structural changes only — its `fn` (`syncKeys`) reads `source.keys()` to detect additions and removals. Value-level changes flow through the individual per-item `Memo`/`Task` signals, which independently track their source item.

**Key differences from Store/List**: The `MemoNode.value` is a `string[]` (the keys array), not the collection's actual values. The `equals` function is a shallow string array comparison (`keysEqual`). The node starts `FLAG_DIRTY` (unlike Store/List which start clean after initialization) to ensure the first `refresh()` establishes the edge from source to collection.

**No `invalidateEdges`**: Unlike Store/List, the derived collection never needs to re-establish its source edge because it has exactly one source (the parent List or Collection) that never changes identity. Structural changes (adding/removing per-item signals) happen inside `syncKeys` without affecting the source edge.

**Chaining**: `.deriveCollection()` creates a new derived collection from an existing one, forming a pipeline. Each level in the chain has its own `MemoNode` for structural tracking and its own set of per-item derived signals.
