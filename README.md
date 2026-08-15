# Cause & Effect

**Cause & Effect** is a reactive state management primitives library for TypeScript. It provides the building blocks for complex, dynamic, composite, and asynchronous state in a unified signal graph.

It is deliberately **not a framework**. It has no opinions about rendering, persistence, or application architecture. It is a thin layer over JavaScript that gives you fine-grained reactivity with explicit guarantees.

## Documentation

- [Guide for Framework Developers](GUIDE.md) — conceptual differences, mental models, comparisons, and how to choose a signal type
- [Advanced Patterns & Recipes](RECIPES.md) — multi-step wizards, nested collections, batching, and lazy resources
- [Signal Graph Architecture](ARCHITECTURE.md) — core data structures, graph engine, and ownership
- [React Integration](REACT_INTEGRATION.md) — why it is out of scope and how you would build one

## Who Is This For?

**Library authors** who need a reactive foundation and do not want to write their own primitives. External data feeds, async derivations, and keyed collections are handled inside one graph rather than bolted on.

**Experienced developers** writing framework-agnostic applications with explicit dependencies and type safety. You compose your own rendering layer; the library supplies the guarantees.

Cause & Effect is open source, built to power **Le Truc** (a Web Component library) by [Zeix AG](https://zeix.com).

## Signal Types

Every signal type participates in the same dependency graph, with the same propagation, batching, and cleanup semantics.

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

See [Choosing the Right Signal](GUIDE.md#choosing-the-right-signal) for a decision tree.

## Design Principles

- **Explicit reactivity**: `.get()` calls track dependencies — the graph reflects the true dependency structure, with no hidden edges
- **Non-nullable types**: All signals enforce `T extends {}`, excluding `null` and `undefined` at the type level — trust returned values without null checks
- **Unified graph**: Composite signals (Store, List, Collection) and async signals (Task) are first-class — all derivable state can be derived
- **Tree-shakable, zero dependencies**: Core signals (State, Memo, Task, Effect) are less than 3 kB gzipped; the full library is around 7 kB

## Guarantees

1. Writes inside `batch()` merge. Effects run once, when the outermost batch exits.
2. Effects run synchronously. A write reaches its effects before the next statement, with no microtask and no scheduler tick.
3. Reads are glitch-free. You never observe a partially updated graph.
4. A write that compares equal propagates nothing to the entire downstream subtree.
5. `untrack()` reads a signal without creating an edge.
6. Cleanups run before every re-run and on disposal.
7. A scope disposes everything created inside it.

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

A mutable source signal. `.get()` reads the value, `.set()` assigns a new one, and `.update()` modifies it with a function.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

createEffect(() => console.log(count.get()))
count.set(24)

document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
```

Use State for primitives, or for objects you replace entirely.

### Sensor

A read-only source that tracks external input. It activates lazily when an effect first reads it, and cleans up when it is no longer watched.

```js
import { createSensor, createEffect } from '@zeix/cause-effect'

// `value` seeds an initial reading — without it, `.get()` throws
// `UnsetSignalValueError` until the first mousemove event fires
const mousePos = createSensor((set) => {
  const handler = (e) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('mousemove', handler)
  return () => window.removeEventListener('mousemove', handler)
}, { value: { x: 0, y: 0 } })

createEffect(() => {
  const pos = mousePos.get()
  console.log(`Mouse: ${pos.x}, ${pos.y}`)
})
```

Sensor and Task are the only signals without a default initial value. `.get()` throws `UnsetSignalValueError` while unset. When there is no natural default — a geolocation reading, for example — omit `value` and handle the unset case with [`match()`](#error-handling-with-match) and its `nil` handler.

Use Sensor for mouse position, window size, media queries, geolocation, device orientation, or any external value stream.

**Observing mutable objects**: pass `{ equals: SKIP_EQUALITY }` when the reference stays the same but internal state changes, such as a DOM element watched by a `MutationObserver`.

### Memo

A memoized read-only derivation. It tracks dependencies automatically and recomputes only when a dependency actually changes.

```js
import { createState, createMemo, createEffect } from '@zeix/cause-effect'

const count = createState(42)
const isEven = createMemo(() => !(count.get() % 2))

createEffect(() => console.log(isEven.get()))
count.set(24) // no log; still even
```

**Tip**: for a simple derivation, a plain function is faster — `const isEven = () => !(count.get() % 2)`.

**Reducer style**: the callback receives the previous value, and `value` seeds it.

```js
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

An asynchronous derivation with automatic cancellation. When a dependency changes while a computation is in flight, the library aborts the previous one.

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

`.isPending()` reports whether a computation is in progress. `.abort()` cancels it manually.

Use Task instead of a plain async function when you need memoization, cancellation, and reactive pending and error states.

### Store

A reactive object where each property becomes its own signal. Nested objects recursively become nested stores. A Proxy provides direct property access.

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

createEffect(() => console.log('User:', user.get())) // watch the full object
```

Access a property with `.byKey()`, or directly as `user.name` through the Proxy. Iterate with the reactive `.keys()` method to observe structural changes. Add and remove properties with `.add(key, value)` and `.remove(key)`.

### List

A reactive array with individually reactive items and stable keys. Each item becomes its own signal and keeps its identity through sorting and reordering.

```js
import { createList, createEffect } from '@zeix/cause-effect'

const items = createList(['banana', 'apple', 'cherry'])

createEffect(() => console.log(`First: ${items.at(0)?.get()}`))

items.add('date')
items.splice(1, 1, 'orange')
items.sort()
```

Access items with `.byKey()` or `.at()`. `.indexOfKey()` returns an item's current index, and `.keyAt()` returns the key at a position. Lists also provide `.keys()`, `.add()`, `.remove()`, `.replace()`, `.sort()`, `.splice()`, and a reactive `.length`. Unlike Store, deeply nested properties inside items do not become individual signals.

**Use `.replace(key, value)` to update an existing item.** `.byKey()` returns the item's own signal, and calling `.set()` on it is not guaranteed to reach sinks that read the list structurally through `.keys()`, `.length`, or the iterator. `.replace()` propagates to every sink regardless of how it reads the list.

Keys stay stable across reordering. Control key generation with `keyConfig`:

```js
// String prefix keys → 'item-0', 'item-1'
const items = createList(['banana', 'apple'], { keyConfig: 'item-' })

// Function-based keys
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: user => user.id }
)
```

To rebuild a list from inside a reactive handler, use `.set()` or `.update()` rather than a remove-then-add loop, which throws `EffectConvergenceError`. See [Rebuilding a List from a reactive handler](RECIPES.md#3-rebuilding-a-list-from-a-reactive-handler).

> **Naming ahead of 2.0:** the mutable list type is also exported as `MutableList` — the name it keeps in 2.0, where `List` becomes the readonly base (today's `Collection`). `isMutableList()` is the matching guard. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

### Collection

A Collection is a set of keyed items with per-item memoization, so a change to one item does not invalidate the others. A Collection is externally-driven through a watched callback, or derived from a List or another Collection.

**Externally-driven collections** receive data through `applyChanges()`:

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

The watched callback activates lazily when an effect first reads the collection, and cleans up when no effect watches it. Options are `value` for initial items (default `[]`) and `keyConfig` for key generation.

**Derived collections** transform Lists or other Collections through `.deriveCollection()`:

```js
const profiles = users.deriveCollection(user => ({
  ...user,
  displayName: `${user.name} (${user.role})`
}))

