# Cause & Effect - Signal Graph Architecture

This document provides a high-level overview of the reactive signal graph engine. For detailed architectural decisions, see the [ADR directory](adr/).

## Overview

The engine maintains a directed acyclic graph (DAG) of signal nodes connected by edges. Nodes are either **sources** (produce values) or **sinks** (consume values); some types (Memo, Task, Store, List, Collection) are both. Edges are created and destroyed automatically as computations run, ensuring the graph always reflects true runtime dependencies.

The design optimizes for three properties:

1. **Minimal work**: Only dirty nodes recompute; unchanged values stop propagation
2. **Minimal memory**: Edges stored as doubly-linked lists embedded in nodes
3. **Correctness**: Dynamic dependency tracking means the graph never has stale edges

## Core Concepts

| Concept | ADR | Description |
|---------|-----|-------------|
| Node Composition | [ADR-0007](adr/0007-node-composition-via-field-mixins.md) | Field mixins (SourceFields, SinkFields, OwnerFields, AsyncFields) composed into concrete node types |
| Edge Structure | [ADR-0008](adr/0008-doubly-linked-list-edge-structure.md) | Doubly-linked lists embedded in nodes for O(1) edge operations |
| Dependency Tracking | [ADR-0009](adr/0009-activeSink-protocol-for-automatic-dependency-tracking.md) | `activeSink` protocol: edges established as side effect of `.get()` calls during computation |
| Edge Optimizations | [ADR-0013](adr/0013-link-fast-path-optimizations.md) | Three fast-path checks in `link()` to avoid redundant edge creation |
| Cascading Cleanup | [ADR-0011](adr/0011-cascading-cleanup-protocol-in-unlink.md) | Recursive cleanup through intermediate nodes when last sink detaches |
| Two-Level Flagging | [ADR-0012](adr/0012-two-level-flagging-dirty-and-check.md) | `DIRTY` for direct sinks, `CHECK` for transitive sinks to minimize work |
| FLAG_RELINK | [ADR-0010](adr/0010-flag-relink-mechanism-for-structural-reactivity.md) | Structural change flag for composite signals, invisible to core propagation |
| Two-Path Access | [ADR-0014](adr/0014-two-path-access-pattern-for-composite-signals.md) | Fast path (untracked rebuild) vs tracked path (edge re-establishment) for composites |
| Composite Lookups | [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md) | List/Collection lookups track structural changes; Store.byKey stays untracked (granularity preserved) |
| Shape-Indexed Types | [ADR-0018](adr/0018-shape-indexed-signal-types.md) | 📝 Proposed for v2.0. Types indexed by shape and mutability; origin moves to construction |

## Node Structure

Nodes compose from field mixins rather than a class hierarchy. See [ADR-0007](adr/0007-node-composition-via-field-mixins.md).

| Mixin | Fields |
|---|---|
| `SourceFields<T>` | `value`, `sinks`, `sinksTail`, `stop?` |
| `OptionsFields<T>` | `equals`, `guard?` |
| `SinkFields` | `fn`, `flags`, `sources`, `sourcesTail` |
| `OwnerFields` | `cleanup` |
| `AsyncFields` | `controller`, `error` |

Concrete node types combine them:

| Node | Composition | Additional fields |
|---|---|---|
| `StateNode<T>` | `SourceFields` + `OptionsFields` | — |
| `MemoNode<T>` | `SourceFields` + `OptionsFields` + `SinkFields` | `fn: MemoCallback<T>`, `error` |
| `TaskNode<T>` | `SourceFields` + `OptionsFields` + `SinkFields` + `AsyncFields` | `fn`, `pendingNode: StateNode<boolean>` |
| `EffectNode` | `SinkFields` + `OwnerFields` | `fn: EffectCallback` |
| `Scope` | `OwnerFields` | — |

A node's role follows from its mixins. `'sinks' in node` identifies a Source, and `'sources' in node` a Sink. `refresh()` uses the same technique to dispatch: `'controller' in node` selects the Task path, `'value' in node` the Memo path, and neither selects the Effect path.

`TaskNode` holds its pending state in a nested `StateNode<boolean>` rather than a plain field, which makes `isPending()` reactive like any other Source.

## Edge Structure

An `Edge` links one Source to one Sink and is embedded in both lists. See [ADR-0008](adr/0008-doubly-linked-list-edge-structure.md).

```ts
type Edge = {
	source: SourceNode
	sink: SinkNode
	nextSource: Edge | null
	prevSink: Edge | null
	nextSink: Edge | null
}
```

