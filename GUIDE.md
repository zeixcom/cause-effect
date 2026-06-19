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

If you work in a React codebase, you're likely using one or more of these libraries alongside the framework. This section maps their concepts to Cause & Effect equivalents and calls out what the library handles automatically that you would otherwise write by hand.

### Redux Toolkit

| Redux Toolkit | Cause & Effect |
|---|---|
| State field in `createSlice` | `createState()` |
| `createSelector` (Reselect) | `createMemo()` |
| `createAsyncThunk` | `createTask()` |
| `createEntityAdapter` | `createList()` |
| `pending` / `fulfilled` / `rejected` | `nil` / `ok` / `err` in `match()` |

**Async.** With `createAsyncThunk`, you handle `pending`, `fulfilled`, and `rejected` in `extraReducers` and manage loading state manually. The stale case — re-fetching while retaining previous data — is not a built-in state; you must keep `data` populated while simultaneously setting `status: 'loading'`, and coordinate those two fields correctly on every code path:

```ts
// Redux Toolkit: you manage the state machine
const slice = createSlice({
  name: 'user',
  initialState: { data: null, status: 'idle', error: null },
  extraReducers: builder => {
    builder
      .addCase(fetchUser.pending,   state => { state.status = 'loading' })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.data = action.payload; state.status = 'idle'
      })
      .addCase(fetchUser.rejected,  (state, action) => {
        state.status = 'error'; state.error = action.error.message
      })
  }
})
```

```ts
// Cause & Effect: Task manages all states; match() routes them
const userId = createState(1)
const user = createTask(async (prev, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  return res.json()
})

createEffect(() => match(user, {
  nil:   () => showSpinner(),
  stale: () => dimContent(),      // re-fetching with retained data — automatic
  ok:    data => renderUser(data),
  err:   e => showError(e),
}))
```

When `userId` changes, the in-flight request is cancelled automatically via the `AbortSignal`. The `stale` state fires during re-fetch with the retained previous value — no `data`/`status` coordination needed.

**Derived state.** Reselect's `createSelector` requires explicit input selectors to memoize derived values. `createMemo()` tracks dependencies by reading — any signal accessed inside the memo is automatically a dependency. When the memo recomputes to the same value, downstream effects don't re-run, stopping propagation through the graph without any selector discipline:

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

**Collections.** `createEntityAdapter` normalizes items into `{ ids, entities }` with CRUD helpers. Every selector over `selectAll` returns a new array reference when any entity changes, re-rendering every subscribed component. `createList()` gives each item its own signal — effects subscribed to one item don't re-run when another changes, and stable keys survive sorting:

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

Zustand has no async primitive. You write async functions in the store and call `set()` after each `await`, manually managing loading, error, and stale state as separate fields. There is no `AbortSignal` integration — if you trigger a fetch twice in quick succession, both are in flight and the slower one wins:

