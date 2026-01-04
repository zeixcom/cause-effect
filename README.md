# Cause & Effect

Version 0.17.2

**Cause & Effect** is a tiny (~5kB gzipped), dependency-free reactive state library for JavaScript. It uses fine-grained signals so derived values and side effects update automatically when their dependencies change.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all dependent computations and effects, ensuring your UI stays in sync with your data without manual intervention.

### Core Concepts

- **State**: mutable value (`new State()`)
- **Memo**: derived & memoized value (`new Memo()`)
- **Effect**: runs when dependencies change (`createEffect()`)
- **Task**: async derived value with cancellation (`new Task()`)
- **Store**: object with reactive nested props (`createStore()`)
- **List**: mutable array with stable keys & reactive items (`new List()`)
- **Collection**: read-only derived arrays from Lists (`new DerivedCollection()`)
- **Ref**: external mutable objects + manual .notify() (`new Ref()`)

## Key Features

- ⚡ **Fine-grained reactivity** with automatic dependency tracking
- 🧩 **Composable signal graph** with a small API
- ⏱️ **Async ready** (`Task`, `AbortController`, async `DerivedCollection`)
- 🛡️ **Declarative error handling** (`resolve()` + `match()`)
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
import { createEffect, Memo, State } from '@zeix/cause-effect'

