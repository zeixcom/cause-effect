# Cause & Effect

Version 0.18.0

**Cause & Effect** is a tiny (~5kB gzipped), dependency-free reactive state management library for JavaScript. It uses fine-grained signals so derived values and side effects update automatically when their dependencies change.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all dependent computations and effects, ensuring your UI stays in sync with your data without manual intervention.

### Core Concepts

- **State**: mutable value (`createState()`)
- **Memo**: derived & memoized value (`createMemo()`)
- **Effect**: runs when dependencies change (`createEffect()`)
- **Task**: async derived value with cancellation (`createTask()`)
- **Store**: object with reactive nested props (`createStore()`)
- **List**: mutable array with stable keys & reactive items (`createList()`)
- **Collection**: read-only derived arrays from Lists (`createCollection()`)
- **SourceCollection**: externally-driven collection with watched lifecycle (`createSourceCollection()`)
- **Sensor**: external input tracking with automatic updates (`createSensor()`)

## Key Features

- ⚡ **Fine-grained reactivity** with automatic dependency tracking
- 🧩 **Composable signal graph** with a small API
- ⏱️ **Async ready** (`createTask`, `AbortController`, async collections)
- 🛡️ **Declarative error handling** (`match()`)
- 🚀 **Batching** and efficient dependency tracking
- 📦 **Tree-shakable**, zero dependencies

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

## Usage of Signals

### State

A `State` is a mutable signal created with `createState()`. Every signal has a `.get()` method to access its current value. State signals also provide `.set()` to directly assign a new value and `.update()` to modify the value with a function.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

createEffect(() => console.log(count.get()))
count.set(24)

document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
```

Use `State` for primitives or for objects you typically replace entirely.

### Memo

A `Memo` is a memoized read-only signal created with `createMemo()`. It automatically tracks dependencies and updates only when those dependencies change.

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

A `Task` handles asynchronous computations with cancellation support, created with `createTask()`:

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

**Note**: Use Task (not plain async functions) when you want memoization + cancellation + reactive pending/error states.

### Store

A `Store` is a reactive object created with `createStore()`. Each property automatically becomes its own signal with `.get()`, `.set()`, and `.update()` methods. Nested objects recursively become nested stores.

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

Access items by key using `.byKey()` or via direct property access like `user.name` (enabled by the Proxy `createStore()` returns).

Dynamic properties using the `.add()` and `.remove()` methods:

```js
const settings = createStore({ autoSave: true })

settings.add('timeout', 5000)
settings.remove('timeout')
```

### List

A `List` is a mutable signal for arrays with individually reactive items and stable keys, created with `createList()`. Each item becomes its own signal while maintaining persistent identity through sorting and reordering:

```js
import { createList, createEffect } from '@zeix/cause-effect'

const items = createList(['banana', 'apple', 'cherry'])

createEffect(() => console.log(`First: ${items.at(0)?.get()}`))

items.add('date')
items.splice(1, 1, 'orange')
items.sort()
```

Access items by key using `.byKey()` or by index using `.at()`. `.indexOfKey()` returns the current index of an item in the list, while `.keyAt()` returns the key of an item at a given position.

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
console.log(items.indexOfKey(key))   // current index
```

Lists have `.keys()`, `.add()`, and `.remove()` methods like stores. Additionally, they have `.sort()`, `.splice()`, and a reactive `.length` property. But unlike stores, deeply nested properties in items are not converted to individual signals.

### Collection

A `Collection` is a read-only derived reactive list from a `List` or another `Collection`. Create one with `createCollection()` or via `.deriveCollection()`:

```js
import { createList, createEffect } from '@zeix/cause-effect'

const users = createList([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
], { keyConfig: u => String(u.id) })

const profiles = users.deriveCollection(user => ({
  ...user,
  displayName: `${user.name} (${user.role})`
}))

createEffect(() => console.log('Profiles:', profiles.get()))
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

### Sensor

A `Sensor` tracks external input and updates a state value automatically, created with `createSensor()`. It activates lazily when first accessed by an effect:

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

Use `Sensor` for mouse position, window size, media queries, geolocation, device orientation, etc.

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

### SourceCollection

A `SourceCollection` is an externally-driven collection with a watched lifecycle, created with `createSourceCollection()`. Unlike `createCollection()` which derives from a List, a SourceCollection receives data from external sources (WebSocket, Server-Sent Events, etc.) via `applyChanges()`:

```js
import { createSourceCollection, createEffect } from '@zeix/cause-effect'

