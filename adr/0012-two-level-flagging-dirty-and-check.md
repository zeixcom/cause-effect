# ADR 0012: Two-Level Flagging (DIRTY and CHECK)

## Status

✅ Accepted

## Context

When a source value changes, all dependent sinks need to be notified. However, notifying all dependents with the same urgency is inefficient:

- **Direct dependents** (immediately reading the changed source) must recompute
- **Transitive dependents** (depending on a direct dependent) may not need to recompute if the direct dependent's value hasn't actually changed

A single-flag system would cause unnecessary recomputation in wide graphs where intermediate nodes filter out changes via equality checks.

## Decision

Implement **two-level flagging** using a bitmap:

| Flag | Value | Meaning | Recipients |
|------|-------|---------|------------|
| `FLAG_CLEAN` | 0 | Value is up to date | - |
| `FLAG_CHECK` | 1 | A transitive dependency may have changed — verify before recomputing | Transitive dependents |
| `FLAG_DIRTY` | 2 | A direct dependency changed — recomputation required | Direct dependents |
| `FLAG_RUNNING` | 4 | Currently executing (used for circular dependency detection and edge reuse) | - |
| `FLAG_RELINK` | 8 | Structural change requires edge re-establishment on next read | Composite signals only |

**Propagation behavior in `propagate(node, newFlag?)`:**
- Direct dependents (Memo/Task sinks): Flagged with `newFlag` (typically `DIRTY`)
- Their own sinks: Recursively flagged with `CHECK`
- Effect sinks: Flagged with `newFlag` and pushed onto `queuedEffects`

**Refresh behavior in `refresh(node)`:**
- `FLAG_CHECK`: Walk source list, recursively `refresh()` sink sources. Only recompute if upgraded to `DIRTY`
- `FLAG_DIRTY`: Recompute the node immediately

This means a `CHECK` node only recomputes if, upon inspection, one of its sources turns out to have actually changed.

## Alternatives Considered

- **(a) Single FLAG_DIRTY for all**: Rejected — causes unnecessary recomputation in wide graphs
- **(b) Three-level flagging**: Rejected — adds complexity without clear benefit
- **(c) Lazy flag propagation**: Rejected — harder to reason about, potential for missed updates

## Consequences

- ✅ **Minimizes work**: Transitive dependents only recompute if necessary
- ✅ **Correctness**: All dependents are notified, but only recompute when needed
- ✅ **Simple bitmap**: 5 bits fit in a single byte, efficient bitmask operations
- ✅ **Compatible with equality**: Memo/Task with equality checks naturally benefit — `CHECK` nodes verify equality before recomputing
- ⚠️ **Slightly complex logic**: Requires careful flag management in propagate/refresh

## Related

- Requirements: [Minimal work design goal](ARCHITECTURE.md#overview) ("Only dirty nodes recompute")
- Architecture: [Flag-Based Dirty Tracking](ARCHITECTURE.md#flag-based-dirty-tracking), [The propagate(node, newFlag?) Function](ARCHITECTURE.md#the-propagatenode-newflag-function), [The refresh(node) Function](ARCHITECTURE.md#the-refreshnode-function)