```ts
// Zustand: write the state machine yourself, manage race conditions manually
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

With `createTask()`, reactive dependencies replace the manual trigger, the previous in-flight request is cancelled automatically when dependencies change, and `match()` encodes the state machine structurally. Most Zustand users pair it with TanStack Query for server state precisely to get these guarantees — `createTask()` provides them for all async, not just HTTP.

---

### Jotai

Jotai's mental model is closest to Cause & Effect: atoms are independent, composable reactive cells that auto-track dependencies. The main gaps are in async cancellation, the stale state, and collection structural integrity.

| Jotai | Cause & Effect |
|---|---|
| `atom(value)` | `createState()` |
| `atom(get => ...)` | `createMemo()` |
| `atom(async (get) => ...)` | `createTask()` |
| `atomFamily(key)` | `list.byKey(key)` |
| Keys atom + `atomFamily` | `createList()` |
| `loadable(atom)` | `match(nil/err/ok)` |

**Async.** Jotai async atoms have no `AbortSignal`. When a dependency changes while a fetch is in flight, the previous promise is abandoned — not cancelled. Responses can arrive out of order. The `loadable` utility provides explicit pending/error/data states, but has no stale case: when re-fetching, state transitions back to `'loading'` and data clears:

```ts
// Jotai: no cancellation; stale state not available
const userAtom = atom(async (get) => {
  const id = get(idAtom)
  return fetch(`/api/users/${id}`).then(r => r.json())
  // if idAtom changes mid-flight, previous fetch is abandoned — not cancelled
})
const loadable = useAtomValue(loadable(userAtom))
// loadable.state: 'loading' | 'hasData' | 'hasError' — no 'stale'
```

`createTask()` passes an `AbortSignal` and cancels previous computations automatically. `match()` routes `stale` separately from `nil` so previous data is retained and displayed during re-fetch.

**Collections.** `atomFamily` creates a stable atom per key, equivalent to `list.byKey(key)`. But there is no structural atom — adding or removing keys requires coordinating writes to a separate keys atom and `atomFamily`, and keeping them in sync is your responsibility:

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

TanStack Query is a server-state cache, not a general state manager. It handles HTTP caching, request deduplication, background refetch, and cache invalidation — patterns that are outside Cause & Effect's scope. Its query states map directly to `match()` handlers:

| TanStack Query | `match()` handler |
|---|---|
| `isPending` — first fetch, no data | `nil` |
| `isFetching` with `data` retained | `stale` |
| `isError` | `err` |
| `data` resolved | `ok` |

```ts
// TanStack Query: data is User | undefined in all branches
const { data, isPending, isFetching, isError, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),
})
if (isPending) return <Spinner />
if (isError) return <Error error={error} />
return <Profile user={data!} />  // ! required — TypeScript cannot narrow further
```

```ts
// Cause & Effect: value is User inside ok — no assertion needed
const userId = createState(1)
const user = createTask(async (prev, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  return res.json()
})

createEffect(() => match(user, {
  nil:   () => showSpinner(),
  err:   e => showError(e),
  stale: () => dimContent(),
  ok:    u => renderProfile(u),  // u: User, guaranteed
}))
```

**Where TanStack Query still wins.** For HTTP server state specifically — caching identical requests across components, background refetch intervals, tag-based cache invalidation, optimistic mutations, paginated and infinite queries — TanStack Query remains the better tool. The two libraries compose well: feed query results into a `createState()` or `createSensor()` and let Cause & Effect handle derived computation and local state on top.

**Where `createTask()` fills the gap.** TanStack Query is designed for fetch-based server state. For client-side async — IndexedDB reads, WebWorker results, WebSocket-derived values, or any async derivation that depends on other signals — `createTask()` provides the same `AbortSignal`, stale-state, and type-safe routing that TanStack Query provides for HTTP, but for any async operation in the graph.

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

### Non-nullable signals

All signals enforce `T extends {}` — `null` and `undefined` are excluded at the type level. This means you can trust that `.get()` always returns a real value without null checks.

```ts
const count = createState(0)
count.get() // type is number, guaranteed non-null

// This won't compile:
// const maybeUser = createState<User | null>(null)
```

This is a deliberate design decision. In frameworks, nullable state leads to defensive checks scattered across templates and hooks. Here, the type system prevents it.

**What to do instead:**

- For async results: use `createTask()` — a Task without reactive dependencies works like a Promise that resolves into the graph. Use `match()` to handle the pending state.
- For external input that starts undefined: use `createSensor()` with its lazy start callback.
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

### Explicit equality, not reference identity

By default, signals use `===` for equality. But unlike frameworks where this is buried in internals, you can override it per signal:

```ts
const point = createState({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y
})

point.set({ x: 0, y: 0 }) // no update — values are equal
```

## Beyond the Basics

The primitives above cover what most reactive libraries provide. The following signal types address patterns that frameworks handle with ad-hoc solutions or external libraries.

### Task: async derivations with cancellation

In React, async data fetching requires `useEffect` + cleanup + state management (or a library like React Query). In Angular, you'd use RxJS with `switchMap`. In Cause & Effect, `createTask()` is a signal that happens to be async:

```ts
import { createState, createTask, createEffect, match } from '@zeix/cause-effect'

