# Guide for Framework Developers

If you've used React, Vue, or Angular, you already understand the core idea behind Cause & Effect: state changes should automatically propagate to derived values and side effects. This guide maps what you know to how this library works, explains where the mental model diverges, and introduces capabilities that go beyond what most reactive libraries provide.

## The Familiar Core

The three building blocks map directly to what you already use:

| Concept | React | Vue | Angular | Cause & Effect |
|---------|-------|-----|---------|----------------|
| Mutable state | `useState` | `ref()` | `signal()` | `createState()` |
| Derived value | `useMemo` | `computed()` | `computed()` | `createMemo()` |
| Side effect | `useEffect` | `watchEffect()` | `effect()` | `createEffect()` |

Here is how they work together:

```ts
import { createState, createMemo, createEffect } from '@zeix/cause-effect'

const count = createState(0)
const doubled = createMemo(() => count.get() * 2)

createEffect(() => {
  console.log(`${count.get()} doubled is ${doubled.get()}`)
})

count.set(5) // logs: "5 doubled is 10"
```

If you've written a `computed` in Vue or a `useMemo` in React, this should feel immediately familiar. The difference is that there is no component, no template, no JSX — just reactive primitives composing directly.

## Coming from State Management Libraries

If you work in a React codebase, you likely use one or more of these libraries alongside the framework. This section maps their concepts to Cause & Effect equivalents. All four share one gap, so read the next part first.

### The async state machine they all make you write

Every library below asks you to coordinate three fields by hand: the data, a status, and an error. None of them cancel an in-flight request when its input changes. Zustand shows the shape most plainly, but Redux `extraReducers` and a Jotai async atom have the same structure:

```ts
// Typical: you write the state machine and manage race conditions manually
create(set => ({
  data: null, status: 'idle', error: null,
  fetch: async (id) => {
    set({ status: 'loading' })  // must NOT clear data here — stale case
    try {
      set({ data: await fetchUser(id), status: 'idle' })
    } catch (e) {
      set({ status: 'error', error: e })
    }
  }
}))
```

`createTask()` and `match()` replace all of it:

```ts
const userId = createState(1)
const user = createTask(async (prev, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  return res.json()
})

createEffect(() => match(user, {
  nil:   () => showSpinner(),      // no value yet
  stale: () => dimContent(),       // re-fetching, previous value retained
  ok:    data => renderUser(data), // data is User, never undefined
  err:   e => showError(e),
}))
```

Three things disappear:

- **The trigger.** `userId` is a dependency, so changing it re-runs the Task. You never call the fetch by hand.
- **The race.** A dependency change aborts the in-flight request through `abort`. The slower response cannot win.
- **The coordination.** `stale` fires during a re-fetch with the previous value retained, so data and status never disagree.

The sections below cover only what is specific to each library.

---

### Redux Toolkit

| Redux Toolkit | Cause & Effect |
|---|---|
| State field in `createSlice` | `createState()` |
| `createSelector` (Reselect) | `createMemo()` |
| `createAsyncThunk` | `createTask()` |
| `createEntityAdapter` | `createList()` |
| `pending` / `fulfilled` / `rejected` | `nil` / `ok` / `err` in `match()` |

**Derived state.** Reselect's `createSelector` requires explicit input selectors to memoize derived values. `createMemo()` tracks dependencies by reading — any signal accessed inside the memo is a dependency. When the memo recomputes to the same value, propagation stops, without any selector discipline:

```ts
// Redux Toolkit: explicit input selectors
const selectFiltered = createSelector(
  state => state.items,
  state => state.filter,
  (items, filter) => items.filter(i => i.type === filter)
)
```

```ts
// Cause & Effect: dependencies are tracked by reading
const filtered = createMemo(() =>
  items.get().filter(i => i.type === filter.get())
)
```

**Collections.** `createEntityAdapter` normalizes items into `{ ids, entities }` with CRUD helpers. Every selector over `selectAll` returns a new array reference when any entity changes, re-rendering every component that reads it. `createList()` gives each item its own signal, and stable keys survive sorting:

