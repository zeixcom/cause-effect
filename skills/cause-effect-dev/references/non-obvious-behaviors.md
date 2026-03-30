<overview>
Counterintuitive behaviors in @zeix/cause-effect that commonly cause bugs or confusion. Read this when debugging unexpected reactive behavior, or when writing tests that cover edge cases.
</overview>

<direct_lookups_do_not_track>
**`byKey()`, `at()`, `keyAt()`, and `indexOfKey()` do not create graph edges.** They are direct lookups into the internal map/array — calling them inside an effect or memo does not subscribe to structural changes.

To react to structural changes (key added, key removed, order changed), read a tracking accessor instead:

| You want to react to | Read this |
|---|---|
| Any structural change | `collection.get()` or `list.get()` |
| Key set membership | `collection.keys()` |
| Length / item count | `collection.length` |
| A specific item's value | `collection.get()` then access the item |

```typescript
// Wrong — effect does not re-run when keys are added or removed
createEffect(() => {
  const item = collection.byKey('id-123')
  render(item)
})

// Correct — reading keys() creates a dependency on structural changes
createEffect(() => {
  const keys = collection.keys()              // tracks structure
  const item = collection.byKey('id-123')     // safe after establishing the edge
  render(item)
})
```
</direct_lookups_do_not_track>

<bykey_set_does_not_propagate_to_structural_subscribers>
**`byKey(key).set(value)` does not propagate through `listNode.sinks` unless `itemSignal → listNode` edges exist.** Those edges are established only when `recomputeMemo(listNode)` runs — which requires `list.get()` to have been called. Effects that subscribed via `list.keys()`, `list.length`, or the iterator link to `listNode.sinks` but never trigger `recomputeMemo`, so the item-level edges are never created.

`list.replace(key, value)` is the correct API for imperative item mutations. It calls `signal.set(value)` (value path) then explicitly walks `node.sinks` (structural path), guaranteeing propagation regardless of edge state.

```typescript
// Wrong — misses structural subscribers if list.get() was never called
list.byKey(key)?.set(newValue)

// Correct — propagates through both paths unconditionally
list.replace(key, newValue)
```

`byKey(key).set(value)` is safe only when the consuming effect directly reads `byKey(key).get()` inside its body, establishing a direct `itemSignal → effectNode` edge.
</bykey_set_does_not_propagate_to_structural_subscribers>

<conditional_reads_delay_watched>
**Conditional signal reads delay `watched` activation.** The `watched` callback on a State or Sensor fires when the first downstream effect subscribes. If a signal is only read inside a branch that hasn't executed yet, `watched` does not fire until that branch runs.

Read all signals you care about eagerly — before any conditional logic — to ensure `watched` fires on the first effect run:

```typescript
// Bad — `derived` is only read after `task` resolves to `ok`
// `derived.watched` does not fire until the task has a value
createEffect(() => {
  match([task], {
    ok: ([result]) => render(derived.get(), result),
    nil: () => showSpinner(),
  })
})

// Good — both signals are read on every run, regardless of task state
// Both `watched` callbacks fire immediately when the effect is created
createEffect(() => {
  match([task, derived], {
    ok: ([result, value]) => render(value, result),
    nil: () => showSpinner(),
  })
})
```

This also applies to plain `if` / ternary / `&&` patterns — any signal read gated behind a condition may not establish its dependency edge until the condition is true.
</conditional_reads_delay_watched>

<equals_suppresses_subtrees>
**`equals` suppresses entire downstream subgraphs, not just the node it is set on.** When a Memo or State recomputes to a value that is `equals` to the previous one, all downstream nodes receive `FLAG_CHECK` instead of `FLAG_DIRTY`. Those nodes skip recomputation entirely without running their callbacks.

This is a powerful optimization, but it has a non-obvious consequence: a custom `equals` on an intermediate Memo can silently prevent large parts of the graph from updating, even if upstream sources changed.

```typescript
const source = createState({ x: 1, y: 2 })

// This memo compares by x only
const xOnly = createMemo(
  () => source.get().x,
  { equals: (a, b) => a === b }
)

// This effect depends on xOnly
// It will NOT re-run if source changes but x stays the same,
// even if y changed dramatically
createEffect(() => {
  console.log('x is', xOnly.get())
})
```

When debugging "why did my effect not re-run", check for custom `equals` on intermediate memos in the dependency chain.
</equals_suppresses_subtrees>

<watched_stable_through_mutations>
**`watched` stays active through structural mutations.** The `watched` callback on a List or Collection source is called once when the first downstream effect subscribes, and `unwatched` is called when the last downstream effect unsubscribes. Structural mutations (adding items, removing items, updating values) do not call `unwatched` and then `watched` again — the callback remains active for the lifetime of the subscription.

```typescript
const list = createList(
  () => fetchItems(),         // watched: start polling / open WebSocket
  () => stopPolling(),        // unwatched: stop polling / close WebSocket
)

// Adding or removing items from the list does NOT restart the watched/unwatched cycle.
// The data source stays open as long as at least one effect is subscribed.
list.push({ id: '1', name: 'Item 1' })   // watched callback is NOT called again
list.delete('1')                          // watched callback is NOT called again
```
</watched_stable_through_mutations>

<task_abort_on_dependency_change>
**A Task's `AbortSignal` is aborted when dependencies change before the async operation completes.** If a Task's sources update while the previous `Promise` is still pending, a new run is scheduled and the previous `AbortController` is aborted. Not forwarding the signal to cancellable async operations will cause stale results to overwrite fresh ones.

```typescript
// Wrong — fetch is not cancellable; stale response may arrive after a newer one
const results = createTask(async () => {
  return fetch(`/api/search?q=${query.get()}`).then(r => r.json())
})

// Correct — abort signal forwarded; stale requests are cancelled
const results = createTask(async (prev, signal) => {
  return fetch(`/api/search?q=${query.get()}`, { signal }).then(r => r.json())
})
```
</task_abort_on_dependency_change>

<sensor_unset_before_first_value>
**Reading a Sensor or Task before it has produced a value throws `UnsetSignalValueError`.** Unlike State, these signals have no initial value — they are explicitly "unset" until the first value arrives.

Guard against this with `match` or by checking the signal's status before reading:

```typescript
const sensor = createSensor(set => {
  const id = setInterval(() => set(Date.now()), 1000)
  return () => clearInterval(id)
})

// Wrong — throws UnsetSignalValueError on first run, before the interval fires
createEffect(() => {
  console.log(sensor.get())
})

// Correct — match handles the nil (unset) case explicitly
createEffect(() => {
  match([sensor], {
    ok: ([timestamp]) => console.log(timestamp),
    nil: () => console.log('waiting for first value…'),
  })
})
```
</sensor_unset_before_first_value>

<scope_cleanup_is_synchronous>
**Scope and Effect cleanup runs synchronously when the returned `Cleanup` function is called.** It does not wait for the current flush to complete. Calling cleanup during a flush (e.g. inside a batch callback) is safe but will immediately dispose the owner and all its children.
</scope_cleanup_is_synchronous>