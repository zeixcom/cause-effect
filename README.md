# Cause & Effect

Version 1.3.0

**Cause & Effect** is a reactive state management primitives library for TypeScript. It provides the foundational building blocks for managing complex, dynamic, composite, and asynchronous state — correctly and performantly — in a unified signal graph.

It is deliberately **not a framework**. It has no opinions about rendering, persistence, or application architecture. It is a thin, trustworthy layer over JavaScript that provides the comfort and guarantees of fine-grained reactivity while avoiding the common pitfalls of imperative code.

## Documentation

- [Guide for Framework Developers](GUIDE.md) - Conceptual differences, mental models, and comparisons
- [Advanced Patterns & Recipes](RECIPES.md) - Multi-step wizards, nested collections, and batching
- [Signal Graph Architecture](ARCHITECTURE.md) - Core data structures, graph engine, and ownership
- [React Integration](REACT_INTEGRATION.md) - Why it's out of scope and how you'd build one

## Who Is This For?

**Library authors** building on TypeScript — frontend or backend — who need a solid reactive foundation. The library is designed so that consuming libraries do not have to implement their own reactive primitives. Patterns like external data feeds, async derivations, and keyed collections are handled correctly within a unified graph rather than bolted on as ad-hoc extensions.

**Experienced developers** who want to write framework-agnostic applications with explicit dependencies, predictable updates, and type safety. If you are comfortable composing your own rendering and application layers on top of reactive primitives, this library gives you the guarantees without the opinions.

