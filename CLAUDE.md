# Claude Context for Cause & Effect

## Mental Model

Think of signals as **observable cells** in a spreadsheet:

- **State** — input cell you write to
- **Sensor** — read-only cell driven by an external source (mouse, resize, MutationObserver); activates lazily
- **Memo** — formula cell; recomputes synchronously when dependencies change
- **Task** — async formula cell; auto-cancels in-flight work when dependencies change
- **Store** — structured row where each column is its own reactive cell
- **List** — table with stable row IDs that survive sorting and reordering
- **Collection** — externally-fed table (WebSocket, SSE) or a derived table via `.deriveCollection()`
- **Slot** — a stable cell reference that delegates to a swappable backing cell
- **Effect** — a sink that runs side effects; the only node that never has downstream dependents

## Internal Node Shapes

```
StateNode<T>  — source only (State, Sensor)
MemoNode<T>   — source + sink (Memo, Slot, Store, List, Collection internals)
TaskNode<T>   — source + sink + AbortController (Task)
EffectNode    — sink + owner (Effect)
Scope         — owner only (createScope)
```

`activeOwner` tracks the current owner for cleanup registration. `activeSink` tracks the current sink for dependency tracking. These are separate: `untrack()` nulls `activeSink` (stops dependency edges), `unown()` nulls `activeOwner` (stops scope registration). You can read signals without tracking them, or create scopes without parenting them, independently.

## Non-Obvious Behaviors

**`T extends {}` excludes `null` and `undefined` at the type level.** Every signal generic uses this constraint. Signals cannot hold nullish values — use a wrapper type or a union with a sentinel if you need to represent absence.

**`byKey()`, `at()`, `keyAt()`, and `indexOfKey()` do NOT create graph edges.** They are direct lookups. An effect that only calls `collection.byKey('x')?.get()` will react to value changes of key `'x'` but will *not* re-run if that key is added or removed. To track structural changes, read `get()`, `keys()`, or `length`.

**Conditional reads delay `watched` activation.** Dependencies are tracked only for `.get()` calls that actually execute during a given effect run. If a signal read is inside a branch that doesn't execute (e.g. the `ok` arm of `match()` while a Task is still pending), no edge is created and `watched` does not fire. Read signals eagerly before conditional logic when lifecycle activation matters:

```typescript
// Good: both signals are always tracked; watched activates immediately
createEffect(() => {
  match([task, derived], {
    ok: ([result, values]) => renderList(values, result),
    nil: () => showLoading(),
  })
})

// Bad: derived is only tracked after task resolves
createEffect(() => {
  match([task], {
    ok: ([result]) => {
      const values = derived.get()
      renderList(values, result)
    },
    nil: () => showLoading(),
  })
})
```

**`equals` is respected at every level of the graph, not just at the source.** When a Memo recomputes to the same value (per its `equals` function), downstream Memos and Effects receive `FLAG_CHECK` and are cleaned without running. Effects only re-execute if at least one upstream node has actually changed value. This means a custom `equals` on an intermediate Memo can suppress entire subtrees of recomputation.

**`SKIP_EQUALITY` forces propagation on every update.** Use it with `createSensor` when observing a mutable object where the reference stays the same but internal state changes (e.g. a DOM element passed through a MutationObserver). Without it, `setState` would see `old === new` and suppress propagation entirely.

**`watched` propagates through `.deriveCollection()` chains without restarting on mutations.** When an effect reads a derived collection, the `watched` callback on the source List/Collection activates automatically — even through multiple levels of chaining. Structural mutations (add, remove, sort) on the source do *not* tear down and restart `watched`; the watcher stays active as long as any downstream effect is subscribed. Cleanup cascades upstream only when the last subscriber disposes.

**Memo and Task callbacks receive the previous value as their first argument.** This enables reducer and accumulator patterns without external state:

```typescript
const runningTotal = createMemo((prev = 0) => prev + tick.get())

const gameState = createMemo((prev = 'menu') => {
  const action = playerAction.get()
  if (prev === 'menu' && action === 'start') return 'playing'
  return prev
})
```

**`Slot` is a valid property descriptor.** The object returned by `createSlot()` has `get`, `set`, `configurable`, and `enumerable` — it can be passed directly to `Object.defineProperty()`. `slot.replace(nextSignal)` swaps the backing signal and invalidates all existing subscribers without them needing to re-subscribe.

**`unown()` is the correct fix for DOM-owned component lifecycles.** When a custom element's `connectedCallback` fires inside a re-runnable reactive effect, any `createScope` call inside it would register its `dispose` on the effect's cleanup list — causing the component's effects and listeners to be torn down the next time the parent effect re-runs. Wrapping the `connectedCallback` body in `unown(() => createScope(...))` detaches the scope from the effect's ownership entirely, leaving `disconnectedCallback` as the sole lifecycle authority.