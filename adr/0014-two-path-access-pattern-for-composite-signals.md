# ADR 0014: Two-Path Access Pattern for Composite Signals

## Status

✅ Accepted

## Context

Composite signal types (Store, List, Collection) have a dual role:
1. **They are signals** — can be read by consumers
2. **They manage child signals** — their value is composed from child signal values

When a consumer reads a composite signal, we need to:
- Return the current value (composed from child signals)
- Establish dependency edges from child signals to the composite
- Track which child signals exist (for structural reactivity)

However, **establishing edges on every read is expensive** — it would rebuild the entire dependency structure repeatedly, even when nothing has changed.

## Decision

Implement a **two-path access pattern** with a **fast path** and a **tracked path**:

### Fast Path (Subsequent Reads)
```typescript
if (node.sources && !(node.flags & FLAG_RELINK)) {
  return untrack(buildValue); // Rebuild without re-linking
}
```
When edges already exist and no structural changes have occurred (`FLAG_RELINK` not set), use `untrack(buildValue)` to rebuild the value without creating dependency edges.

### Tracked Path (First Read or Structural Changes)
```typescript
// FLAG_RELINK is set, or first subscriber
refresh(node); // via recomputeMemo()
```
When `FLAG_RELINK` is set (indicating structural changes) or this is the first subscriber (no `node.sources` yet), force a tracked `refresh()` that:
1. Sets `activeSink = node`
2. Calls `buildValue()` which reads all child signals
3. Each `.get()` call creates edges via `link(child, node)`
4. Sets `sourcesTail` to the last accessed child
5. Clears `FLAG_RELINK`

### Structural Change Handling
On structural mutations (add/remove in List, property changes in Store):
```typescript
node.flags |= FLAG_DIRTY | FLAG_RELINK;
```
This ensures the next `get()` takes the tracked path to re-establish edges.

## Alternatives Considered

- **(a) Always track on read**: Rejected — O(n) overhead on every read for large composites
- **(b) Only track on first read**: Rejected — doesn't handle structural changes
- **(c) Manual edge management**: Rejected — error-prone, more complex API

## Consequences

- ✅ **Performance**: Fast path is O(1) for value rebuilding without edge overhead
- ✅ **Correctness**: Tracked path ensures edges are always up-to-date after structural changes
- ✅ **Unified pattern**: Store, List, Collection, deriveCollection all use the same pattern
- ✅ **Lazy edge establishment**: Edges only created when needed (on first read)
- ⚠️ **Slight complexity**: Requires careful flag management

## Clarification (added by ADR-0015)

This ADR governs **value-rebuild edges** — the edges from child signals to the composite node that are rebuilt on the tracked path. It does **not** address the separate **structural-consumer edge** that a downstream effect/memo establishes against the composite node itself when it reads `keys()`, `length`, or `get()`. Those are O(1) edges via `link()` that do not trigger value-rebuild relinking.

[ADR-0015](0015-composite-lookup-methods-track-structural-changes.md) extends the picture: the direct-lookup methods on List/Collection (`at`, `byKey`, `keyAt`, `indexOfKey`) now also create that structural-consumer edge. Store's `byKey` and proxy access deliberately do **not**, because Store property reads are already granular. This clarifies that the two-path pattern here is solely about the child→composite value-rebuild path, not a reason to keep direct lookups untracked.

## Related

- Requirements: [Performance Constraints](REQUIREMENTS.md#performance), [Unified Graph](REQUIREMENTS.md#unified-graph)
- Architecture: [Store](ARCHITECTURE.md#store-srcnodesstorets), [List](ARCHITECTURE.md#list-srcnodeslistts), [Collection](ARCHITECTURE.md#collection-srcnodescollectionts)
- Dependencies: [FLAG_RELINK Mechanism](0010-flag-relink-mechanism-for-structural-reactivity.md), [activeSink Protocol](0009-activeSink-protocol-for-automatic-dependency-tracking.md)