Cause & Effect is open source, built to power **Le Truc** (a Web Component library) by [Zeix AG](https://zeix.com).

## Signal Types

Every signal type participates in the same dependency graph with the same propagation, batching, and cleanup semantics. Each type is justified by a distinct role in the graph and the data structure it manages:

| Type | Role | Create with |
|------|------|-------------|
| **State** | Mutable source | `createState()` |
| **Sensor** | External input source (lazy lifecycle) | `createSensor()` |
| **Memo** | Synchronous derivation (memoized) | `createMemo()` |
| **Task** | Asynchronous derivation (memoized, cancellable) | `createTask()` |
| **Store** | Reactive object (keyed properties, proxy-based) | `createStore()` |
| **List** | Reactive array (keyed items, stable identity) | `createList()` |
| **Collection** | Reactive collection (external source or derived, item-level memoization) | `createCollection()` |
| **Slot** | Stable delegation for integration layers (swappable backing signal) | `createSlot()` |
| **Effect** | Side-effect sink (terminal) | `createEffect()` |

## Design Principles

- **Explicit reactivity**: Dependencies are tracked through `.get()` calls — the graph always reflects the true dependency structure, with no hidden subscriptions
- **Non-nullable types**: All signals enforce `T extends {}`, excluding `null` and `undefined` at the type level — you can trust returned values without null checks
- **Unified graph**: Composite signals (Store, List, Collection) and async signals (Task) are first-class citizens, not afterthoughts — all derivable state can be derived
- **Tree-shakable, zero dependencies**: Import only what you use — core signals (State, Memo, Task, Effect) stay below 5 kB gzipped, the full library below 10 kB

## Installation

```bash
# with npm
npm install @zeix/cause-effect

# or with bun
bun add @zeix/cause-effect
```

## Quick Start

```js
import { createState, createMemo, createEffect } from '@zeix/cause-effect'

// 1. Create state
const user = createState({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = createMemo(() => `Hello ${user.get().name}!`)

// 3. React to changes
createEffect(() => {
  console.log(`${greeting.get()} You are ${user.get().age} years old`)
})

// 4. Update state
user.update(u => ({ ...u, age: 31 })) // Logs: "Hello Alice! You are 31 years old"
```

## API

### State

A mutable source signal. Every signal has a `.get()` method to read its current value. State signals also provide `.set()` to assign a new value and `.update()` to modify it with a function.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

createEffect(() => console.log(count.get()))
count.set(24)

document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
```

Use State for primitives or for objects you replace entirely.

### Sensor

A read-only source that tracks external input. It activates lazily when first accessed by an effect and cleans up when no effects are watching:

```js
import { createSensor, createEffect } from '@zeix/cause-effect'

const mousePos = createSensor((set) => {
  const handler = (e) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('mousemove', handler)
  return () => window.removeEventListener('mousemove', handler)
})

createEffect(() => {
  const pos = mousePos.get()
  if (pos) console.log(`Mouse: ${pos.x}, ${pos.y}`)
})
```

Use Sensor for mouse position, window size, media queries, geolocation, device orientation, or any external value stream.

**Observing mutable objects**: Use `SKIP_EQUALITY` when the reference stays the same but internal state changes:

```js
import { createSensor, SKIP_EQUALITY, createEffect } from '@zeix/cause-effect'

const el = document.getElementById('status')
const element = createSensor((set) => {
  set(el)
  const observer = new MutationObserver(() => set(el))
  observer.observe(el, { attributes: true, childList: true })
  return () => observer.disconnect()
}, { value: el, equals: SKIP_EQUALITY })

createEffect(() => console.log(element.get().className))
```

### Memo

A memoized read-only derivation. It automatically tracks dependencies and updates only when those dependencies actually change.

```js
import { createState, createMemo, createEffect } from '@zeix/cause-effect'

const count = createState(42)
const isEven = createMemo(() => !(count.get() % 2))

createEffect(() => console.log(isEven.get()))
count.set(24) // no log; still even
```

**Tip**: For simple derivations, a plain function can be faster:

```js
const isEven = () => !(count.get() % 2)
```

**Advanced**: Reducer-style memos with previous value access:

```js
import { createState, createMemo } from '@zeix/cause-effect'

const actions = createState('reset')
const counter = createMemo(prev => {
  switch (actions.get()) {
    case 'increment': return prev + 1
    case 'decrement': return prev - 1
    case 'reset': return 0
    default: return prev
  }
}, { value: 0 })
```

### Task

An asynchronous derivation with automatic cancellation. When dependencies change while a computation is in flight, the previous one is aborted:

```js
import { createState, createTask } from '@zeix/cause-effect'

const id = createState(1)

const data = createTask(async (oldValue, abort) => {
  const response = await fetch(`/api/users/${id.get()}`, { signal: abort })
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
})

id.set(2) // cancels previous fetch automatically
```

Tasks also provide `.isPending()` to check if a computation is in progress and `.abort()` to manually cancel.

Use Task (not plain async functions) when you need memoization, cancellation, and reactive pending/error states.

### Store

A reactive object where each property becomes its own signal. Nested objects recursively become nested stores. A Proxy provides direct property access:

```js
import { createStore, createEffect } from '@zeix/cause-effect'

const user = createStore({
  name: 'Alice',
  age: 30,
  preferences: { theme: 'dark', notifications: true }
})

createEffect(() => {
  console.log(`${user.name.get()} is ${user.age.get()} years old`)
})

user.age.update(v => v + 1)
user.preferences.theme.set('light')

// Watch the full object
createEffect(() => console.log('User:', user.get()))
```

Iterate keys using the reactive `.keys()` method to observe structural changes:

```js
for (const key of user.keys()) {
  console.log(key)
}
```

Access properties by key using `.byKey()` or via direct property access like `user.name` (enabled by the Proxy).

Dynamic properties with `.add()` and `.remove()`:

```js
const settings = createStore({ autoSave: true })

settings.add('timeout', 5000)
settings.remove('timeout')
```

### List

A reactive array with individually reactive items and stable keys. Each item becomes its own signal while maintaining persistent identity through sorting and reordering:

```js
import { createList, createEffect } from '@zeix/cause-effect'

const items = createList(['banana', 'apple', 'cherry'])

createEffect(() => console.log(`First: ${items.at(0)?.get()}`))

items.add('date')
items.splice(1, 1, 'orange')
items.sort()
```

Access items by key using `.byKey()` or by index using `.at()`. `.indexOfKey()` returns the current index of an item in the list, while `.keyAt()` returns the key of an item at a given position. To update an existing item, use `.replace(key, value)` — this propagates to all subscribers regardless of how they subscribed to the list.

Keys are stable across reordering. Use `keyConfig` in options to control key generation:

```js
// String prefix keys
const items = createList(['banana', 'apple'], { keyConfig: 'item-' })
// Creates keys: 'item-0', 'item-1'

// Function-based keys
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: user => user.id }
)

