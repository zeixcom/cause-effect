<overview>
Counterintuitive behaviors in @zeix/cause-effect that commonly cause bugs or confusion.
This is the shared base reference for both consumer and developer contexts.
For library development, see cause-effect-dev/references/ for additional internal
implementation details.
</overview>

<bykey_set_does_not_propagate_to_structural_subscribers>
**`byKey(key).set(value)` does not propagate to effects that subscribed via `list.keys()`,
`list.length`, or the iterator.** Those effects subscribe to the list's structural node but
do not establish item-level edges, so a direct item signal mutation reaches them only if
`list.get()` has previously been called to link the item signal to the list node.

Use `list.replace(key, value)` for imperative item updates. It propagates through both paths
— item-level edges and the structural node — regardless of how subscribers are attached.

```typescript
// Wrong — silently does nothing for effects that subscribed via list.keys()
list.byKey(key)?.set(newValue)

// Correct — guaranteed propagation to all subscribers
list.replace(key, newValue)
```

`byKey(key).set(value)` is safe only when the consuming effect directly calls
`byKey(key).get()` inside its body — that creates a direct edge from the item signal to the
effect, bypassing the list node entirely.

**Internal note:** `byKey(key).set(value)` does not propagate through `listNode.sinks`
unless `itemSignal -> listNode` edges exist. Those edges are established only when
`recomputeMemo(listNode)` runs — which requires `list.get()` to have been called.
</bykey_set_does_not_propagate_to_structural_subscribers>

<conditional_reads_delay_watched>
**Conditional signal reads delay `watched` activation.** The `watched` callback on a State
or Sensor fires when the first downstream effect subscribes. If a signal is only read inside
a branch that hasn't executed yet, `watched` does not fire until that branch runs.

Read all signals you care about eagerly — before any conditional logic — to ensure `watched`
fires on the first effect run:

```typescript
// Bad — `derived` is only read after `task` resolves to `ok`
// `derived.watched` does not fire until the task has a value
createEffect(() => {
  match(task, {
    ok: result => render(derived.get(), result),
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

This also applies to plain `if` / ternary / `&&` patterns — any signal read gated behind a
condition may not establish its dependency edge until the condition is true.
</conditional_reads_delay_watched>

<equals_suppresses_subtrees>
**`equals` suppresses entire downstream subgraphs, not just the node it is set on.** When a
Memo or State recomputes to a value considered equal to the previous one, all downstream
nodes receive `FLAG_CHECK` instead of `FLAG_DIRTY`. Those nodes skip recomputation entirely
without running their callbacks.

This is a powerful optimization, but it has a non-obvious consequence: a custom `equals` on
an intermediate Memo can silently prevent large parts of the graph from updating, even if
upstream sources changed.

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

When debugging "why did my effect not re-run", check for custom `equals` on intermediate
memos in the dependency chain.

**Internal note:** When a new value is `equals` to the previous, downstream nodes skip
recomputation entirely without running their callbacks.
</equals_suppresses_subtrees>

<watched_stable_through_mutations>
**`watched` stays active through structural mutations.** The `watched` callback on a List or
Collection source is called once when the first downstream effect subscribes, and `unwatched`
is called when the last downstream effect unsubscribes. Structural mutations (adding items,
removing items, updating values) do not call `unwatched` then `watched` again — the callback
remains active for the lifetime of the subscription.

```typescript
const list = createList(
  () => startPolling(),   // watched:   called once when first effect subscribes
  () => stopPolling(),    // unwatched: called once when last effect unsubscribes
)

// These mutations do NOT restart the watched/unwatched cycle.
// The data source stays open as long as at least one effect is subscribed.
list.push({ id: '1', name: 'Item 1' })  // watched is NOT called again
list.delete('1')                         // watched is NOT called again
```
</watched_stable_through_mutations>

<task_abort_on_dependency_change>
**A Task's `AbortSignal` is aborted when dependencies change before the async operation
completes.** If a Task's sources update while the previous `Promise` is still pending, a new
run is scheduled and the previous `AbortController` is aborted. Not forwarding the signal to
cancellable async operations will cause stale results to overwrite fresh ones.

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
**Reading a Sensor or Task before it has produced a value throws `UnsetSignalValueError`.**
Unlike State, these signals have no initial value — they are explicitly "unset" until the
first value arrives.

Guard against this with `match`, which provides a `nil` branch for the unset case:

```typescript
const tick = createSensor<number>(set => {
  const id = setInterval(() => set(Date.now()), 1000)
  return () => clearInterval(id)
})

// Wrong — throws UnsetSignalValueError on first run, before the interval fires
createEffect(() => {
  console.log(tick.get())
})

// Correct — match handles the nil (unset) case explicitly
createEffect(() => {
  match(tick, {
    ok:  timestamp => console.log('tick:', timestamp),
    nil: () => console.log('waiting for first tick…'),
  })
})
```
</sensor_unset_before_first_value>

<scope_cleanup_is_synchronous>
**Scope and Effect cleanup runs synchronously when the returned `Cleanup` function is
called.** It does not wait for the current flush to complete. Calling cleanup during a flush
(e.g. inside a batch callback) is safe but will immediately dispose the owner and all its
children.
</scope_cleanup_is_synchronous>

<async_requires_async_syntax>
**Async routing in `createSignal`/`createComputed` requires the `async`/`await` keyword.**
The library detects async callbacks by their function prototype
(`Object.getPrototypeOf(fn) === async-function prototype`), not by their return value, because
the routing decision is made before the callback ever runs. A *synchronous* function that
happens to return a `Promise` is classified as a `Memo`, not a `Task`.

This used to fail silently (the memo cached the raw `Promise` object). It now throws
`PromiseValueError` the first time the misclassified Memo is read, since `recomputeMemo()`
checks the computed value against `instanceof Promise`:

```typescript
// WRONG — sync function returning a Promise becomes a Memo<number>.
// Throws PromiseValueError on first .get().
const data = createComputed((): Promise<number> => fetch('/api').then(r => r.json()))

// Correct — async keyword makes isAsyncFunction return true, routing to createTask.
const data = createComputed(async (): Promise<number> => {
  const r = await fetch('/api')
  return r.json()
})
```

If you must wrap a Promise-returning API, always use the `async` keyword so the library
routes it to `createTask` (with abort/pending support) rather than `createMemo`.
</async_requires_async_syntax>

<flush_has_no_loop_guard>
**`flush()` has no infinite-loop guard.** An effect that writes to a state it also reads
will re-trigger itself on every run, looping until the call stack or heap is exhausted.
This is standard behavior for fine-grained reactive systems and is intentional — the
overhead of a per-flush iteration cap is not worth it for correct graphs.

```typescript
// BUG — infinite loop: effect reads and writes the same state
const count = createState(0)
createEffect(() => {
  count.set(count.get() + 1) // re-triggers itself forever
})
```

Avoid writing to a signal that the same effect reads. If you need derived state, use a
`createMemo` instead.
</flush_has_no_loop_guard>