```ts
const todos = createList(initialTodos, { keyConfig: t => t.id })
todos.replace('t1', { ...todo, done: true }) // only effects reading 't1' re-run
todos.sort((a, b) => a.text.localeCompare(b.text)) // 't1' still points to the same signal
```

---

### Zustand

| Zustand | Cause & Effect |
|---|---|
| `create(set => ({ ... }))` | `createState()` / `createStore()` |
| Async function calling `set()` | `createTask()` |
| Manual `loading` / `error` flags | `match(nil/err/stale/ok)` |
| `subscribeWithSelector` | `createMemo()` |

Zustand has no async primitive at all. The state machine above is exactly what you write in the store, for every async call, with no `AbortSignal` anywhere. Most Zustand users add TanStack Query for server state precisely to avoid it. `createTask()` covers all async, not only HTTP.

---

### Jotai

Jotai's mental model is closest to Cause & Effect: atoms are independent, composable reactive cells that auto-track dependencies. The gaps are async cancellation, the stale state, and collection structural integrity.

| Jotai | Cause & Effect |
|---|---|
| `atom(value)` | `createState()` |
| `atom(get => ...)` | `createMemo()` |
| `atom(async (get) => ...)` | `createTask()` |
| `atomFamily(key)` | `list.byKey(key)` |
| Keys atom + `atomFamily` | `createList()` |
| `loadable(atom)` | `match(nil/err/ok)` |

**Async.** Jotai async atoms have no `AbortSignal`. A dependency change abandons the previous promise rather than cancelling it, so responses can arrive out of order. The `loadable` utility gives explicit pending, error, and data states, but has no stale case — a re-fetch returns to `'loading'` and clears the data.

**Collections.** `atomFamily` creates a stable atom per key, equivalent to `list.byKey(key)`. There is no structural atom, so adding or removing keys means coordinating two writes yourself:

```ts
// Jotai: two atoms to keep consistent manually
const keysAtom = atom<string[]>([])
const itemFamily = atomFamily((id: string) => atom<Item | null>(null))

store.set(keysAtom, [...store.get(keysAtom), newId])
store.set(itemFamily(newId), newItem)  // forget one → structural inconsistency
```

```ts
// Cause & Effect: one operation, invariant maintained
const items = createList(initialItems, { keyConfig: i => i.id })
items.add(newItem)  // keys and item signal created atomically
```

---

### TanStack Query

TanStack Query is a server-state cache, not a general state manager. It handles HTTP caching, request deduplication, background refetch, and cache invalidation — patterns outside Cause & Effect's scope. Its query states map directly to `match()` handlers:

| TanStack Query | `match()` handler |
|---|---|
| `isPending` — first fetch, no data | `nil` |
| `isFetching` with `data` retained | `stale` |
| `isError` | `err` |
| `data` resolved | `ok` |

Types are the other difference. `data` is `User | undefined` in every branch, so the render needs an assertion:

```ts
const { data, isPending, isFetching, isError, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),
})
if (isPending) return <Spinner />
if (isError) return <Error error={error} />
return <Profile user={data!} />  // ! required — TypeScript cannot narrow further
```

Inside `match()`'s `ok` handler the value is `User`, and no assertion is needed.

**Where TanStack Query still wins.** For HTTP server state specifically — caching identical requests across components, background refetch intervals, tag-based cache invalidation, optimistic mutations, paginated and infinite queries — TanStack Query remains the better tool. The two compose well: feed query results into a `createState()` or `createSensor()`, and let Cause & Effect handle derived computation on top.

**Where `createTask()` fills the gap.** TanStack Query is designed for fetch-based server state. For client-side async — IndexedDB reads, WebWorker results, WebSocket-derived values, or any async derivation that depends on other signals — `createTask()` provides the same `AbortSignal`, stale state, and type-safe routing, for any async operation in the graph.

## What Works Differently

### Dependencies are tracked, not declared

In React, you declare dependencies manually:

```ts
// React
useEffect(() => {
  console.log(count)
}, [count]) // ← you must list dependencies
```

In Cause & Effect, calling `.get()` *is* the dependency declaration. If you read a signal inside an effect or memo, it becomes a dependency automatically. If you don't read it, it doesn't.