// 1. Create state
const user = new State({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = new Memo(() => `Hello ${user.get().name}!`)

// 3. React to changes
createEffect(() => {
  console.log(`${greeting.get()} You are ${user.get().age} years old`)
})

// 4. Update state
user.update(u => ({ ...u, age: 31 })) // Logs: "Hello Alice! You are 31 years old"
```

## Usage of Signals

### State

A `State` is a mutable signal. Every signal has a `.get()` method to access its current value. State signals also provide `.set()` to directly assign a new value and `.update()` to modify the value with a function.

```js
import { createEffect, State } from '@zeix/cause-effect'

const count = new State(42)

createEffect(() => console.log(count.get()))
count.set(24)

document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
```

Use `State` for primitives or for objects you typically replace entirely.

### Memo

A `Memo` is a memoized read-only signal that automatically tracks dependencies and updates only when those dependencies change.

```js
import { State, Memo, createEffect } from '@zeix/cause-effect'

const count = new State(42)
const isEven = new Memo(() => !(count.get() % 2))

createEffect(() => console.log(isEven.get()))
count.set(24) // no log; still even
```

**Tip**: For simple derivations, a plain function can be faster:

```js
const isEven = () => !(count.get() % 2)
```

**Advanced**: Reducer-style memos:

```js
import { State, Memo } from '@zeix/cause-effect'

const actions = new State('reset')
const counter = new Memo((prev) => {
  switch (actions.get()) {
    case 'increment': return prev + 1
    case 'decrement': return prev - 1
    case 'reset': return 0
    default: return prev
  }
}, 0)
```

### Task

A `Task` handles asynchronous computations with cancellation support:

```js
import { State, Task } from '@zeix/cause-effect'

const id = new State(1)

const data = new Task(async (oldValue, abort) => {
  const response = await fetch(`/api/users/${id.get()}`, { signal: abort })
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
})

id.set(2) // cancels previous fetch automatically
```

**Note**: Use Task (not plain async functions) when you want memoization + cancellation + reactive pending/error states.

### Store

A `Store` is a reactive object. Each property automatically becomes its own signal with `.get()`, `.set()`, and `.update()` methods. Nested objects recursively become nested stores.

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

Dynamic properties using the `add()` and `remove()` methods:

```js
const settings = createStore({ autoSave: true })

settings.add('timeout', 5000)
settings.remove('timeout')
```

Subscribe to hooks using the `.on()` method:

```js
const user = createStore({ name: 'Alice', age: 30 })

const offChange = user.on('change', changed => console.log(changed))
const offAdd = user.on('add', added => console.log(added))
const offRemove = user.on('remove', removed => console.log(removed))

// These will trigger the respective hooks:
user.add('email', 'alice@example.com') // Logs: "Added properties: ['email']"
user.age.set(31)                       // Logs: "Changed properties: ['age']"
user.remove('email')                   // Logs: "Removed properties: ['email']"
```

To unregister hooks, call the returned cleanup functions:

```js
offAdd() // Stop listening to add hook
offChange() // Stop listening to change hook
offRemove() // Stop listening to remove hook
```

### List

A `List` is a mutable signal for arrays with individually reactive items and stable keys. Each item becomes its own signal while maintaining persistent identity through sorting and reordering:

```js
import { List, createEffect } from '@zeix/cause-effect'

const items = new List(['banana', 'apple', 'cherry'])

createEffect(() => console.log(`First: ${items[0].get()}`))

items.add('date')
items.splice(1, 1, 'orange')
items.sort()
```

Keys are stable across reordering:

```js
const items = new List(['banana', 'apple'], 'item-')
const key = items.add('orange')

items.sort()
console.log(items.byKey(key))     // 'orange'
console.log(items.indexOfKey(key)) // current index
```

Lists have `.add()`, `.remove()` and `.on()` methods like stores. In addition, they have `.sort()` and `.splice()` methods. But unlike stores, deeply nested properties in items are not converted to individual signals.

### Collection

A `Collection` is a read-only derived reactive list from `List` or another `Collection`:

```js
import { List, createEffect } from '@zeix/cause-effect'

const users = new List([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
])
const profiles = users.deriveCollection(user => ({
  ...user,
  displayName: `${user.name} (${user.role})`
}))

createEffect(() => console.log('Profiles:', profiles.get()))
console.log(userProfiles.at(0).get().displayName)
```

Async mapping is supported: 

```js
const details = users.derivedCollection(async (user, abort) => {
  const response = await fetch(`/users/${user.id}`, { signal: abort })
  return { ...user, details: await response.json() }
})
```

### Ref

A `Ref` is a signal that holds a reference to an external object that can change outside the reactive system.

```js
import { createEffect, Ref } from '@zeix/cause-effect'

const elementRef = new Ref(document.getElementById('status'))

createEffect(() => console.log(elementRef.get().className))

// external mutation happened
elementRef.notify()
```

Use `Ref` for DOM nodes, Maps/Sets, sockets, third-party objects, etc.

## Effects

The `createEffect()` callback runs whenever the signals it reads change. It supports sync or async callbacks and returns a cleanup function.

```js
import { State, createEffect } from '@zeix/cause-effect'

const count = new State(42)

const cleanup = createEffect(() => {
  console.log(count.get())
  return () => console.log('Cleanup')
})

cleanup()
```

Async effects receive an AbortSignal that cancels on rerun or cleanup:

```js
createEffect(async abort => {
  const res = await fetch('/api', { signal: abort })
  if (res.ok) console.log(await res.json())
})
```

### Error Handling: resolve() + match()

Use `resolve()` to extract values from signals (including pending/err states) and `match()` to handle them declaratively:

```js
import { State, Task, createEffect, resolve, match } from '@zeix/cause-effect'

const userId = new State(1)
const userData = new Task(async (_, abort) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})

createEffect(() => {
  match(resolve({ userData }), {
    ok: ({ userData: user }) => console.log('User:', user),
    nil: () => console.log('Loading...'),
    err: errors => console.error(errors[0])
  })
})
```

## Signal Type Decision Tree

```
Is the value managed *inside* the reactive system?
│
├─ No → Use `Ref`
│        (DOM nodes, Map/Set, Date, sockets, 3rd-party objects)
│        Remember: call `.notify()` when it changes externally.
│
└─ Yes? What kind of data is it?
    │
    ├─ *Primitive* (number/string/boolean)
    │   │
    │   ├─ Do you want to mutate it directly?
    │   │     └─ Yes → `State`
    │   │
    │   └─ Is it derived from other signals?
    │         │
    │         ├─ Sync derived
    │         │     ├─ Simple/cheap → plain function (preferred)
    │         │     └─ Expensive/shared/stateful → `Memo`
    │         │     
    │         └─ Async derived → `Task`
    │            (cancellation + memoization + pending/error state)
    │
    ├─ *Plain Object*
    │   │
    │   ├─ Do you want to mutate individual properties?
    │   │     ├─ Yes → `Store`
    │   │     └─ No, whole object mutations only → `State`
    │   │
    │   └─ Is it derived from other signals?
    │         ├─ Sync derived → plain function or `Memo`
    │         └─ Async derived → `Task`
    │
    └─ *Array*
        │
        ├─ Do you need to mutate it (add/remove/sort) with stable item identity?
        │     ├─ Yes → `List`
        │     └─ No, whole array mutations only → `State`
        │
        └─ Is it derived / read-only transformation of a `List` or `Collection`?
              └─ Yes → `Collection`
                 (memoized + supports async mapping + chaining)
```

## Advanced Usage

### Batching

Group multiple signal updates, ensuring effects run only once after all changes are applied:

```js
import { batchSignalWrites, State } from '@zeix/cause-effect'

const a = new State(2)
const b = new State(3)

batchSignalWrites(() => {
  a.set(4)
  b.set(5)
})
```

### Cleanup

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks, for example to remove event listeners.

```js
import { State, createEffect } from '@zeix/cause-effect'

const user = new State({ name: 'Alice', age: 30 })
const greeting = () => `Hello ${user.get().name}!`
const cleanup = createEffect(() => {
	console.log(`${greeting()} You are ${user.get().age} years old`)
	return () => console.log('Cleanup') // Cleanup function
})

// When you no longer need the effect, execute the cleanup function
cleanup() // Logs: 'Cleanup' and unsubscribes from signal `user`

user.set({ name: 'Bob', age: 28 }) // Won't trigger the effect anymore
```

### Resource Management with Hooks

All signals support the `watch` hook for lazy resource management. Resources are only allocated when the signal is first accessed by an effect, and automatically cleaned up when no effects are watching:

```js
import { State, createEffect } from '@zeix/cause-effect'

const config = new State({ apiUrl: 'https://api.example.com' })

// Set up lazy resource management
config.on('watch', () => {
  console.log('Setting up API client...')
  const client = new ApiClient(config.get().apiUrl)
  
  // Return cleanup function
  return () => {
    console.log('Cleaning up API client...')
    client.disconnect()
  }
})

// Resource is created only when effect runs
const cleanup = createEffect(() => {
  console.log('API URL:', config.get().apiUrl)
})

// Resource is cleaned up when effect stops
cleanup()
```

This pattern is ideal for:
- Event listeners that should only be active when data is being watched
- Network connections that can be lazily established
- Expensive computations that should pause when not needed
- External subscriptions (WebSocket, Server-Sent Events, etc.)

### resolve()

Extract signal values:

```js
import { State, Memo, resolve } from '@zeix/cause-effect'

const name = new State('Alice')
const age = new Memo(() => 30)
const result = resolve({ name, age })

if (result.ok) console.log(result.values.name, result.values.age)
else if (result.pending) console.log('Loading...')
else console.error('Errors:', result.errors)
```

### match()

Pattern matching on resolved results for side effects:

```js
import { resolve, match } from '@zeix/cause-effect'

match(resolve({ name, age }), {
  ok: ({ name, age }) => document.title = `${name} (${age})`,
  nil: () => document.title = 'Loading...',
  err: errors => document.title = `Error: ${errors[0].message}`
})
```

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
console.log(changes.remove)   // { city: UNSET }
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
