# ADR 0010: FLAG_RELINK Mechanism for Structural Reactivity

## Status

✅ Accepted

## Context

Composite signal types (Store, List, Collection, deriveCollection) manage child signals whose structure can change (items added, removed, reordered). When structural mutations occur, the parent composite signal needs to:

1. Mark itself as dirty so consumers recompute
2. **Re-establish edges** from new child signals to the composite
3. **Remove stale edges** from deleted child signals

The naive approach of nulling `node.sources`/`node.sourcesTail` on structural changes causes **edge orphaning**: edges remain in upstream sink lists (e.g., in a List's item signals), preventing the cascading cleanup mechanism in `unlink()` from reaching source nodes and firing their `stop` callbacks.

This was a critical bug: lazy resources (Sensor, Collection, watched Store/List) would never be deallocated when the last consumer unsubscribed from a structurally-mutated composite signal.

## Decision

Introduce **`FLAG_RELINK`** (bit 8, value 8) as a structural change flag that is:
- **Invisible** to the core propagation and refresh machinery (`propagate()`, `refresh()`)
- **Detected** by composite signal types during value access

**Mechanism:**
1. On structural mutation, set `node.flags = FLAG_DIRTY | FLAG_RELINK`
2. Composite signal's `get()` detects `FLAG_RELINK` and forces a **tracked refresh** after rebuilding
3. `recomputeMemo()` (via `refresh()`) calls `link()` for new child signals and `trimSources()` for removed ones
4. `FLAG_RELINK` is always cleared by `recomputeMemo()` which assigns `node.flags = FLAG_RUNNING` (clearing all bits)

This approach avoids orphaning edges because the edge lists are never nulled — they are only modified through the standard `link()`/`trimSources()`/`unlink()` machinery, which maintains consistency across both directions of each edge.

**Two-path access pattern:**
- **Fast path**: `untrack(buildValue)` rebuilds value without re-linking (when no structural changes)
- **Tracked path**: `refresh()` re-establishes all edges (when `FLAG_RELINK` is set or first subscriber)

## Alternatives Considered

- **(a) Null edge lists on structural change**: Rejected — causes edge orphaning, breaks cascading cleanup
- **(b) Eager re-linking on every structural change**: Rejected — performance overhead, unnecessary when no consumers
- **(c) Separate structural flag checked by all nodes**: Rejected — pollutes core graph logic with composite-specific concerns

## Consequences

- ✅ **No edge orphaning**: Edge lists remain consistent, cascading cleanup works correctly
- ✅ **Lazy re-linking**: Only re-establish edges when value is actually read
- ✅ **Separation of concerns**: Core graph doesn't need to know about structural changes
- ✅ **Uniform pattern**: Store, List, Collection, deriveCollection all use the same mechanism
- ✅ **Fixes critical bug**: Lazy resources now properly deallocate on last subscriber detach
- ⚠️ **Additional flag bit**: Uses one of the 5 available flag bits (flags are 5-bit bitmap)

## Related

- Requirements: [Unified Graph](REQUIREMENTS.md#unified-graph), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
- Architecture: [Flag-Based Dirty Tracking](ARCHITECTURE.md#flag-based-dirty-tracking), [Store](ARCHITECTURE.md#store-srcnodesstorets), [List](ARCHITECTURE.md#list-srcnodeslistts), [Collection](ARCHITECTURE.md#collection-srcnodescollectionts)
- Supersedes: Previous approach of nulling edge lists (unreleased)
