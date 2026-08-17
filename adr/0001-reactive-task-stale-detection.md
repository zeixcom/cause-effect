# ADR 0001: Reactive Task Stale Detection via Pending Node

## Status

✅ Accepted

Amended by [ADR-0018](0018-shape-indexed-signal-types.md) (2026-08-17).

## Context

When a Task source changes, the previous design caused effects to miss the pending state transition. The propagation mechanism sent only `FLAG_CHECK` to downstream effects, and `refresh(effectNode)` called `recomputeTask()` synchronously without triggering a value change. Effects saw no `FLAG_DIRTY` flag and silently became `FLAG_CLEAN` without running — the `stale` handler never fired.

The previous rationale ("effect already re-runs at both transition points") was incorrect. This was a critical bug in the reactivity system where stale state was not being properly detected and handled.

## Decision

Implement `isPending()` backed by an internal `pendingNode: StateNode<boolean>` in `TaskNode`. 

- The `pendingNode` is set to `true` inside `recomputeTask()` before starting the async function
- The promise `.then`/`.catch` handlers set it to `false` inside a `batch()` alongside any value propagation
- Subscribe via `makeSubscribe(pendingNode)` when `isPending()` is called, creating a graph edge

This makes the pending state reactive: `setState(pendingNode, true)` inside `recomputeTask` propagates `FLAG_DIRTY` to the effect mid-refresh, causing it to run and route to `stale`.

## Alternatives Considered

- **(a) Plain boolean check**: Rejected — effect does not re-run when task goes pending, only when it resolves. This was the previous design that failed.
- **(b) Dedicated flag propagated through task sinks**: Rejected — more complex implementation, less unified with the existing graph structure.

## Consequences

- ✅ Effects correctly re-run on pending state transition
- ✅ The `stale` handler fires as expected when tasks enter pending state
- ✅ Graph edge established on the first `ok` or `stale` run; no eager-read refactor needed
- ✅ The conditional read in `match()` works correctly because by the time re-fetches matter, at least one prior run through `ok` or `stale` has created the edge
- ⚠️ Adds internal node overhead per Task (one additional StateNode)

## Related

- Architecture: [Task stale detection in match()](ARCHITECTURE.md#key-decisions)