const key = items.add('orange')
items.sort()
console.log(items.byKey(key)?.get()) // 'orange'
items.replace(key, 'ORANGE')         // update in place
console.log(items.indexOfKey(key))   // current index
```

Lists have `.keys()`, `.add()`, and `.remove()` methods like stores. Additionally, they have `.replace()`, `.sort()`, `.splice()`, and a reactive `.length` property. But unlike stores, deeply nested properties in items are not converted to individual signals.

### Collection

A reactive collection with item-level memoization. Collections can be externally-driven (via a watched callback) or derived from a List or another Collection.

**Externally-driven collections** receive data from external sources (WebSocket, Server-Sent Events, etc.) via `applyChanges()`:

```js
import { createCollection, createEffect } from '@zeix/cause-effect'

const items = createCollection((applyChanges) => {
  const ws = new WebSocket('/items')
  ws.onmessage = (e) => {
    const { add, change, remove } = JSON.parse(e.data)
    applyChanges({ add, change, remove })
  }
  return () => ws.close()
}, { keyConfig: item => item.id })

createEffect(() => console.log('Items:', items.get()))
```

The watched callback activates lazily when the collection is first accessed by an effect and cleans up when no effects are watching. Options include `value` for initial items (default `[]`) and `keyConfig` for key generation.

**Derived collections** transform Lists or other Collections via `.deriveCollection()`:

```js
import { createList } from '@zeix/cause-effect'

const users = createList([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
], { keyConfig: u => String(u.id) })

const profiles = users.deriveCollection(user => ({
  ...user,
  displayName: `${user.name} (${user.role})`
}))

console.log(profiles.at(0)?.get().displayName)
```

Async mapping is supported:

```js
const details = users.deriveCollection(async (user, abort) => {
  const response = await fetch(`/users/${user.id}`, { signal: abort })
  return { ...user, details: await response.json() }
})
```

Collections can be chained for data pipelines:

```js
const processed = users
  .deriveCollection(user => ({ ...user, active: user.lastLogin > threshold }))
  .deriveCollection(user => user.active ? `Active: ${user.name}` : `Inactive: ${user.name}`)
```

### Slot

A stable reactive source that delegates to a swappable backing signal. Designed for integration layers (e.g. custom element systems) where a property must switch its backing signal without breaking subscribers. The slot object doubles as a property descriptor for `Object.defineProperty()`:

```js
import { createState, createMemo, createSlot, createEffect } from '@zeix/cause-effect'

const local = createState(1)
const slot = createSlot(local)

// Use as a property descriptor
const target = {}
Object.defineProperty(target, 'value', slot)

createEffect(() => console.log(target.value)) // logs: 1

// Swap the backing signal — subscribers re-run automatically
const derived = createMemo(() => 42)
slot.replace(derived) // logs: 42

// Write through to the current backing signal
slot.replace(local)
target.value = 10 // sets local to 10
```

`replace()` and `current()` are available on the slot object but are not installed on the property — keep the slot reference for later control. Setting via the property forwards to the delegated signal; throws `ReadonlySignalError` if the current backing signal is read-only.

### Effect

A side-effect sink that runs whenever the signals it reads change. Effects are terminal — they consume values but produce none. The returned function disposes the effect:

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

const cleanup = createEffect(() => {
  console.log(count.get())
  return () => console.log('Cleanup')
})

cleanup()
```

Effect callbacks can return a cleanup function that runs before the effect re-runs or when disposed:

```js
createEffect(() => {
  const timer = setInterval(() => console.log(count.get()), 1000)
  return () => clearInterval(timer)
})
```

#### Error Handling: match()

Use `match()` inside effects to handle signal values declaratively, including pending and error states from Tasks:

```js
import { createState, createTask, createEffect, match } from '@zeix/cause-effect'

const userId = createState(1)
const userData = createTask(async (_, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})

createEffect(() => {
  match(userData, {
    ok: user => console.log('User:', user),
    nil: () => console.log('Loading...'),
    err: error => console.error(error),
    stale: () => console.log('Refreshing...')
  })
})
```

