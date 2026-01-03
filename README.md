# Cause & Effect

<<<<<<< Updated upstream
Version 0.15.2
=======
Version 0.17.1
>>>>>>> Stashed changes

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses fine-grained reactivity with signals to create predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all dependent computations and effects, ensuring your UI stays in sync with your data without manual intervention.

### Core Concepts

- **State signals**: Hold values that can be directly modified: `createState()`
- **Store signals**: Hold objects of nested reactive properties: `createStore()`
<<<<<<< Updated upstream
- **Computed signals**: Derive memoized values from other signals: `createComputed()`
=======
- **List signals**: Create keyed lists with reactive items: `new List()`
- **Collection signals**: Read-only derived array transformations: `new DerivedCollection()`
>>>>>>> Stashed changes
- **Effects**: Run side effects when signals change: `createEffect()`

## Key Features

- ⚡ **Reactive States**: Automatic updates when dependencies change
- 🧩 **Composable**: Create a complex signal graph with a minimal API
- ⏱️ **Async Ready**: Built-in `Promise` and `AbortController` support
- 🛡️ **Error Handling**: Built-in helper functions for declarative error handling
- 🔧 **Helper Functions**: `resolve()` and `match()` for type-safe value extraction and pattern matching for suspense and error boundaries
- 🚀 **Performance**: Batching and efficient dependency tracking
- 📦 **Tiny**: Less than 3kB gzipped, tree-shakable, zero dependencies

## Quick Start

```js
import { createState, createComputed, createEffect } from '@zeix/cause-effect'

// 1. Create state
const user = createState({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = createComputed(() => `Hello ${user.get().name}!`)

// 3. React to changes
createEffect(() => {
  console.log(`${greeting.get()} You are ${user.get().age} years old`)
})

// 4. Update state
user.update(u => ({ ...u, age: 31 })) // Logs: "Hello Alice! You are 31 years old"
```

## Installation

```bash
# with npm
npm install @zeix/cause-effect

# or with bun
bun add @zeix/cause-effect
```

## Usage of Signals

### State Signals

`createState()` creates a mutable signal. Every signal has a `.get()` method to access its current value. State signals also provide `.set()` to directly assign a new value and `.update()` to modify the value with a function.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)
createEffect(() => {
  console.log(count.get()) // logs '42'
})
count.set(24) // logs '24'
document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs '25', '26', and so on
```

### Store Signals

`createStore()` creates a mutable signal that holds an object with nested reactive properties. Each property automatically becomes its own signal with `.get()`, `.set()`, and `.update()` methods. Nested objects recursively become nested stores.

```js
import { createStore, createEffect } from '@zeix/cause-effect'

const user = createStore({
  name: 'Alice',
  age: 30,
  preferences: {
    theme: 'dark',
    notifications: true
  }
})

// Individual properties are reactive
createEffect(() => {
  console.log(`${user.name.get()} is ${user.age.get()} years old`)
})

// Nested properties work the same way
createEffect(() => {
  console.log(`Theme: ${user.preferences.theme.get()}`)
})

// Update individual properties
user.age.update(v => v + 1) // Logs: "Alice is 31 years old"
user.preferences.theme.set('light') // Logs: "Theme: light"

// Watch the entire store
createEffect(() => {
  console.log('User data:', user.get()) // Triggers on any nested change
})
```

#### Dynamic Properties

Stores support dynamic property addition and removal at runtime using the `add()` and `remove()` methods:

```js
import { createStore, createEffect } from '@zeix/cause-effect'

const settings = store({ autoSave: true })

// Add new properties at runtime
settings.add('timeout', 5000)
console.log(settings.timeout.get()) // 5000

// Adding an existing property has no effect
settings.add('autoSave', false) // Ignored - autoSave remains true

// Remove properties
settings.remove('timeout')
console.log(settings.timeout) // undefined

// Removing non-existent properties has no effect
settings.remove('nonExistent') // Safe - no error thrown
```

The `add()` and `remove()` methods are optimized for performance:
- They bypass the full reconciliation process used by `set()` and `update()`
- They're perfect for frequent single-property additions/removals
- They trigger the same events and reactivity as other store operations

#### Array-like Stores

Stores created from arrays behave like arrays with reactive properties. They support duck-typing with length property, single-parameter `add()`, and efficient sorting:

```js
import { createStore, createEffect } from '@zeix/cause-effect'

const items = createStore(['banana', 'apple', 'cherry'])

// Duck-typing: behaves like an array
console.log(items.length) // 3
console.log(typeof items.length) // 'number'

// Individual items are reactive
createEffect(() => {
  console.log(`First item: ${items[0].get()}`)
})

