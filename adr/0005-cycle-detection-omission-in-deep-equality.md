# ADR 0005: Cycle Detection Omission in Deep Equality

## Status

✅ Accepted

## Context

The `DEEP_EQUALITY` strategy (and the deprecated `isEqual` function) performs deep equality comparison on signal values. When comparing complex object graphs, circular references are possible:

```typescript
const obj: any = { a: 1 };
obj.self = obj; // Circular reference
```

We needed to decide whether to detect and handle circular references, and if so, how.

## Decision

**No cycle detection** — use plain recursion without `WeakSet` tracking.

### Rationale

1. **Performance**: `WeakSet` allocation on every `List.set()` / `Store.set()` call is unnecessary overhead for the common case. Most signal values are plain JSON-like objects without circular references.

2. **Philosophy**: Circular signal data is a user bug. The library's position is that a stack overflow is an acceptable outcome for this edge case.

3. **Policy alignment**: 
   - Importing an external package (like `fast-deep-equal` or `dequal`) contradicts the zero-dependency policy
   - Importing a ~20-line function as a dependency contradicts bundle-size constraints

4. **Impact assessment**: 
   - `DEEP_EQUALITY` has never shipped in a release
   - Deprecated `isEqual` has no known consumers
   - No major version bump required for this change

## Alternatives Considered

- **(a) Keep `WeakSet` per call**: Rejected — unnecessary allocation overhead for common cases
- **(b) Import `fast-deep-equal` or `dequal`**: Rejected — contradicts zero-dependency policy and bundle-size constraints

## Consequences

- ✅ Zero additional dependencies
- ✅ Minimal runtime overhead (no WeakSet allocation)
- ✅ Bundle size stays within constraints
- ✅ Simple, straightforward implementation
- ⚠️ Stack overflow on circular data (acceptable per design philosophy)

## Related

- Architecture: [Cycle detection in isEqual / DEEP_EQUALITY](ARCHITECTURE.md#key-decisions)
- Requirements: [Bundle Size Constraints](REQUIREMENTS.md#size-and-performance-constraints), [Zero-Dependency Policy](REQUIREMENTS.md#design-principles)