The two lists are not symmetric. A Sink's source list is singly linked through `nextSource`. A Source's sink list is doubly linked through `prevSink` and `nextSink`, which is what makes `unlink()` O(1) — removal happens from the Source side when a Sink detaches.

- `link(source, sink)` appends an edge, guarded by three fast paths ([ADR-0013](adr/0013-link-fast-path-optimizations.md)). During a recompute (`FLAG_RUNNING`), it first tries to reuse the existing edge at the current position, so a Sink whose dependencies are unchanged allocates nothing.
- `trimSources(node)` unlinks every edge past `sourcesTail` after a recompute. Dependencies read on the previous run but not the current one disappear here, which is what keeps the graph free of stale edges.
- `unlink(edge)` removes the edge and, when the Source has no sinks left, runs `source.stop()`. If that Source is itself a Sink, it trims its own sources and takes `FLAG_DIRTY`, cascading cleanup upstream. The flag matters: without it the node would sit `FLAG_CLEAN` with no sources, causing stale reads on reconnect. See [ADR-0011](adr/0011-cascading-cleanup-protocol-in-unlink.md).

## Flag State Machine

`SinkFields.flags` is a bitfield.

| Flag | Value | Meaning |
|---|---|---|
| `FLAG_CLEAN` | `0` | Value is current |
| `FLAG_CHECK` | `1 << 0` | A transitive dependency may have changed; verify before recomputing |
| `FLAG_DIRTY` | `1 << 1` | Must recompute |
| `FLAG_RUNNING` | `1 << 2` | Currently recomputing; a re-entrant `refresh()` throws `CircularDependencyError` |
| `FLAG_RELINK` | `1 << 3` | Structural change on a composite; invisible to core propagation ([ADR-0010](adr/0010-flag-relink-mechanism-for-structural-reactivity.md)) |

`FLAG_CHECK` and `FLAG_DIRTY` are ordered: `propagate()` compares `(flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag` and returns early, so a node already `DIRTY` is never downgraded to `CHECK` and traversal stops at nodes that carry no new information.

## Write Path

`setState(node, next)` is the entry point for every Source write.

1. Return immediately if `node.equals(node.value, next)`. An equal write propagates nothing, and because the traversal never starts, the entire downstream subtree is skipped.
2. Assign `node.value`.
3. Call `propagate(e.sink)` for each edge in `node.sinks`, flagging direct sinks `FLAG_DIRTY`.
4. `propagate()` recurses into `e.sink.sinks` with `FLAG_CHECK`, so transitive sinks learn only that they may be affected.
5. An `EffectNode` reached by `propagate()` is pushed onto `queuedEffects` instead of being flagged for lazy refresh.
6. `flush()` runs when `batchDepth === 0`.

`propagate()` also aborts in-flight async work: a node with a live `controller` calls `controller.abort()` and clears it, which is how a Task cancels when a dependency changes.

## Read Path

Reads are lazy. `refresh(node)` runs before a Sink returns its value.

1. If `FLAG_CHECK` is set, walk `node.sources` and `refresh()` each Source that has an `fn`. Stop early once the node becomes `FLAG_DIRTY` — one changed dependency is enough.
2. If `FLAG_RUNNING` is set, throw `CircularDependencyError`, naming the node type from its shape.
3. If `FLAG_DIRTY` is set, dispatch to `recomputeTask()`, `recomputeMemo()`, or `runEffect()`.
4. Otherwise the node verified clean: set `FLAG_CLEAN` and return the cached value.

A node marked `CHECK` that turns out to have unchanged dependencies never recomputes. That is the mechanism behind glitch-free reads.

`recomputeMemo()` sets `activeSink` to itself so `.get()` calls inside `fn` re-establish edges, then compares the result with `node.equals`. Only a changed value escalates sinks already flagged `CHECK` to `DIRTY`. A thenable returned by a callback that was classified as synchronous throws `PromiseValueError`.

`recomputeTask()` aborts the previous `AbortController`, creates a new one, and calls `fn(node.value, controller.signal)`. Resolution and rejection both check `controller.signal.aborted` first and discard late results. The settle path runs inside `batch()` so the value update and the `pendingNode` write flush together.

`runEffect()` runs `runCleanup(node)` first, sets both `activeSink` and `activeOwner` to itself, and registers a returned function as the next cleanup. On exit it keeps only `FLAG_DIRTY | FLAG_CHECK`, deliberately preserving a re-mark caused by the effect's own writes so `scheduleEffect()` can converge it.

