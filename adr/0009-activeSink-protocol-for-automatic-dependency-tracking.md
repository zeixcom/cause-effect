# ADR 0009: activeSink Protocol for Automatic Dependency Tracking

## Status

✅ Accepted

## Context

Fine-grained reactivity requires tracking which signals a computation depends on. This dependency information must be accurate and up-to-date for correct propagation. We needed a mechanism that:

1. **Automatically** captures dependencies without manual declaration
2. **Dynamically** adapts when dependencies change (e.g., conditional branches)
3. **Correctly** handles nested computations
4. **Minimally** impacts performance

Previous approaches in other libraries include:
- Manual dependency declaration (verbose, error-prone)
- Proxy-based tracking (slow, non-deterministic)
- Static analysis (build-time only, not runtime adaptive)

## Decision

Implement the **`activeSink` protocol**: a module-level variable that tracks the currently-executing sink node.

**Mechanism:**
1. Before a sink recomputes, set `activeSink = node`
2. When any signal's `.get()` method is called, it checks `activeSink`
3. If `activeSink` is non-null, call `link(source, activeSink)` to establish an edge
4. After execution completes, restore the previous `activeSink`

```typescript
// In signal.get()
signal.get()
  └─ if (activeSink) link(thisNode, activeSink)
```

This creates a **push-based** dependency tracking model where dependencies are established as a side effect of reading values during computation.

**Key properties:**
- **Automatic**: No manual dependency declaration needed
- **Dynamic**: Dependencies are re-established on each recomputation, adapting to conditional branches
- **Accurate**: Graph always reflects true runtime dependencies
- **Stack-safe**: Previous `activeSink` is saved and restored, supporting nested computations

## Alternatives Considered

- **(a) Proxy-based tracking**: Rejected — significant performance overhead, non-deterministic behavior with some JS patterns
- **(b) Manual dependency declaration**: Rejected — verbose, error-prone, doesn't handle conditional dependencies well
- **(c) Static analysis at build time**: Rejected — doesn't support runtime-adaptive dependencies, adds build complexity
- **(d) Pull-based with explicit listing**: Rejected — requires maintaining separate dependency lists, more memory overhead

## Consequences

- ✅ **Automatic dependency tracking**: Developers don't need to manually declare dependencies
- ✅ **Dynamic adaptation**: Conditional dependencies (if/else, loops) work correctly
- ✅ **Correctness guarantee**: Graph never has stale edges — "Dynamic dependency tracking means the graph never has stale edges"
- ✅ **Performance**: O(1) per read check, minimal overhead
- ✅ **Nested computation support**: Stack-based restoration handles nested sinks correctly
- ⚠️ **Implicit behavior**: May be surprising to developers expecting explicit dependency declaration

## Related

- Requirements: [Explicit Reactivity](REQUIREMENTS.md#explicit-reactivity)
- Architecture: [The activeSink Protocol](ARCHITECTURE.md#the-activesink-protocol), [Edge Creation: link(source, sink)](ARCHITECTURE.md#edge-creation-linksource-sink)