// Single-parameter add() appends to end
items.add('date') // Adds at index 3
console.log(items.get()) // ['banana', 'apple', 'cherry', 'date']

// Efficient sorting preserves signal references
items.sort() // Default: string comparison
console.log(items.get()) // ['apple', 'banana', 'cherry', 'date']

// Custom sorting
items.sort((a, b) => b.localeCompare(a)) // Reverse alphabetical
console.log(items.get()) // ['date', 'cherry', 'banana', 'apple']
```

<<<<<<< Updated upstream
=======
List signals have stable unique keys for entries. This means that the keys for each item in the list will not change even if the items are reordered. Keys default to a string representation of an auto-incrementing number. You can customize keys by passing a prefix string or a function to derive the key from the entry value as the second argument to `new List()`:

```js
const items = new List(['banana', 'apple', 'cherry', 'date'], 'item-')

// Add returns the key of the added item
const orangeKey = items.add('orange')

// Sort preserves signal references
items.sort()
console.log(items.get()) // ['apple', 'banana', 'cherry', 'date', 'orange']

// Access items by key
console.log(items.byKey(orangeKey)) // 'orange'

const users = new List(
  [{ id: 'bob', name: 'Bob' }, { id: 'alice', name: 'Alice' }],
  user => user.id
)

// Sort preserves signal references
users.sort((a, b) => a.name.localeCompare(b.name)) // Alphabetical by name
console.log(users.get()) // [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }]

// Get current positional index for an item
console.log(users.indexOfKey('alice')) // 0

// Get key at index
console.log(users.keyAt(1)) // 'bob'
```

### Collection Signals

`new DerivedCollection()` creates read-only derived arrays that transform items from Lists with automatic memoization and async support:

```js
import { List, DerivedCollection, createEffect } from '@zeix/cause-effect'

// Source list
const users = new List([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
])

// Derived collection - transforms each user
const userProfiles = new DerivedCollection(users, user => ({
  ...user,
  displayName: `${user.name} (${user.role})`
}))

// Collections are reactive and memoized
createEffect(() => {
  console.log('Profiles:', userProfiles.get())
  // [{ id: 1, name: 'Alice', role: 'admin', displayName: 'Alice (admin)' }, ...]
})

// Individual items are computed signals
console.log(userProfiles.at(0).get().displayName) // 'Alice (admin)'

// Collections support async transformations
const userDetails = new DerivedCollection(users, async (user, abort) => {
  const response = await fetch(`/users/${user.id}`, { signal: abort })
  return { ...user, details: await response.json() }
})

// Collections can be chained
const adminProfiles = new DerivedCollection(userProfiles, profile => 
  profile.role === 'admin' ? profile : null
).filter(Boolean) // Remove null values
```

Collections support access by index or key:

```js
// Access by index or key (read-only)
const firstProfile = userProfiles.at(0) // Returns computed signal
const profileByKey = userProfiles.byKey('user1') // Access by stable key

// Array methods work
console.log(userProfiles.length) // Reactive length
for (const profile of userProfiles) {
  console.log(profile.get()) // Each item is a computed signal
}

// Lists can derive collections directly
const userSummaries = users.deriveCollection(user => ({
  id: user.id,
  summary: `${user.name} is a ${user.role}`
}))
```

#### When to Use Collections vs Lists

- **Use `new List()`** for mutable arrays where you add, remove, sort, or modify items
- **Use `new DerivedCollection()`** for read-only transformations, filtering, or async processing of Lists
- **Chain collections** to create multi-step data pipelines with automatic memoization

>>>>>>> Stashed changes
#### Store Change Notifications

Stores emit notifications (sort of light-weight events) when properties are added, changed, or removed. You can listen to these notications using the `.on()` method:

```js
import { createStore } from '@zeix/cause-effect'

const user = createStore({ name: 'Alice', age: 30 })

// Listen for property additions
const offAdd = user.on('add', (added) => {
  console.log('Added properties:', added)
})

// Listen for property changes
const offChange = user.on('change', (changed) => {
  console.log('Changed properties:', changed)
})

// Listen for property removals
const offRemove = user.on('remove', (removed) => {
  console.log('Removed properties:', removed)
})

// These will trigger the respective notifications:
user.add('email', 'alice@example.com') // Logs: "Added properties: { email: 'alice@example.com' }"
user.age.set(31)                       // Logs: "Changed properties: { age: 31 }"
user.remove('email')                   // Logs: "Removed properties: { email: UNSET }"

