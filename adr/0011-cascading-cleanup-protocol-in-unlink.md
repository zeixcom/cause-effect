# ADR 0011: Cascading Cleanup Protocol in unlink()

## Status

✅ Accepted

## Context

The signal graph contains **intermediate nodes** (Memo, Task) that are both sources (producing values) and sinks (consuming dependencies). When an edge is removed, we need to ensure:

1. **Resource cleanup**: If a source has no more sinks, its `stop` callback should fire (for lazy resources like Sensor, Collection, watched Store/List)
2. **Graph cleanup**: Intermediate nodes should also detach from their upstream dependencies when no longer needed

Without cascading cleanup, intermediate nodes like `deriveCollection`'s internal MemoNode would retain stale sink references, and their watched lifecycle would never trigger cleanup, causing **resource leaks**.

## Decision

Implement **cascading cleanup** in `unlink(edge)`:

```typescript
unlink(edge) {
  // Remove edge from source's sink list
  removeFromSourceSinkList(edge);
  
  // If source has no more sinks
  if (source.sinks === null) {
    // 1. Watched cleanup: invoke stop callback
    if (source.stop) source.stop();
    
    // 2. Cascading cleanup: if source is also a sink, trim its sources
    if ('sources' in source) {
      trimSources(source);  // Recursively unlinks from upstream
    }
  }
}
```

**How it works:**
1. When the last edge from an effect to a derived collection is removed, `unlink()` fires the collection's `stop` callback
2. The collection's internal MemoNode (which is also a sink) has its sources trimmed via `trimSources()`
3. This removes edges from the MemoNode to its child signals (e.g., List items)
4. If a child signal (e.g., a List) has no more sinks, its `stop` callback fires
5. Recursion continues upstream until reaching source nodes with no more dependents

**Recursion is bounded** by graph depth since the graph is a DAG (no cycles).

## Alternatives Considered

- **(a) Non-cascading cleanup (only direct)**: Rejected — causes resource leaks for intermediate nodes
- **(b) Reference counting**: Rejected — adds overhead to all reads/writes, not just cleanup
- **(c) Explicit cleanup registration**: Rejected — more verbose, error-prone for library users

## Consequences

- ✅ **No resource leaks**: Lazy resources (Sensor, Collection, watched Store/List) are properly deallocated
- ✅ **Automatic**: Works transparently for all signal types
- ✅ **Correct for intermediate nodes**: deriveCollection, derived Store properties, etc. all clean up correctly
- ✅ **Bounded recursion**: DAG property ensures no infinite loops
- ✅ **Minimal overhead**: Only runs when edges are actually removed
- ⚠️ **Recursive call stack**: Deep graphs could cause stack overflow (mitigated by DAG property and typical graph depths)

## Related

- Requirements: [Unified Graph](REQUIREMENTS.md#unified-graph), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
- Architecture: [Edge Removal: trimSources(node) and unlink(edge)](ARCHITECTURE.md#edge-removal-trimsourcesnode-and-unlinkedge)
- Dependencies: [FLAG_RELINK Mechanism](0010-flag-relink-mechanism-for-structural-reactivity.md) (enables edge consistency for cascading cleanup to work)