const userId = createState(1)

const user = createTask(async (prev, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  return res.json()
})

userId.set(2) // cancels the in-flight request, starts a new one
```

The `abort` signal is managed automatically — when dependencies change, the previous computation is cancelled. No cleanup functions to write, no race conditions to handle.

Use `match()` inside effects to handle all states declaratively:

```ts
createEffect(() => {
  match(user, {
    ok: data => console.log('User:', data),
    nil: () => console.log('Loading...'),
    err: error => console.error(error)
  })
})
```

When the user ID changes and a new fetch starts, the previous result is retained until the new one resolves. `nil` fires only when there is no value at all — the initial fetch before any result. For the re-fetch case, add a `stale` handler:

```ts
createEffect(() => {
  match(user, {
    ok: data => renderUser(data),
    nil: () => showSpinner(),
    stale: () => {
      dimContent()       // overlay a refresh indicator over stale content
      return clearDimmed // called automatically before ok or err fires next
    },
    err: error => showError(error)
  })
})
```

In React Query terms: `nil` maps to `isLoading` (no data yet); `stale` maps to `isFetching` with existing data. The cleanup returned by `stale` runs before the next handler dispatch — it is the right place to remove the refresh indicator. Omitting `stale` falls back to `ok`, showing the retained value unchanged while re-fetching.

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

### Collection: derived arrays with item-level memoization

Collections provide reactive transformations over arrays with automatic per-item memoization. They come in two forms: **derived collections** (transformations of Lists or other Collections) and **externally-driven collections** (fed by external sources like WebSockets or Server-Sent Events).

**Derived collections** are created via `.deriveCollection()` on a List or Collection:

```ts
const display = todos.deriveCollection(todo => ({
  label: todo.done ? `[x] ${todo.text}` : `[ ] ${todo.text}`
}))

// Async transformations with automatic cancellation
const enriched = todos.deriveCollection(async (todo, abort) => {
  const res = await fetch(`/api/details/${todo.id}`, { signal: abort })
  return { ...todo, details: await res.json() }
})

// Chain collections for data pipelines
const pipeline = todos
  .deriveCollection(todo => ({ ...todo, urgent: todo.priority > 8 }))
  .deriveCollection(todo => todo.urgent ? `URGENT: ${todo.text}` : todo.text)
```

When one item changes, only its derived signal recomputes. Structural changes (additions, removals) are tracked separately from value changes.

**Externally-driven collections** are created with `createCollection()` and a start callback for keyed data arriving from external sources:

```ts
import { createCollection, createEffect } from '@zeix/cause-effect'

const messages = createCollection((applyChanges) => {
  const ws = new WebSocket('/messages')
  ws.onmessage = (e) => applyChanges({ add: JSON.parse(e.data) })
  return () => ws.close()
}, { keyConfig: msg => msg.id })

// Same Collection interface — .get(), .byKey(), .deriveCollection()
createEffect(() => {
  console.log('Messages:', messages.get().length)
})
```

The WebSocket connects when the first effect reads the collection and disconnects when no effects are watching. Incoming data is applied as granular add/change/remove operations, not wholesale array replacement.

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

If you are building a component system, you often need to expose signals as object properties via `Object.defineProperty()`. The challenge arises when a property must switch its backing signal — for example, from a local writable `State` to a parent-controlled read-only `Memo` — without breaking existing subscribers.

`createSlot()` solves this by providing a stable reactive source that delegates to a swappable backing signal. The slot object itself is a valid property descriptor:

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

Setter calls forward to the current backing signal when it is writable. If the backing signal is read-only (e.g. a Memo), setting throws `ReadonlySignalError`. The `replace()` and `current()` methods are on the slot object but not on the installed property — keep the slot reference for later control.