// Listen for sort notifications (useful for UI animations)
const items = createStore(['banana', 'apple', 'cherry'])
items.sort((a, b) => b.localeCompare(a)) // Reverse alphabetical
const offSort = items.on('sort', (newOrder) => {
  console.log('Items reordered:', newOrder) // ['2', '1', '0']
})
```

Notifications are also fired when using `set()` or `update()` methods on the entire store:

```js
// This will fire multiple notifications based on what changed
user.update(u => ({ ...u, name: 'Bob', city: 'New York' }))
// Logs: "Changed properties: { name: 'Bob' }"
// Logs: "Added properties: { city: 'New York' }"
```

To stop listening to notifications, call the returned cleanup function:

```js
offAdd() // Stops listening to add notifications
offChange() // Stops listening to change notifications
offRemove() // Stops listening to remove notifications
offSort() // Stops listening to sort notifications
```

<<<<<<< Updated upstream
**When to use stores vs states:**
- **Use `createStore()`** for objects with reactive properties that you want to access individually
- **Use `createState()`** for primitive values or objects you replace entirely
=======
### Ref Signals

`new Ref()` creates a signal that holds a reference to an external object that can change outside the reactive system. Unlike other signals that automatically detect changes, `Ref` signals require manual notification via `.notify()` when the referenced object changes.

**Important**: Don't use `Ref` for objects you can manage with other signals:
- **Primitives & arrays** → Use `new State()` (automatically detects changes via `isEqual()`)
- **Plain objects** → Use `createStore()` (granular reactivity per property)
- **Arrays with keys** → Use `new List()` (structured array operations)

```js
import { createEffect, Ref } from '@zeix/cause-effect'

// Good: External DOM element that changes outside reactive system
const elementRef = new Ref(document.getElementById('status'))

createEffect(() => {
  const el = elementRef.get()
  console.log(`Element classes: ${el.className}`)
})

// When DOM changes externally (via other libraries, user interaction, etc.)
elementRef.notify() // Manually trigger reactivity
```

#### When to Use

Use `Ref` specifically for **non-reactive objects** that change externally:

- **DOM elements**
- **Third-party objects** (Map, Set, Date, WebSocket, Database connections)
- **External APIs** that mutate objects directly
- **Server resources** where you can detect but not control changes

```js
// Good: Map that changes via external API calls
const cache = new Map([['user1', { name: 'Alice' }]])
const cacheRef = new Ref(cache)

createEffect(() => {
  const map = cacheRef.get()
  console.log(`Cache size: ${map.size}`)
})

// When external API updates the cache
cache.set('user2', { name: 'Bob' })
cacheRef.notify() // Manual notification required

// Bad: Use State instead for plain objects
// const config = { host: 'localhost' }  // Use new State(config)
// const configRef = new Ref(config)     // Don't do this!
```
>>>>>>> Stashed changes

### Computed Signals

#### When to Use Computed Signals

`createComputed()` creates a memoized read-only signal that automatically tracks dependencies and updates only when those dependencies change.

```js
import { createState, createComputed, createEffect } from '@zeix/cause-effect'

const count = createState(42)
const isEven = createComputed(() => !(count.get() % 2))
createEffect(() => console.log(isEven.get())) // logs 'true'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs 'false', 'true', and so on
```

#### When to Use Functions

**Performance tip**: For simple derivations, plain functions often outperform computed signals:

```js
// More performant for simple calculations
const isEven = () => !(count.get() % 2)
```

**When to use which approach:**

- **Use functions when**: The calculation is simple, inexpensive, or called infrequently
- **Use createComputed() when**:
  - The calculation is expensive
  - You need to share the result between multiple consumers
  - You're working with asynchronous operations
  - You need to track specific error states

#### Asynchronous Computations with Automatic Cancellation

`createComputed()` seamlessly handles asynchronous operations with built-in cancellation support. When used with an async function, it:

1. Provides an `abort` signal parameter you can pass to fetch or other cancelable APIs
2. Automatically cancels pending operations when dependencies change
3. Returns `UNSET` while the Promise is pending
4. Properly handles errors from failed requests

```js
import { createState, createComputed, createEffect, resolve, match } from '@zeix/cause-effect'