```ts
// Cause & Effect
createEffect(() => {
  console.log(count.get()) // ← this IS the dependency
})
```

There are no dependency arrays to maintain, no lint rules to enforce them, and no stale closure bugs from forgetting a dependency. Vue and Angular developers will find this familiar — it works like `watchEffect()` and Angular's `effect()`.

One consequence of tracking-by-reading: a signal read inside a branch that hasn't executed yet — an unresolved `match()` case, an `if`, a ternary — isn't a dependency yet either. Read the signals you care about unconditionally, before branching, so they're tracked on the first run regardless of which branch executes. See [Lazy resources with watched callbacks](RECIPES.md#5-lazy-resources-with-watched-callbacks) for the implications.

### Effects run synchronously

In React, effects run after the browser paints. In Vue, reactive updates are batched until the next microtask. In Cause & Effect, effects run synchronously right after a state change:

```ts
const name = createState('Alice')

createEffect(() => {
  console.log(name.get()) // runs immediately with "Alice"
})

name.set('Bob') // runs the effect again, right here, synchronously
```

When you need to update multiple signals without triggering intermediate effects, wrap updates in `batch()`:

```ts
import { batch } from '@zeix/cause-effect'

batch(() => {
  firstName.set('Bob')
  lastName.set('Smith')
}) // effect runs once, after both updates
```

React catches an effect that triggers its own re-render and throws "Too many re-renders." Cause & Effect converges instead. `flush()` drains queued effects in passes, so an effect that writes to a signal it also reads re-runs until the value settles. A clamp or a write-once initialiser works as intended, and always observes the final value.

An effect that never settles is caught too. After 1000 passes the graph gives up and throws `EffectConvergenceError` at the triggering `set()`:

```ts
// Throws EffectConvergenceError — count never stops changing
createEffect(() => {
  count.set(count.get() + 1)
})
```

If you need a value derived from itself (a running total, a counter), compute it with `createMemo()` instead of writing back into the signal an effect reads.

### Non-nullable signals

All signals enforce `T extends {}` — `null` and `undefined` are excluded at the type level. This means you can trust that `.get()` always returns a real value without null checks.

```ts
const count = createState(0)
count.get() // type is number, guaranteed non-null

// This won't compile:
// const maybeUser = createState<User | null>(null)
```

This is a deliberate design decision. In frameworks, nullable state leads to defensive checks scattered across templates and hooks. Here, the type system prevents it.

`createSensor()` and `createTask()` are the one exception: unlike `createState()`, they have no synthetic initial value, because there genuinely isn't one yet — no mouse position before the first `mousemove`, no response before the fetch resolves. Calling `.get()` before that first value arrives throws `UnsetSignalValueError` rather than returning `null`. `match()` is the idiomatic way to handle this — it routes to a `nil` branch instead of you writing `try`/`catch` around every read:

```ts
createEffect(() => {
  match(task, {
    ok:  data => render(data),
    nil: () => showSpinner(), // no value yet — not an error
  })
})
```

**What to do instead:**

- For async results: use `createTask()` — a Task without reactive dependencies works like a Promise that resolves into the graph. Use `match()` to handle the pending state.
- For external input that starts undefined: use `createSensor()` with its lazy start callback, and `match()` to handle the unset state — or pass an initial `value` in its options if a sensible default exists.
- For optional state: use a discriminated union, an empty string, an empty array, `0`, or `false` — whatever the zero value for your type is:

```ts
type AuthState = { status: 'anonymous' } | { status: 'authenticated', user: User }
const auth = createState<AuthState>({ status: 'anonymous' })
```

### Scopes replace the component tree

In React, Vue, and Angular, reactivity is tied to components. Effects clean up when components unmount. Components form a tree that manages lifetimes.

Cause & Effect has no components — but it has `createScope()`, which serves the same structural purpose. A scope captures child effects, manages their cleanup, and can be nested inside other scopes or effects:

```ts
import { createState, createEffect, createScope } from '@zeix/cause-effect'

const dispose = createScope(() => {
  const count = createState(0)

  createEffect(() => {
    console.log(count.get())
  })

  return () => console.log('scope disposed')
})

// Later: dispose everything created inside
dispose()
```

Think of scopes as **components without rendering**. They are the building block for breaking the signal graph into smaller, manageable pieces — often driven by what needs to be looped or dynamically created. A UI framework built on this library would typically create a scope per component.

**Automatic vs. manual cleanup:**

- Inside a scope or parent effect, child effects are disposed automatically when the parent is disposed.
- Outside any owner, you must call the cleanup function returned by `createEffect()` yourself.

```ts
// Automatic: effect is disposed when the scope is disposed
const dispose = createScope(() => {
  createEffect(() => console.log(count.get()))
})
dispose() // cleans up the effect

// Manual: no parent scope, you manage the lifetime
const cleanup = createEffect(() => console.log(count.get()))
cleanup() // you must call this yourself
```

Unlike React's unmount (scheduled by the framework) or Vue's `onUnmounted` (deferred to teardown phase), calling `dispose()` or `cleanup()` here runs synchronously, the instant you call it — including from inside a `batch()` callback, where it tears the scope down immediately rather than waiting for the batch to finish.

### Explicit equality, not reference identity

By default, signals use `===` for equality. But unlike frameworks where this is buried in internals, you can override it per signal:

```ts
const point = createState({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y
})

point.set({ x: 0, y: 0 }) // no update — values are equal
```

`equals` doesn't just gate this one signal — when a value is considered equal, propagation stops for its entire downstream subtree. Nothing further down recomputes or re-runs, even if it would have produced a different result. A memo that recomputes to a new object on every run would normally propagate every time (a fresh object is never `===` the old one) — `DEEP_EQUALITY` changes that, comparing by structure instead of reference:

```ts
import { createState, createMemo, createEffect, DEEP_EQUALITY } from '@zeix/cause-effect'

const source = createState({ x: 1, y: 2, z: 3 })
const point = createMemo(
  () => ({ x: source.get().x, y: source.get().y }),
  { equals: DEEP_EQUALITY } // structural, not reference, comparison
)

// Does NOT re-run when z changes — point is structurally the same
// object even though source changed and point recomputed
createEffect(() => console.log('point is', point.get()))
source.set({ x: 1, y: 2, z: 999 })
```

## Beyond the Basics

The primitives above cover what most reactive libraries provide. The following signal types address patterns that frameworks handle with ad-hoc solutions or external libraries.

### Task: async derivations with cancellation