## Effect Scheduling

- `batch(fn)`: Increments `batchDepth`; effects only flush when depth returns to 0. Batches nest.
- `flush()`: Drains `queuedEffects` in passes over snapshots, calling `refresh()` on each still-dirty effect; effects re-queued during a pass (e.g. by writing their own dependencies) run in the next pass, so self-writing effects converge and always observe final values. Capped at 1000 passes — a graph that never settles throws `EffectConvergenceError`. Effect errors are collected per effect so siblings still run, then rethrown after the drain (a single error as-is, multiple wrapped in `AggregateError`). A `flushing` guard prevents re-entry; effects still flagged `RUNNING` are skipped (their own runner converges them via `scheduleEffect()`).
- Effects double as owners: child effects/scopes created during execution are disposed when the parent re-runs.

## Ownership and Cleanup

- `activeOwner`: Module-level variable pointing to current owner (EffectNode or Scope). Child effects/scopes register their dispose on `activeOwner`.
- `createScope(fn, options?)`: Creates ownership scope without an effect. The scope becomes `activeOwner` during `fn`. Returns `dispose()`. Unless `options.root === true`, disposal auto-registers on parent owner.
- Cleanup storage: `cleanup` field is polymorphic (`null` → function → array) for efficiency.

## Equality Strategies

`OptionsFields.equals` gates every write. Because `setState()` returns before touching `node.sinks`, an equal write suppresses propagation for the whole downstream subtree, not just the node itself. Naming follows [ADR-0003](adr/0003-equality-strategy-naming-convention.md).

| Constant | Implementation | Use |
|---|---|---|
| `DEFAULT_EQUALITY` | `a === b` | Implicit default; pass explicitly to make the strategy visible |
| `SKIP_EQUALITY` | `() => false` | Mutable objects whose reference never changes — a DOM element observed by `MutationObserver` |
| `DEEP_EQUALITY` | `deepEqual(a, b)` | Values that re-derive to a structurally identical result |

`deepEqual()` walks arrays and records, compares `Date` by `getTime()` and `RegExp` by `source` plus `flags`, and carries a `WeakSet` cycle guard scoped to the current recursion path. The entry is removed in a `finally` block as each call returns, so an object reached twice through different non-cyclic paths is still compared independently. See [ADR-0016](adr/0016-path-scoped-cycle-detection-in-deep-equality.md).

`isEqual` is a deprecated alias of `DEEP_EQUALITY`.

## Signal Types

All signal types are defined in `src/nodes/`. Each exports a factory function (e.g., `createState`, `createMemo`) and the corresponding node type.

| Type | Node | Role | Key Behavior |
|------|------|------|--------------|
| **State** | `StateNode<T>` | Source | Mutable value container; `get()`/`set()`/`update()` |
| **Sensor** | `StateNode<T>` | Source | Read-only external input; lazy `watched` callback lifecycle |
| **Memo** | `MemoNode<T>` | Source + Sink | Sync derived computation; lazy evaluation; optional `watched` invalidation |
| **Task** | `TaskNode<T>` | Source + Sink | Async derived computation; aborts in-flight on dependency change; `isPending()` |
| **Effect** | `EffectNode` | Sink | Side-effecting computation; runs immediately; auto-cleanup |
| **Slot** | `MemoNode<T>` | Source + Sink | Stable reactive source delegating to swappable backing signal |
| **Store** | `MemoNode<Record>` | Source + Sink | Reactive object; each property is a signal; structural reactivity |
| **List** | `MemoNode<T[]>` | Source + Sink | Reactive array; stable keys; per-item reactivity; structural diffing |
| **Collection** | `MemoNode<T[]>` | Source + Sink | Two patterns: `createCollection(watched)` (external) and `deriveCollection(source, fn)` (internal) |

Composite signals (Store, List, Collection, deriveCollection) use the [FLAG_RELINK](adr/0010-flag-relink-mechanism-for-structural-reactivity.md) + [two-path access](adr/0014-two-path-access-pattern-for-composite-signals.md) pattern for structural reactivity.

### Target Taxonomy (v2.0, proposed)

The table above indexes types by shape *and* origin, which leaves four cells of the
shape × origin matrix empty — most consequentially, no keyed sequence or keyed record can be
derived from an asynchronous source. [ADR-0018](adr/0018-shape-indexed-signal-types.md) proposes
indexing types by **shape and mutability only**, moving origin to the construction site.

