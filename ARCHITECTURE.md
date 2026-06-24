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
| Two-Level Flagging | [ADR-0012](adr/0012-two-level-flagging-dirty-and-check.md) | `DIRTY` for direct dependents, `CHECK` for transitive dependents to minimize work |
| FLAG_RELINK | [ADR-0010](adr/0010-flag-relink-mechanism-for-structural-reactivity.md) | Structural change flag for composite signals, invisible to core propagation |
| Two-Path Access | [ADR-0014](adr/0014-two-path-access-pattern-for-composite-signals.md) | Fast path (untracked rebuild) vs tracked path (edge re-establishment) for composites |
| Composite Lookups | [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md) | List/Collection lookups track structural changes; Store.byKey stays untracked (granularity preserved) |

## Change Propagation

See [ADR-0012](adr/0012-two-level-flagging-dirty-and-check.md) for the flag system and [ADR-0010](adr/0010-flag-relink-mechanism-for-structural-reactivity.md) for structural reactivity.

The core flow: source change → `propagate()` flags direct sinks `DIRTY` and transitive sinks `CHECK` → `refresh()` verifies `CHECK` nodes before recomputing → `flush()` executes queued effects.

## Effect Scheduling

- `batch(fn)`: Increments `batchDepth`; effects only flush when depth returns to 0. Batches nest.
- `flush()`: Iterates `queuedEffects`, calling `refresh()` on each still-dirty effect. A `flushing` guard prevents re-entry.
- Effects double as owners: child effects/scopes created during execution are disposed when the parent re-runs.

## Ownership and Cleanup

- `activeOwner`: Module-level variable pointing to current owner (EffectNode or Scope). Child effects/scopes register their dispose on `activeOwner`.
- `createScope(fn, options?)`: Creates ownership scope without an effect. The scope becomes `activeOwner` during `fn`. Returns `dispose()`. Unless `options.root === true`, disposal auto-registers on parent owner.
- Cleanup storage: `cleanup` field is polymorphic (`null` → function → array) for efficiency.

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

### Composite Lookup Methods

**List and Collection** — `at()`, `byKey()`, `keyAt()`, `indexOfKey()`, and the `Symbol.iterator` create the same O(1) **structural-consumer** edge as `keys()`, `length`, and `get()` — via `subscribe()` (or `ensureFresh()` for `deriveCollection`, whose node can be stale from upstream tracked changes). Reading any of these inside an effect or memo re-runs it on structural change (key add/remove/reorder). The consumer edge is **independent** of the two-path pattern in ADR-0014, which governs *value-rebuild* edges (child signal → composite node); `subscribe()`→`link()` never triggers value-rebuild relinking. (The iterator edge is established lazily on first `.next()`, since these are generator methods.)

**Store** — `byKey()` and the proxy property access (`store.prop`) deliberately do **not** create a structural edge. Store keys are statically known from `T`, and proxy reads are already granular: `store.name` returns the child `State`, whose `.get()` forms a *property-level* edge. Adding a structural edge on top would make every property read also subscribe to "any key added/removed," defeating per-property reactivity (Store's defining feature). The Store `Symbol.iterator` *does* track structure, like `store.keys()` and `store.get()` — it is a whole-store traversal, not a per-property read. See [ADR-0015](adr/0015-composite-lookup-methods-track-structural-changes.md) for the rationale behind this asymmetry.

Return types remain honest: `byKey(k): S | undefined` etc. on List/Collection (a runtime string may not be a present key). `Store.byKey` is non-nullable because Store keys are statically known from `T`.

## Key Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Sync callback returning a `Promise` in Memo/Slot | Throw `PromiseValueError` in `recomputeMemo()` (`graph.ts`) the first time a non-`async` callback's return value is thenable | (a) Auto-detect ahead of time in `isAsyncFunction` and reclassify as Task; (b) leave as silent, undocumented misclassification (status quo) | Reclassifying requires invoking the callback before the Memo/Task routing decision is made, which breaks Memo's lazy-evaluation contract and is unreliable for branchy functions. Morphing a live `MemoNode` into a `TaskNode` after callers already hold a `Memo<T>` would silently change `.get()` semantics (synchronous return vs. throws-until-resolved) with no compile-time signal — unsound. A single check at the existing `recomputeMemo()` choke point catches Memo, Slot, and `createComputed`/`createSignal` misuse uniformly, costs one `typeof` check per recompute, and only fires on code that was already broken (non-breaking, "Fixed" changelog category). |
| Other 9 documented "non-obvious behaviors" (conditional reads delaying `watched`, `equals` suppressing subtrees, lazy `watched`/`unwatched` lifecycle stability, Task abort-on-change, Sensor/Task unset state, synchronous scope cleanup, no `flush` loop guard, `untrack` vs `watched` independence, `byKey().set()` vs `list.replace()`) | No code changes. Reframe as direct, predictable consequences of the dependency-tracking model in developer-facing docs rather than standalone gotchas | Changing `byKey().set()` to always propagate structurally (rejected: would force every item signal to carry a permanent edge to its list's structural node regardless of whether anything observes structurally, costing a `propagate()` traversal on every item write — conflicts with the "minimal work" performance constraint, and `list.replace()` already exists as the correct API for this case, pinned by `test/list.test.ts:261`) | Each behavior is either inherent to any correct fine-grained reactive graph (read-based edge creation, two-level dirty/check flagging, lazy lifecycle keyed on subscriber count) or an already-decided trade-off with a working escape hatch. The fix is conceptual, not code: a reader who understands the model shouldn't find these surprising. Serves REQUIREMENTS.md goal #2 (predictable mental model) without touching synchronous-path performance (goal #4). |

## Testing Strategy

All tests live in `test/`. The `test` script runs the full suite. There is no formal separation of unit and integration tests.

Regression tests (excluded from default run, executed via `npm run regression`) ensure stability:

- **Bundle size** (`test/regression-bundle.test.ts`): Asserts minified + gzipped bundle stays within absolute limits from REQUIREMENTS.md (≤ 10,240 B).
- **Performance** (`test/regression-performance.test.ts`): Compares current build against last stable npm release (`@zeix/cause-effect-stable`). Runs primitive scenarios (State/Memo/Effect chains) and composite scenarios (List/Store/Collection mutations). Current must not exceed stable by >20% (with 1ms floor). Uses 11 alternating passes per scenario, median (6th) value, with GC and JIT normalization.