console.log(profiles.at(0)?.get().displayName)
```

The mapping callback may be async, and receives an `AbortSignal`:

```js
const details = users.deriveCollection(async (user, abort) => {
  const response = await fetch(`/users/${user.id}`, { signal: abort })
  return { ...user, details: await response.json() }
})
```

Collections chain, which builds a data pipeline:

```js
const processed = users
  .deriveCollection(user => ({ ...user, active: user.lastLogin > threshold }))
  .deriveCollection(user => user.active ? `Active: ${user.name}` : `Inactive: ${user.name}`)
```

> **Naming ahead of 2.0:** the `Collection` type is deprecated as of 1.5.0 — use `DerivedList`, the type `deriveList()` returns, and the `isDerivedList()` guard. `createCollection(watched, options)` is deprecated in favor of `deriveList(seed, { watched, … })`. In 2.0, the readonly base is named `List`. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

### Slot

A Slot is a forwarding layer to a swappable backing signal, and it holds no value of its own. It has no `update()` method, and `isMutableSignal()` excludes it. Slots serve integration layers such as custom element systems, where a property must switch its backing signal without breaking existing sinks. The slot object doubles as a property descriptor for `Object.defineProperty()`:

```js
import { createState, createMemo, createSlot, createEffect } from '@zeix/cause-effect'

const local = createState(1)
const slot = createSlot(local)