const id = createState(42)
const data = createComputed(async abort => {
  // The abort signal is automatically managed by the computed signal
  const response = await fetch(`/api/entries/${id.get()}`, { signal: abort })
  if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`)
  return response.json()
})

// Handle all possible states using resolve and match helpers
createEffect(() => {
  match(resolve({ data }), {
    ok: ({ data: json }) => console.log('Data loaded:', json),
    nil: () => console.log('Loading...'),
    err: errors => console.error('Error:', errors[0])
  })
})

// When id changes, the previous request is automatically canceled
document.querySelector('button.next').addEventListener('click', () => {
  id.update(v => ++v)
})
```

**Note**: Always use `createComputed()` (not plain functions) for async operations to benefit from automatic cancellation, memoization, and state management.

## Effects and Error Handling

The `createEffect()` function supports both synchronous and asynchronous callbacks:

### Synchronous Effects

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)
createEffect(() => {
  console.log('Count changed:', count.get())
})
```

### Asynchronous Effects with AbortSignal

Async effect callbacks receive an `AbortSignal` parameter that automatically cancels when the effect re-runs or is cleaned up:

```js
import { createState, createEffect } from '@zeix/cause-effect'

const userId = createState(1)
createEffect(async (abort) => {
  try {
    const response = await fetch(`/api/users/${userId.get()}`, { signal: abort })
    const user = await response.json()
    console.log('User loaded:', user)
  } catch (error) {
    if (!abort.aborted) {
      console.error('Failed to load user:', error)
    }
  }
})
```

### Error Handling with Helper Functions

For more sophisticated error handling, use the `resolve()` and `match()` helper functions:

```js
import { createState, createEffect, resolve, match } from '@zeix/cause-effect'

const userId = createState(1)
const userData = createEffect(async (abort) => {
  const response = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
})

createEffect(() => {
  match(resolve({ userData }), {
    ok: ({ userData: user }) => console.log('User loaded:', user),
    nil: () => console.log('Loading user...'),
    err: errors => console.error('Error loading user:', errors[0])
  })
})
```

The `resolve()` function extracts values from signals and returns a discriminated union result, while `match()` provides pattern matching for handling different states declaratively.

## Advanced Usage

### Batching Updates

Use `batch()` to group multiple signal updates, ensuring effects run only once after all changes are applied:

```js
import {
  createState,
  createComputed,
  createEffect,
  batch,
  resolve,
  match
} from '@zeix/cause-effect'

// State: define an Array<State<number>>
const signals = [createState(2), createState(3), createState(5)]

// Compute the sum of all signals
const sum = createComputed(() => {
  const v = signals.reduce((total, signal) => total + signal.get(), 0)
  // Validate the result
  if (!Number.isFinite(v)) throw new Error('Invalid value')
  return v
})

// Effect: handle the result with error handling
createEffect(() => {
  match(resolve({ sum }), {
    ok: ({ sum: v }) => console.log('Sum:', v),
    err: errors => console.error('Error:', errors[0])
  })
})

// Batch: apply changes to all signals in a single transaction
document.querySelector('.double-all').addEventListener('click', () => {
  batch(() => {
    signals.forEach(signal => {
      signal.update(v => v * 2)
    })
  })
})
// Click on button logs '20' only once
// (instead of first '12', then '15' and then '20' without batch)

// Provoke an error - but no worries: it will be handled fine
signals[0].set(NaN)
```

### Cleanup Functions

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks, for example to remove event listeners.

```js
import { createState, createComputed, createEffect } from '@zeix/cause-effect'

const user = createState({ name: 'Alice', age: 30 })
const greeting = () => `Hello ${user.get().name}!`
const cleanup = createEffect(() => {
	console.log(`${greeting()} You are ${user.get().age} years old`)
	return () => console.log('Cleanup') // Cleanup function
})

// When you no longer need the effect, execute the cleanup function
cleanup() // Logs: 'Cleanup' and unsubscribes from signal `user`

user.set({ name: 'Bob', age: 28 }) // Won't trigger the effect anymore
```

## Helper Functions

### `resolve()` - Extract Signal Values

The `resolve()` function extracts values from multiple signals and returns a discriminated union result:

```js
import { createState, createComputed, resolve } from '@zeix/cause-effect'

const name = createState('Alice')
const age = createComputed(() => 30)
const result = resolve({ name, age })

if (result.ok) {
  console.log(result.values.name, result.values.age) // Type-safe access
} else if (result.pending) {
  console.log('Loading...')
} else {
  console.error('Errors:', result.errors)
}
```

### `match()` - Pattern Matching for Side Effects

The `match()` function provides pattern matching on resolve results for side effects:

```js
import { resolve, match } from '@zeix/cause-effect'

match(resolve({ name, age }), {
  ok: ({ name, age }) => document.title = `${name} (${age})`,
  nil: () => document.title = 'Loading...',
  err: errors => document.title = `Error: ${errors[0].message}`
})
```

### `diff()` - Compare Object Changes

The `diff()` function compares two objects and returns detailed information about what changed:

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

This function is used internally by stores to efficiently determine what changed and emit appropriate events.

### `isEqual()` - Deep Equality Comparison

The `isEqual()` function performs deep equality comparison with circular reference detection:

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

Both `diff()` and `isEqual()` include built-in protection against circular references and will throw a `CircularDependencyError` if cycles are detected.

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2025 [Zeix AG](https://zeix.com)