| Type | Node | Shape | Writable |
|------|------|-------|----------|
| `Signal<T>` / `MutableSignal<T>` | `StateNode` \| `MemoNode` \| `TaskNode` | Single value | No / Yes |
| `List<T, S>` / `MutableList<T, S>` | `MemoNode<T[]>` | Keyed sequence | No / Yes |
| `Store<T>` / `MutableStore<T>` | `MemoNode<Record>` | Keyed record | No / Yes |

`State`, `Memo`, `Task`, `Sensor`, and `Collection` survive only as construction verbs.
`Symbol.toStringTag` carries the shape (`'Signal' | 'List' | 'Store'`), not the origin.
`Effect` and `Slot` are orthogonal to shape and unaffected.

Construction splits on the two verbs `create*` (→ mutable) and `derive*` (→ readonly), with
`derive*` dispatching on its input: `isAsyncFunction` selects the Task path, any other function the
Memo path, a non-function the external-push path (which requires `options.watched`). `watched` is
an option and never a callback position, because a synchronous derivation callback and an
external-push callback are both plain arity-≤1 sync functions and neither can be called to
disambiguate — a derivation must stay lazy, a `watched` callback must run on subscribe.

No node-level change is required. A derived composite is a memoized recompute whose result is
applied through the structural diff already implemented in `list.set()` and `store.set()`, so
child-signal identity is preserved by key. The mechanisms in ADR-0010, ADR-0014, ADR-0015, and
ADR-0017 carry over unchanged.

### Composite Lookup Methods

**List and Collection** — `at()`, `byKey()`, `keyAt()`, `indexOfKey()`, and the `Symbol.iterator` create the same O(1) **structural-consumer** edge as `keys()`, `length`, and `get()` — via `subscribe()` (or `ensureFresh()` for `deriveCollection`, whose node can be stale from upstream tracked changes). Reading any of these inside an effect or memo re-runs it on structural change (key add/remove/reorder). The consumer edge is **independent** of the two-path pattern in ADR-0014, which governs *value-rebuild* edges (child signal → composite node); `subscribe()`→`link()` never triggers value-rebuild relinking. (The iterator edge is established lazily on first `.next()`, since these are generator methods.)

**Store** — `byKey()` and the proxy property access (`store.prop`) deliberately do **not** create a structural edge. Store keys are statically known from `T`, and proxy reads are already granular: `store.name` returns the child `State`, whose `.get()` forms a *property-level* edge. Adding a structural edge on top would make every property read also subscribe to "any key added/removed," defeating per-property reactivity (Store's defining feature). The Store `Symbol.iterator` *does* track structure, like `store.keys()` and `store.get()` — it is a whole-store traversal, not a per-property read. See [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md) for the rationale behind this asymmetry.

For a derived external-push Store (`deriveStore(seed, { watched })`), per-property reads create no structural *edge* (unchanged, ADR-0015) but they do activate the `watched` *lifecycle*: the facade links a dedicated anchor node that never propagates, so any observation form — structural or per-property — starts and keeps the lifecycle alive. Activation and tracking are separate concerns.

Return types remain honest: `byKey(k): S | undefined` etc. on List/Collection (a runtime string may not be a present key). `Store.byKey` is non-nullable because Store keys are statically known from `T`.

## Testing Strategy

All tests live in `test/`. The `test` script runs the full suite. There is no formal separation of unit and integration tests.

Regression tests (excluded from default run, executed via `npm run regression`) ensure stability:

- **Bundle size** (`test/regression-bundle.test.ts`): Three assertions with two different jobs. The tree-shaken core figure (≤ 4096 B gzipped) is a hard promise and is never relaxed. The full-library figures (≤ 32768 B minified, ≤ 10240 B gzipped) are a working diagnostic against an accidental blowup, re-baselined from measurement at each release. The two full-library figures move in *opposite* directions under deduplication — gzip compresses a second near-identical copy almost for free — so neither is a budget to optimise against. See REQUIREMENTS.md § Bundle Size.
- **Performance** (`test/regression-performance.test.ts`): Compares current build against last stable npm release (`@zeix/cause-effect-stable`). Runs primitive scenarios (State/Memo/Effect chains) and composite scenarios (List/Store/Collection mutations). Current must not exceed stable by >20% (with 1ms floor). Uses 11 alternating passes per scenario, median (6th) value, with GC and JIT normalization.