const target = {}
Object.defineProperty(target, 'value', slot)

createEffect(() => console.log(target.value)) // logs: 1

// Swap the backing signal — sinks re-run automatically
const derived = createMemo(() => 42)
slot.replace(derived) // logs: 42

// Write through to the current backing signal
slot.replace(local)
target.value = 10 // sets local to 10
```

`replace()` and `current()` live on the slot object, not on the installed property — keep the slot reference for later control. Writing through the property forwards to the delegated signal, and throws `ReadonlySignalError` if that signal is read-only.

### Effect

A side-effect sink that runs whenever the signals it reads change. Effects are terminal: they consume values and produce none. The returned function disposes the effect.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

const cleanup = createEffect(() => {
  console.log(count.get())
  return () => console.log('Cleanup')
})

cleanup()
```

An effect callback may return a cleanup function, which runs before the effect re-runs and on disposal:

```js
createEffect(() => {
  const timer = setInterval(() => console.log(count.get()), 1000)
  return () => clearInterval(timer)
})
```

#### Error handling with match()

`match()` handles signal values declaratively inside an effect, including the pending and error states of a Task:

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

**Handler routing precedence: `nil` > `err` > `stale` > `ok`.** `nil` fires when a signal has no value yet. `err` fires when a signal holds an error. `stale` fires when every signal has a value but a Task is re-computing. When `stale` is absent, `ok` runs instead.

**Handler bodies run in the caller's tracking scope.** `match()` calls its handlers synchronously inside the enclosing effect. Any signal read inside a handler becomes a tracked dependency of that effect, including implicit reads by collection methods such as `List.keys()` or `List.at()`. Wrap a handler body in `untrack()` to opt out.

**`stale` is a thunk and receives no arguments.** The retained value is withheld deliberately. The cleanup returned by `stale` runs before the next dispatch, which makes it the right place to reset a stale indicator:

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

An `ok` or `err` handler may return a `Promise`, but must not write signal state. See [Async side effects in match()](RECIPES.md#4-async-side-effects-in-match) for the rules and the correct alternative.

### Utilities

Polymorphic factories (`createSignal`, `createMutableSignal`, `createComputed`) and type predicates (`isSignal`, `isMutableSignal`, `isComputed`) serve generic and library-author code. See [Utilities for generic code](GUIDE.md#utilities-for-generic-code).

> **Naming ahead of 2.0:** `createSignal`'s shape sniffing (array → `List`, record → `Store`, function → `Memo`/`Task`) is removed with no replacement export, and `createComputed`/`createMutableSignal` are subsumed by `deriveSignal`/`createSignal`. See [MIGRATION-2.0.md](MIGRATION-2.0.md).

## Advanced Usage

### Batching

`batch()` groups updates so effects run once, after every change is applied:

```js
import { batch, createState } from '@zeix/cause-effect'

const a = createState(2)
const b = createState(3)

batch(() => {
  a.set(4)
  b.set(5)
})
```

### Cleanup and scopes

`createEffect()` returns a cleanup function. Calling it severs the effect's edges and runs the cleanup returned by the callback, after which further writes no longer trigger it.

`createScope()` gives hierarchical cleanup for nested effects and resources, and returns one cleanup function:

```js
import { createState, createEffect, createScope } from '@zeix/cause-effect'

const dispose = createScope(() => {
  const count = createState(0)
  createEffect(() => console.log(count.get()))
  return () => console.log('Scope disposed')
})

dispose() // cleans up the effect and runs the returned cleanup
```

Pass `{ root: true }` when an external lifecycle owns the teardown, such as a web component's `disconnectedCallback`. Without it, a scope created inside a re-runnable effect is disposed on the next re-run.

### Watched callbacks

Sensor and Collection take a watched callback for lazy resource management. It runs when an effect first reads the signal, and its returned cleanup runs when no effect watches it.

Store and List accept an optional `watched` callback in their options:

```js
const user = createStore({ name: 'Alice' }, {
  watched: () => {
    const ws = new WebSocket('/updates')
    return () => ws.close()
  }
})
```

Memo and Task also accept `watched`, but their callback receives an `invalidate` function that marks the signal dirty and triggers recomputation.

See [Lazy resources with watched callbacks](RECIPES.md#5-lazy-resources-with-watched-callbacks) for propagation through `deriveCollection()`, activation timing, and the `invalidate` pattern.

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2024 - 2026 [Zeix AG](https://zeix.com)
