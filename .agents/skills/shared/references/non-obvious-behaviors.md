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
const results = createTask(async (prev, abortSignal) => {
  return fetch(`/api/search?q=${query.get()}`, { signal }).then(r => r.json())
})
```
</task_abort_on_dependency_change>

<sensor_unset_before_first_value>
**Reading an external-push signal or an async derivation before it has produced a value
throws `UnsetSignalValueError`.** Unlike a created signal, these have no initial value — they
are explicitly "unset" until the first value arrives.

Guard against this with `match`, which provides a `nil` branch for the unset case:

```typescript
const tick = createSensor<number>({
  watched: emit => {
    const id = setInterval(() => emit(Date.now()), 1000)
    return () => clearInterval(id)
  },
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
**Async routing in `deriveSignal` requires the `async`/`await` keyword.**
The library detects async callbacks by their function prototype
(`Object.getPrototypeOf(fn) === async-function prototype`), not by their return value, because
the routing decision is made before the callback ever runs. A *synchronous* function that
happens to return a `Promise` is classified as a sync derivation, not an async one.

This used to fail silently (the memo cached the raw `Promise` object). It now throws
`PromiseValueError` the first time the misclassified memo is read, since `recomputeMemo()`
checks the computed value against `instanceof Promise`:

```typescript
// WRONG — sync function returning a Promise becomes a sync derivation.
// Throws PromiseValueError on first .get().
const data = deriveSignal((): Promise<number> => fetch('/api').then(r => r.json()))

// Correct — async keyword makes isAsyncFunction return true, routing to createTask.
const data = deriveSignal(async (): Promise<number> => {
  const r = await fetch('/api')
  return r.json()
})
```

If you must wrap a Promise-returning API, always use the `async` keyword so the library
routes it to the async path (with abort/pending support) rather than the sync one.
</async_requires_async_syntax>

<self_writing_effects_converge_or_throw>
**An effect that writes a signal it also depends on re-runs until the graph settles — and
throws `EffectConvergenceError` if it never does.** Converging self-writes (clamping,
normalization, write-once initialization) are safe: the effect's last run always observes
the final signal value.

```typescript
// Safe — converges: the effect re-runs and observes the clamped value
const count = createState(0)
createEffect(() => {
  const v = count.get()
  render(v)                     // last render always shows the settled value
  if (v > 10) count.set(10)
})

// Error — never settles: throws EffectConvergenceError after 1000 flush passes
createEffect(() => {
  count.set(count.get() + 1)    // unconditional self-increment
})
```

The bound also catches cycles *between* effects (A writes a state read by B, B writes a
state read by A). The error surfaces synchronously from the `set()`/`batch()`/
`createEffect()` call that triggered the runaway; other queued effects still run first.

Self-writes remain an anti-pattern for expressing derived values — prefer `createMemo`.
Reserve them for genuine feedback like clamping user input to a valid range.

**Writing a tracked dependency and then reverting it within the same run still throws** —
the graph compares each write to the value at that instant, not the net effect across
the whole run. Two writes that cancel out (`state.set(y); state.set(x)`, or `list.remove(k);
list.add(k)` restoring the same content) are indistinguishable from a genuine unconditional
mutation, because the first write is a real transition when it happens; the graph has no way
to know a later write in the same run will undo it. This applies identically to every mutable
signal type, including `List.add()`/`.remove()`.

```typescript
// Throws EffectConvergenceError — each write is a real change at the moment it runs,
// even though the net value at the end of the run is unchanged
const forecast = createList([{ day: 'mon', high: 20 }], { keyConfig: 'day' })
createEffect(() => {
  for (const k of Array.from(forecast.keys())) forecast.remove(k)  // real change: item → empty
  forecast.add({ day: 'mon', high: 20 })                           // real change: empty → item
})

// Converges — set() diffs the full desired content against the previous committed
// value in one step, with no intermediate empty state to trip the self-write check
createEffect(() => {
  forecast.set([{ day: 'mon', high: 20 }])
})
```

Use `List.set()`/`.update()` (or the equivalent whole-value replace on `Store`) to rebuild
collection contents inside a reactive handler, rather than a manual remove-then-add loop.
</self_writing_effects_converge_or_throw>

<match_sync_handlers_are_tracked>
**`match()`'s synchronous handler bodies run in the caller's tracking scope.** `ok`, `err`,
`nil`, and `stale` are invoked directly inside whatever scope called `match()` — normally an
effect body. Any signal read performed inside a handler becomes a tracked dependency of that
effect, exactly as if the read happened outside `match()`.

This includes reads with no `.get()` in sight: `List`/`Collection` accessor methods
(`.keys()`, `.at()`, `.byKey()`, `.length`, iteration) all call `subscribe()` internally, so
using them inside a handler links the collection into the effect's dependencies even though
no `.get()` was written.

```typescript
createEffect(() => match(task, {
  ok: data => {
    // forecast becomes a tracked dependency of this effect — no .get() call needed
    for (const k of Array.from(forecast.keys())) forecast.remove(k)
    forecast.add(data)
  }
}))
```
</match_sync_handlers_are_tracked>

<store_proxy_rejects_direct_writes>
**Direct property assignment, deletion, or `Object.defineProperty` on a `Store` proxy throws
`InvalidStoreMutationError`.** The proxy has no public write path — use the reactive API
instead. This prevents silent state divergence: without the guard, `store.name = 'Bob'` writes
a raw value onto the proxy target, shadowing the child `State` signal so that `store.name`
returns the raw string while `store.get()` returns the reactive value.

```typescript
const store = createStore({ name: 'Alice' })

// ❌ Throws InvalidStoreMutationError — would silently corrupt the store
store.name = 'Bob'
delete store.name
Object.defineProperty(store, 'x', { value: 1 })
Object.assign(store, { name: 'Bob' })

// ✅ Correct reactive mutation paths
store.name.set('Bob')       // single property
store.set({ name: 'Bob' })  // whole-value replacement with diffing
store.add('email', 'a@b.c') // new key
store.remove('name')        // delete a key
```
</store_proxy_rejects_direct_writes>

<store_method_names_shadow_data_keys>
**A data key named like a base method (`get`, `set`, `keys`, `update`, `add`, `remove`,
`byKey`) shadows the method via proxy access.** The `get` trap checks `prop in target`
first, so it returns the base method, not the child signal. Use `store.byKey(key)` to reach
such a property — `byKey` reads directly from the internal signals map.

```typescript
type T = { get: string }
const store = createStore<T>({ get: 'value' })

store.get   // () => T  — the method, NOT the child signal
store.byKey('get')  // MutableSignal<string> — the child signal via the escape hatch
```

This is inherent to the proxy design and is not considered a bug: base methods are a small
fixed set, and `byKey` provides a reliable workaround.
</store_method_names_shadow_data_keys>
