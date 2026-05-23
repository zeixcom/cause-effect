# ADR 0008: Doubly-Linked List Edge Structure

## Status

✅ Accepted

## Context

The signal graph is a directed acyclic graph (DAG) where edges connect source nodes to sink nodes. Edges must support:

1. **Fast traversal** from source to sinks (for propagation)
2. **Fast traversal** from sink to sources (for dependency tracking)
3. **O(1) removal** when dependencies change (for graph adaptation)
4. **Minimal memory overhead** (for bundle size and runtime performance)

A naive approach using separate edge objects stored in arrays or Sets would:
- Require additional memory allocation per edge
- Have O(n) removal complexity
- Not meet the "Minimal memory" design goal

## Decision

Store edges as **doubly-linked lists embedded directly in nodes**, with each edge participating in two linked lists simultaneously:

```typescript
type Edge = {
  source: SourceNode      // the node being depended on
  sink: SinkNode          // the node that depends on source
  nextSource: Edge | null // next edge in the sink's source list
  prevSink: Edge | null   // previous edge in the source's sink list
  nextSink: Edge | null   // next edge in the source's sink list
}
```

**Structure:**
- Each **source** maintains a singly-linked list of its sinks (`sinks` → `sinksTail`), threaded through `nextSink`/`prevSink`
- Each **sink** maintains a singly-linked list of its sources (`sources` → `sourcesTail`), threaded through `nextSource`
- The `prevSink` pointer enables O(1) removal from the source's sink list

This design means:
- No separate edge storage data structures
- Edges are allocated only when needed
- All operations (addition, removal, traversal) are O(1)

## Alternatives Considered

- **(a) Separate Edge objects in Sets**: Rejected — O(n) removal, higher memory overhead from object allocation
- **(b) Adjacency lists with arrays**: Rejected — O(n) removal for unlinking
- **(c) WeakMap-based edge tracking**: Rejected — Higher memory overhead, GC complexity

## Consequences

- ✅ **O(1) edge operations**: Addition, removal, and traversal are all constant time
- ✅ **Minimal memory**: Edges stored inline, no separate data structures
- ✅ **Bundle size efficient**: No external dependencies or complex data structures
- ✅ **Cache-friendly**: Sequential memory access patterns during traversal
- ⚠️ **Manual pointer management**: More error-prone to implement correctly
- ⚠️ **No built-in iteration**: Must use explicit traversal loops

## Related

- Requirements: [Bundle Size Constraints](REQUIREMENTS.md#size-and-performance-constraints), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
- Architecture: [Edges](ARCHITECTURE.md#edges), [Edge Creation: link(source, sink)](ARCHITECTURE.md#edge-creation-linksource-sink), [Edge Removal: trimSources(node) and unlink(edge)](ARCHITECTURE.md#edge-removal-trimsourcesnode-and-unlinkedge)