const items = createSourceCollection([], (applyChanges) => {
  const ws = new WebSocket('/items')
  ws.onmessage = (e) => {
    const { add, change, remove } = JSON.parse(e.data)
    applyChanges({ changed: true, add, change, remove })
  }
  return () => ws.close()
}, { keyConfig: item => item.id })

createEffect(() => console.log('Items:', items.get()))
```

SourceCollections share the same `Collection` interface — `.get()`, `.byKey()`, `.keys()`, `.at()`, `.deriveCollection()` — and support chaining for data pipelines.

## Effects

The `createEffect()` callback runs whenever the signals it reads change. It returns a cleanup/dispose function.

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

### Error Handling: match()

Use `match()` inside effects to handle signal values declaratively, including pending and error states:

```js
import { createState, createTask, createEffect, match } from '@zeix/cause-effect'

const userId = createState(1)
const userData = createTask(async (_, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})

createEffect(() => {
  match([userData], {
    ok: ([user]) => console.log('User:', user),
    nil: () => console.log('Loading...'),
    err: errors => console.error(errors[0])
  })
})
```

## Signal Type Decision Tree

```
Does the data come from *outside* the reactive system?
│
├─ Yes, single value → `createSensor(set => { ... })`
│   (mouse position, window resize, media queries, DOM observers, etc.)
│   Tip: Use `{ equals: SKIP_EQUALITY }` for mutable object observation
│
├─ Yes, keyed collection → `createSourceCollection(initial, applyChanges => { ... })`
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
              └─ Yes → `createCollection()` or `.deriveCollection()`
                 (memoized + supports async mapping + chaining)
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

Sensor and SourceCollection signals use a **start callback** for lazy resource management. The callback runs when the signal is first accessed by an effect and the returned cleanup function runs when no effects are watching:

```js
import { createSensor, createSourceCollection, createEffect } from '@zeix/cause-effect'

// Sensor: track external input
const windowSize = createSensor((set) => {
  const update = () => set({ w: innerWidth, h: innerHeight })
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
})

// SourceCollection: receive external data
const feed = createSourceCollection([], (applyChanges) => {
  const es = new EventSource('/feed')
  es.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => es.close()
})

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

This pattern is ideal for:
- Event listeners that should only be active when data is being watched
- Network connections that can be lazily established
- Expensive computations that should pause when not needed
- External subscriptions (WebSocket, Server-Sent Events, etc.)

### diff()

Compare object changes:

```js
import { diff } from '@zeix/cause-effect'

const oldUser = { name: 'Alice', age: 30, city: 'Boston' }
const newUser = { name: 'Alice', age: 31, email: 'alice@example.com' }

const changes = diff(oldUser, newUser)
console.log(changes.changed)  // true - something changed
console.log(changes.add)      // { email: 'alice@example.com' }
console.log(changes.change)   // { age: 31 }
console.log(changes.remove)   // { city: null }
```

### isEqual()

Deep equality comparison with circular reference detection:

```js
import { isEqual } from '@zeix/cause-effect'

const obj1 = { name: 'Alice', preferences: { theme: 'dark' } }
const obj2 = { name: 'Alice', preferences: { theme: 'dark' } }
const obj3 = { name: 'Bob', preferences: { theme: 'dark' } }

console.log(isEqual(obj1, obj2)) // true - deep equality
console.log(isEqual(obj1, obj3)) // false - names differ

// Handles arrays, primitives, and complex nested structures
console.log(isEqual([1, 2, 3], [1, 2, 3]))           // true
console.log(isEqual('hello', 'hello'))               // true
console.log(isEqual({ a: [1, 2] }, { a: [1, 2] }))   // true
```

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2024 - 2026 [Zeix AG](https://zeix.com)