**Handler routing precedence: `nil` > `err` > `stale` > `ok`.** `nil` fires when any signal has no value yet (Task still in its first computation, no initial value provided). `err` fires when any signal holds an error. `stale` fires when all signals have a value but at least one Task signal is currently re-computing — i.e. it has a retained value from a previous resolution but its dependencies changed and a new computation is in flight. If `stale` is omitted, `ok` is called instead, preserving backward compatibility for callers that don't need to distinguish stale from fresh values.

**`stale` is a thunk — it receives no arguments.** The retained value is intentionally withheld: the stale display concern (e.g. dimming the current content, showing a progress bar) belongs to the cleanup returned by `stale`, not to a second rendering of the value. The cleanup returned by `stale` runs synchronously before the next dispatch, so it is the right place to reset any stale indicator:

```js
createEffect(() => match(userData, {
  ok: user => renderUser(user),
  nil: () => showSpinner(),
  stale: () => {
    dimContent()           // show stale indicator
    return clearDimmed     // called when ok or err fires next
  },
  err: e => showError(e)
}))
```

**When to make a handler async.** The `ok` (and `err`) handler may return a `Promise`. Use this for *external* side effects whose result does not need to drive reactive state — sending analytics, writing to IndexedDB, triggering a toast notification, or any fire-and-forget call. A cleanup function returned by the resolved Promise is registered and called synchronously before the next re-run.

**Do not set signal state inside an async handler.** If the async result needs to update the graph, model it as a `Task` instead. `Task` receives an `AbortSignal`, is auto-cancelled when its dependencies change, and exposes its pending / resolved / error states as first-class reactive values that compose naturally with `nil` and `err`.

```js
// ✗ Don't: async handler that writes back into the graph
createEffect(() => match(trigger, {
  ok: async () => {
    const data = await fetch('/api/data').then(r => r.json())
    result.set(data) // ← side-channel write, not tracked, no cancellation
  }
}))

// ✓ Do: derive the async value as a Task, read it in match()
const result = createTask(async (_, signal) =>
  fetch('/api/data', { signal }).then(r => r.json()))

createEffect(() => match(result, {
  ok: data => render(data),
  nil: () => showSpinner(),
  err: e => showError(e)
}))
```

**Stale-run rejections still reach `err`.** When a signal changes and the effect re-runs, the in-flight async handler from the previous run cannot be cancelled (the library did not initiate the underlying operation). If that stale operation eventually rejects, `err` will be called even though a newer run is already active. This is another reason to keep async handlers free of state writes — routing errors to `err` is safe when `err` is a pure side effect (logging, displaying a notification), but it becomes incorrect if `err` calls `.set()` on a signal that run 2 has already updated.

### Utilities

Polymorphic factories and type predicates for generic and library-author code.

**`createSignal(value)`** converts any value to its corresponding signal type:

```ts
import { createSignal } from '@zeix/cause-effect'

createSignal(0)                          // → State<number>
createSignal([1, 2, 3])                  // → List<number>
createSignal({ x: 0 })                   // → Store<{ x: number }>
createSignal(() => x.get() * 2)          // → Memo<number>
createSignal(async (_, s) =>
  fetch('/api', { signal: s }).then(r => r.json()))  // → Task<Response>
```

If the value is already a signal, it is returned unchanged.

**`createMutableSignal(value)`** is the same, but restricted to mutable signals — returns `State`, `Store`, or `List`. Throws `InvalidSignalValueError` if passed a function or a read-only signal.

**`createComputed(callback, options?)`** creates a `Memo` or `Task` by detecting whether the callback is async:

```ts
import { createComputed } from '@zeix/cause-effect'

const doubled = createComputed(() => count.get() * 2)
const data    = createComputed(async (_, signal) =>
  fetch(url.get(), { signal }).then(r => r.json()))
```

**Type predicates**

| Predicate | True for |
|---|---|
| `isSignal(value)` | Any signal (all 9 types) |
| `isMutableSignal(value)` | `State`, `Store`, `List` — signals with `.set()` and `.update()` |
| `isComputed(value)` | `Memo`, `Task` — derived signals |