In React, async data fetching needs `useEffect` plus cleanup plus state management, or a dedicated library. In Angular, you reach for RxJS and `switchMap`. In Cause & Effect, `createTask()` is a signal that happens to be async. [The async state machine](#the-async-state-machine-they-all-make-you-write) above shows the full pattern.

`switchMap` is the closest analogue: both cancel the previous in-flight operation when a new input arrives. The difference is that a Task is a value you read, not a stream you subscribe to. Nothing downstream needs to know it was ever asynchronous.

### Store: per-property reactivity

In React, updating one property of an object re-renders everything that reads the object. In Vue, `reactive()` gives you per-property tracking — `createStore()` works the same way:

```ts
import { createStore, createEffect } from '@zeix/cause-effect'

const user = createStore({ name: 'Alice', age: 30, email: 'alice@example.com' })

// This effect only re-runs when name changes
createEffect(() => {
  console.log(user.name.get())
})

user.age.set(31)  // does NOT trigger the effect above
user.name.set('Bob') // triggers it
```

Each property becomes its own signal. Nested objects become nested stores. This is more granular than `createState({ ... })`, which would treat the whole object as a single value.

> **Naming ahead of 2.0:** the mutable store type is also exported as `MutableStore` — the name it keeps in 2.0, where `Store` becomes the readonly base (today's `DerivedStore`). `isMutableStore()` is the matching guard; unlike the tag-based `isStore()`, it rejects a derived store. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

### List: reactive arrays with stable keys

Frameworks use `key` props (React), `:key` bindings (Vue), or `track` expressions (Angular) to maintain item identity during re-renders. In Cause & Effect, `createList()` bakes stable keys into the data structure itself:

```ts
import { createList, createEffect } from '@zeix/cause-effect'

const todos = createList([
  { id: 't1', text: 'Learn signals', done: false },
  { id: 't2', text: 'Build app', done: false }
], { keyConfig: todo => todo.id })

todos.sort((a, b) => a.text.localeCompare(b.text))
// 'Learn signals' is still at key 't1', regardless of position

// Update a single item without replacing the array
todos.replace('t1', { id: 't1', text: 'Learn signals', done: true })
```

Each item is its own signal. Sorting reorders keys without destroying signals or their downstream dependencies. Adding and removing items is granular — unaffected items and their effects don't re-run.

Write through `.replace()` rather than `byKey().set()` — see [List](README.md#list) for why.

> **Naming ahead of 2.0:** the mutable list type is also exported as `MutableList` — the name it keeps in 2.0, where `List` becomes the readonly base (today's `Collection`). `isMutableList()` is the matching guard. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

### Collection: derived arrays with item-level memoization

A Collection is a set of keyed items with per-item memoization, so a change to one item does not invalidate the others.

Frameworks solve this with memoized child components — `React.memo` plus a stable `key`, or Vue's per-child reactivity. Those work at the render layer. `.deriveCollection()` works at the data layer, so the memoization holds regardless of what renders it:

```ts
const display = todos.deriveCollection(todo => ({
  label: todo.done ? `[x] ${todo.text}` : `[ ] ${todo.text}`
}))
```

When one item changes, only its derived signal recomputes. Structural changes are tracked separately from value changes, so adding an item does not re-derive the rest.

A Collection can also be externally-driven: `createCollection()` takes a start callback and applies incoming data as granular add, change, and remove operations rather than replacing the array. See the [Collection API](README.md#collection) for both forms, async mapping, and chaining.

> **Naming ahead of 2.0:** `.deriveCollection()` and `createCollection()` are deprecated as of 1.5.0 — use the top-level `deriveList(source, itemFn)` and `deriveList(seed, { watched, … })` instead. `Collection` itself is deprecated in favor of `DerivedList`, the type `deriveList()` returns. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

### Sensor: lazy external input

Frameworks typically manage event listeners inside component lifecycle hooks (`useEffect`, `onMounted`, `ngOnInit`). In Cause & Effect, `createSensor()` encapsulates external input with automatic resource management:

```ts
import { createSensor, createEffect } from '@zeix/cause-effect'

const windowSize = createSensor((set) => {
  const update = () => set({ w: innerWidth, h: innerHeight })
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
})
```

The start callback runs lazily — only when an effect first reads the sensor. When no effects are watching, the cleanup runs automatically. When an effect reads it again, the start callback runs again. No manual setup/teardown.

### Slot: stable property delegation

A Slot is a forwarding layer to a swappable backing signal, and it holds no value of its own. It has no `update()` method, and `isMutableSignal()` excludes it.

If you are building a component system, you often need to expose signals as object properties via `Object.defineProperty()`. The challenge arises when a property must switch its backing signal without breaking existing sinks. A property may switch from a local writable `State` to a parent-controlled read-only `Memo`.

`createSlot()` solves this. It provides a stable reactive source that delegates to a swappable backing signal. The slot object itself is a valid property descriptor:

```ts
import { createState, createMemo, createSlot, createEffect } from '@zeix/cause-effect'

const local = createState('default')
const slot = createSlot(local)
Object.defineProperty(element, 'label', slot)

createEffect(() => console.log(element.label)) // logs: "default"

// Parent provides a derived value — swap without breaking the effect
const parentLabel = createMemo(() => `Parent: ${parentState.get()}`)
slot.replace(parentLabel) // effect re-runs with new value
```

Writes forward to the current backing signal when it is writable. See [Slot](README.md#slot) for the read-only case and for `current()`.

## Utilities for Generic Code

Framework code rarely needs these. They matter when you write a layer that accepts state from a caller and cannot know in advance which signal type it will receive — a component factory, a binding helper, or an adapter. React's equivalent problem is a hook that must accept "a value or a state setter"; here the polymorphic factories resolve it at the type level.

**`createSignal(value)`** converts any value to its corresponding signal type:

```ts
import { createSignal } from '@zeix/cause-effect'

createSignal(0)                          // → State<number>
createSignal([1, 2, 3])                  // → MutableList<number>
createSignal({ x: 0 })                   // → MutableStore<{ x: number }>
createSignal(() => x.get() * 2)          // → Memo<number>
createSignal(async (_, s) =>
  fetch('/api', { signal: s }).then(r => r.json()))  // → Task<Response>
```

A value that is already a signal is returned unchanged, which makes the function safe to call on caller-supplied input.

> **Naming ahead of 2.0:** this shape sniffing is removed with no replacement export. Single values construct through `createCell` (an alias of `createState`), arrays through `createList`, records through `createStore`. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

**`createMutableSignal(value)`** is the same, restricted to `State`, `MutableStore`, and `MutableList`. It throws `InvalidSignalValueError` for a function or a read-only signal. Deprecated in favor of `createCell`/`createList`/`createStore`, picked by argument shape.

**`deriveCell(callback, options?)`** creates a `Memo` or a `Task`, by detecting whether the callback is async (`createComputed`, the original name, is deprecated):

```ts
const doubled = deriveCell(() => count.get() * 2)
const data    = deriveCell(async (_, signal) =>
  fetch(url.get(), { signal }).then(r => r.json()))
```

The split is decided from the callback itself, before it runs. A callback that omits `async` but returns a `Promise` becomes a `Memo`, and throws `PromiseValueError` on first read rather than caching the `Promise` as its value.

**Type predicates**

| Predicate | True for |
|---|---|
| `isSignal(value)` | Any signal (all 9 types) |
| `isMutableSignal(value)` | `State`, `MutableStore`, `MutableList` — signals with `.set()` and `.update()` |
| `isComputed(value)` | `Memo`, `Task` — derived signals |

`MutableSignal<T>` is the TypeScript type matching `isMutableSignal`. Use it as a parameter type in generic code that accepts any writable signal.

## Choosing the Right Signal

```
Does the data come from *outside* the reactive system?
│
├─ Yes, single value → `createSensor(set => { ... })`
│   (mouse position, window resize, media queries, DOM observers, etc.)
│   Tip: Use `{ equals: SKIP_EQUALITY }` for mutable object observation
│
├─ Yes, keyed collection → `createCollection(applyChanges => { ... })`
│   (WebSocket streams, Server-Sent Events, external data feeds, etc.)
│
└─ No, managed internally? What kind of data is it?
    │
    ├─ *Primitive* (number/string/boolean)
    │   │
    │   ├─ Do you want to mutate it directly?
    │   │     └─ Yes → `createState()`
    │   │
    │   └─ Is it derived from other signals?
    │         │
    │         ├─ Sync derived
    │         │     ├─ Simple/cheap → plain function (preferred)
    │         │     └─ Expensive/shared/stateful → `createMemo()`
    │         │
    │         └─ Async derived → `createTask()`
    │            (cancellation + memoization + pending/error state)
    │
    ├─ *Plain Object*
    │   │
    │   ├─ Do you want to mutate individual properties?
    │   │     ├─ Yes → `createStore()`
    │   │     └─ No, whole object mutations only → `createState()`
    │   │
    │   └─ Is it derived from other signals?
    │         ├─ Sync derived → plain function or `createMemo()`
    │         └─ Async derived → `createTask()`
    │
    └─ *Array*
        │
        ├─ Do you need to mutate it (add/remove/sort) with stable item identity?
        │     ├─ Yes → `createList()`
        │     └─ No, whole array mutations only → `createState()`
        │
        └─ Is it derived / read-only transformation of a `List` or `Collection`?
              └─ Yes → `.deriveCollection()`
                 (memoized + supports async mapping + chaining)

Do you need a *stable property position* that can swap its backing signal?
└─ Yes → `createSlot(existingSignal)`
   (integration layers, custom elements, property descriptors)
```
