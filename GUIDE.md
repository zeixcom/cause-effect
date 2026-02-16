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
  match([user], {
    ok: ([data]) => console.log('User:', data),
    nil: () => console.log('Loading...'),
    err: (errors) => console.error(errors[0])
  })
})
```

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

// Get a stable reference to a specific item
const first = todos.byKey('t1')

todos.sort((a, b) => a.text.localeCompare(b.text))
// first still points to "Learn signals", regardless of position

// Update a single item without replacing the array
first?.set({ id: 't1', text: 'Learn signals', done: true })
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