The `MutableSignal<T>` type is the corresponding TypeScript type for `isMutableSignal` — use it as a parameter type in generic code that accepts any writable signal.

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

## Advanced Usage

### Batching

Group multiple signal updates, ensuring effects run only once after all changes are applied:

```js
import { batch, createState } from '@zeix/cause-effect'

const a = createState(2)
const b = createState(3)

batch(() => {
  a.set(4)
  b.set(5)
})
```

### Cleanup

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const user = createState({ name: 'Alice', age: 30 })
const greeting = () => `Hello ${user.get().name}!`
const cleanup = createEffect(() => {
  console.log(`${greeting()} You are ${user.get().age} years old`)
  return () => console.log('Cleanup')
})

// When you no longer need the effect, execute the cleanup function
cleanup() // Logs: 'Cleanup' and unsubscribes from signal `user`

user.set({ name: 'Bob', age: 28 }) // Won't trigger the effect anymore
```

### Scoped Cleanup

Use `createScope()` for hierarchical cleanup of nested effects and resources. It returns a single cleanup function:

```js
import { createState, createEffect, createScope } from '@zeix/cause-effect'

const dispose = createScope(() => {
  const count = createState(0)
  createEffect(() => console.log(count.get()))
  return () => console.log('Scope disposed')
})

dispose() // Cleans up the effect and runs the returned cleanup
```

### Resource Management with Watch Callbacks

Sensor and Collection signals use a **watched callback** for lazy resource management. The callback runs when the signal is first accessed by an effect and the returned cleanup function runs when no effects are watching:

```js
import { createSensor, createCollection, createEffect } from '@zeix/cause-effect'

// Sensor: track external input
const windowSize = createSensor((set) => {
  const update = () => set({ w: innerWidth, h: innerHeight })
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
})

// Collection: receive external data
const feed = createCollection((applyChanges) => {
  const es = new EventSource('/feed')
  es.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => es.close()
}, { keyConfig: item => item.id })

// Resources are created only when effect runs
const cleanup = createEffect(() => {
  console.log('Window size:', windowSize.get())
  console.log('Feed items:', feed.get())
})

// Resources are cleaned up when effect stops
cleanup()
```

Store and List signals support an optional `watched` callback in their options that returns a cleanup function:

```js
const user = createStore({ name: 'Alice' }, {
  watched: () => {
    const ws = new WebSocket('/updates')
    return () => ws.close()
  }
})
```

**Watched propagation through `deriveCollection()`**: When an effect reads a derived collection, the `watched` callback on the source List, Store, or Collection activates automatically — even through multiple levels of chaining. Mutations on the source do not tear down the watcher. When the last effect disposes, cleanup cascades upstream through all intermediate nodes.

**Tip — conditional reads delay activation**: Dependencies are tracked based on which `.get()` calls actually execute. If a signal read is inside a branch that doesn't run yet (e.g., inside `match()`'s `ok` branch while a Task is pending), `watched` won't activate until that branch executes. Read signals eagerly before conditional logic to ensure immediate activation:

```js
createEffect(() => {
  match([task, derived], { // derived is always tracked
    ok: ([result, values]) => renderList(values, result),
    nil: () => showLoading(),
  })
})
```

Memo and Task signals also support a `watched` option, but their callback receives an `invalidate` function that marks the signal dirty and triggers recomputation:

```js
const changes = createMemo((prev) => {
  const next = new Set(parent.querySelectorAll(selector))
  // ... diff prev vs next ...
  return { current: next, added, removed }
}, {
  value: { current: new Set(), added: [], removed: [] },
  watched: (invalidate) => {
    const observer = new MutationObserver(() => invalidate())
    observer.observe(parent, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
})
```

This pattern is ideal for:
- Event listeners that should only be active when data is being watched
- Network connections that can be lazily established
- Expensive computations that should pause when not needed
- External subscriptions (WebSocket, Server-Sent Events, etc.)
- Computed signals that need to react to external events (DOM mutations, timers)

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2024 - 2026 [Zeix AG](https://zeix.com)
