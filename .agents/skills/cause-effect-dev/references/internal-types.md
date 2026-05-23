<overview>
Internal node shapes and global pointers in the @zeix/cause-effect graph engine. Read this when working on graph propagation, ownership, or cleanup.
</overview>

<node_shapes>
Five node shapes are used internally. Source files are authoritative — these are summaries only.

| Shape | Role | File |
|---|---|---|
| `StateNode<T>` | Source only — holds a value, no dependencies | `src/nodes/state.ts` |
| `MemoNode<T>` | Source + sink — derives a value from dependencies | `src/nodes/memo.ts` |
| `TaskNode<T>` | Source + sink + `AbortController` — async derivation with cancellation | `src/nodes/task.ts` |
| `EffectNode` | Sink + owner — runs side effects, owns child effects/scopes | `src/nodes/effect.ts` |
| `Scope` | Owner only — groups cleanup registrations, no reactive tracking | `src/graph.ts` |

`Slot`, `Store`, `List`, and `Collection` are built on top of `MemoNode<T>` internally.
</node_shapes>

<global_pointers>
Two independent global pointers are maintained by `src/graph.ts`:

**`activeSink`**
- Set to the currently-running Memo, Task, or Effect during its computation
- Any signal read while `activeSink` is set records a dependency edge to it
- Nulled by `untrack(fn)` — reads inside `fn` do not create edges
- Reset to `null` after each computation completes

**`activeOwner`**
- Set to the currently-running Effect or Scope
- Any cleanup registered while `activeOwner` is set is attached to that owner
- Nulled by `unown(fn)` — cleanups registered inside `fn` are not owned by the current context
- For web component `connectedCallback`, prefer `createScope(fn, { root: true })` over `unown(() => createScope(fn))` — both suppress parent registration, but `{ root: true }` is clearer at the call site
</global_pointers>

<ownership_vs_tracking>
The two pointers are independent and serve different purposes:

| Pointer | Purpose | Nulled by |
|---|---|---|
| `activeSink` | Dependency tracking (what re-runs when a source changes) | `untrack()` |
| `activeOwner` | Cleanup registration (what is disposed when an owner is disposed) | `unown()` |

A computation can track dependencies without owning cleanups, and vice versa. These are not the same concept.
</ownership_vs_tracking>

<flag_semantics>
Propagation is driven by bitmask flags defined in `src/graph.ts`. Read that file and `ARCHITECTURE.md` for the full semantics. Key flags:

- `FLAG_DIRTY` — node's value is stale and must recompute
- `FLAG_CHECK` — node may be stale; check sources before deciding whether to recompute
- `FLAG_NOTIFIED` — node has already been scheduled in the current flush

`FLAG_CHECK` is how `equals` suppresses subtrees: when a Memo recomputes to the same value, downstream nodes are marked `FLAG_CHECK` instead of `FLAG_DIRTY`, and they skip recomputation if their sources have not actually changed.
</flag_semantics>