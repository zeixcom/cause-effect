# Cause & Effect

Version 0.15.0

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses fine-grained reactivity with signals to create predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all dependent computations and effects, ensuring your UI stays in sync with your data without manual intervention.

### Core Concepts

- **State signals**: Hold values that can be directly modified: `state()`
- **Store signals**: Hold objects of nested reactive properties: `store()`
- **Computed signals**: Derive memoized values from other signals: `computed()`
- **Effects**: Run side effects when signals change: `effect()`

## Key Features

- ⚡ **Reactive States**: Automatic updates when dependencies change
- 🧩 **Composable**: Create a complex signal graph with a minimal API
- ⏱️ **Async Ready**: Built-in `Promise` and `AbortController` support
- 🛡️ **Error Handling**: Built-in helper functions for declarative error handling
- 🔧 **Helper Functions**: `resolve()` and `match()` for type-safe value extraction and pattern matching for suspense and error boundaries
- 🚀 **Performance**: Batching and efficient dependency tracking
- 📦 **Tiny**: Less than 3kB gzipped, zero dependencies

## Quick Start

```js
import { state, computed, effect } from '@zeix/cause-effect'

// 1. Create state
const user = state({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = computed(() => `Hello ${user.get().name}!`)

// 3. React to changes
effect(() => {
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

`state()` creates a mutable signal. Every signal has a `.get()` method to access its current value. State signals also provide `.set()` to directly assign a new value and `.update()` to modify the value with a function.

```js
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
effect(() => {
  console.log(count.get()) // logs '42'
})
count.set(24) // logs '24'
document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs '25', '26', and so on
```

### Store Signals

`store()` creates a mutable signal that holds an object with nested reactive properties. Each property automatically becomes its own signal with `.get()`, `.set()`, and `.update()` methods. Nested objects recursively become nested stores.

```js
import { store, effect } from '@zeix/cause-effect'

const user = store({
  name: 'Alice',
  age: 30,
  preferences: {
    theme: 'dark',
    notifications: true
  }
})

// Individual properties are reactive
effect(() => {
  console.log(`${user.name.get()} is ${user.age.get()} years old`)
})

// Nested properties work the same way
effect(() => {
  console.log(`Theme: ${user.preferences.theme.get()}`)
})

// Update individual properties
user.age.update(v => v + 1) // Logs: "Alice is 31 years old"
user.preferences.theme.set('light') // Logs: "Theme: light"

// Watch the entire store
effect(() => {
  console.log('User data:', user.get()) // Triggers on any nested change
})
```

#### Dynamic Properties

Stores support dynamic property addition and removal at runtime using the `add()` and `remove()` methods:

```js
import { store, effect } from '@zeix/cause-effect'

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

#### Store Events

Stores emit events when properties are added, changed, or removed. You can listen to these events using standard `addEventListener()`:

```js
import { store } from '@zeix/cause-effect'

const user = store({ name: 'Alice', age: 30 })

// Listen for property additions
user.addEventListener('store-add', (event) => {
  console.log('Added properties:', event.detail)
})

// Listen for property changes
user.addEventListener('store-change', (event) => {
  console.log('Changed properties:', event.detail)
})

// Listen for property removals
user.addEventListener('store-remove', (event) => {
  console.log('Removed properties:', event.detail)
})

// These will trigger the respective events:
user.add('email', 'alice@example.com') // Logs: "Added properties: { email: 'alice@example.com' }"
user.age.set(31)                       // Logs: "Changed properties: { age: 31 }"
user.remove('email')                   // Logs: "Removed properties: { email: UNSET }"
```

Events are also fired when using `set()` or `update()` methods on the entire store:

```js
// This will fire multiple events based on what changed
user.update(u => ({ ...u, name: 'Bob', city: 'New York' }))
// Logs: "Changed properties: { name: 'Bob' }"
// Logs: "Added properties: { city: 'New York' }"
```

**When to use stores vs state:**
- **Use `store()`** for objects with reactive properties that you want to access individually
- **Use `state()`** for primitive values or objects you replace entirely

### Computed Signals vs. Functions

#### When to Use Computed Signals

`computed()` creates a memoized read-only signal that automatically tracks dependencies and updates only when those dependencies change.

```js
import { state, computed, effect } from '@zeix/cause-effect'

const count = state(42)
const isEven = computed(() => !(count.get() % 2))
effect(() => console.log(isEven.get())) // logs 'true'
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
- **Use computed() when**:
  - The calculation is expensive
  - You need to share the result between multiple consumers
  - You're working with asynchronous operations
  - You need to track specific error states

#### Asynchronous Computations with Automatic Cancellation

`computed()` seamlessly handles asynchronous operations with built-in cancellation support. When used with an async function, it:

1. Provides an `abort` signal parameter you can pass to fetch or other cancelable APIs
2. Automatically cancels pending operations when dependencies change
3. Returns `UNSET` while the Promise is pending
4. Properly handles errors from failed requests

```js
import { state, computed, effect, resolve, match } from '@zeix/cause-effect'

const id = state(42)
const data = computed(async abort => {
  // The abort signal is automatically managed by the computed signal
  const response = await fetch(`/api/entries/${id.get()}`, { signal: abort })
  if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`)
  return response.json()
})

// Handle all possible states using resolve and match helpers
effect(() => {
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

**Note**: Always use `computed()` (not plain functions) for async operations to benefit from automatic cancellation, memoization, and state management.

## Effects and Error Handling

The `effect()` function supports both synchronous and asynchronous callbacks:

### Synchronous Effects

```js
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
effect(() => {
  console.log('Count changed:', count.get())
})
```

### Asynchronous Effects with AbortSignal

Async effect callbacks receive an `AbortSignal` parameter that automatically cancels when the effect re-runs or is cleaned up:

```js
import { state, effect } from '@zeix/cause-effect'

const userId = state(1)
effect(async (abort) => {
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
import { state, computed, effect, resolve, match } from '@zeix/cause-effect'

const userId = state(1)
const userData = computed(async (abort) => {
  const response = await fetch(`/api/users/${userId.get()}`, { signal: abort })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
})

effect(() => {
  match(resolve({ userData }), {
    ok: ({ userData: user }) => console.log('User loaded:', user),
    nil: () => console.log('Loading user...'),
    err: errors => console.error('Error loading user:', errors[0])
  })
})
```

The `resolve()` function extracts values from signals and returns a discriminated union result, while `match()` provides pattern matching for handling different states declaratively.

## DOM Updates

The `enqueue()` function allows you to schedule DOM updates to be executed on the next animation frame. It returns a `Promise`, which makes it easy to track when updates are applied or handle errors.

```js
import { enqueue } from '@zeix/cause-effect'

// Schedule a DOM update
enqueue(() => {
  document.getElementById('myElement').textContent = 'Updated content'
})
  .then(() => console.log('Update applied successfully'))
  .catch(error => console.error('Update failed:', error))
```

### Deduplication with Symbols

A powerful feature of `enqueue()` is deduplication, which ensures that only the most recent update for a specific operation is applied when multiple updates occur within a single animation frame. This is particularly useful for high-frequency events like typing, dragging, or scrolling.

Deduplication is controlled using JavaScript Symbols:

```js
import { state, effect, enqueue } from '@zeix/cause-effect'

// Define a signal and update it in an event handler
const name = state('')
document.querySelector('input[name="name"]').addEventListener('input', e => {
  name.set(e.target.value) // Triggers an update on every keystroke
})

// Define an effect to react to signal changes
effect(text => {
  // Create a Symbol for a specific update operation
  const NAME_UPDATE = Symbol('name-update')
  const text = name.get()
  const nameSpan = document.querySelector('.greeting .name')
  enqueue(() => {
    nameSpan.textContent = text
    return text
  }, NAME_UPDATE) // Using the Symbol for deduplication
    .then(result => console.log(`Name was updated to ${result}`))
    .catch(error => console.error('Failed to update name:', error))
})
```

In this example, as the user types "Jane" quickly, the intermediate values ('J', 'Ja', 'Jan') are deduplicated, and only the final value 'Jane' is applied to the DOM. Only the Promise for the final update is resolved.

### How Deduplication Works

When multiple `enqueue` calls use the same Symbol before the next animation frame:

1. Only the last call will be executed
2. Previous calls are superseded
3. Only the Promise of the last call will be resolved

This "last-write-wins" behavior optimizes DOM updates and prevents unnecessary work when many updates happen rapidly.

### Optional Deduplication

The deduplication Symbol is optional. When not provided, a unique Symbol is created automatically, ensuring the update is always executed:

```js
// No deduplication - always executed
enqueue(() => document.title = 'New Page Title')

// Create symbols for different types of updates
const COLOR_UPDATE = Symbol('color-update')
const SIZE_UPDATE = Symbol('size-update')

// These won't interfere with each other (different symbols)
enqueue(() => element.style.color = 'red', COLOR_UPDATE)
enqueue(() => element.style.fontSize = '16px', SIZE_UPDATE)

// This will replace the previous color update (same symbol)
enqueue(() => element.style.color = 'blue', COLOR_UPDATE)
```

Using Symbols for deduplication provides:

- Clear semantic meaning for update operations
- Type safety in TypeScript
- Simple mechanism to control which updates should overwrite each other
- Flexibility to run every update when needed

## Advanced Usage

### Batching Updates

Use `batch()` to group multiple signal updates, ensuring effects run only once after all changes are applied:

```js
import { state, computed, effect, batch, resolve, match } from '@zeix/cause-effect'

// State: define an array of State<number>
const signals = [state(2), state(3), state(5)]

// Compute the sum of all signals
const sum = computed(() => {
  const v = signals.reduce((total, signal) => total + signal.get(), 0)
  // Validate the result
  if (!Number.isFinite(v)) throw new Error('Invalid value')
  return v
})

// Effect: handle the result with error handling
effect(() => {
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

The Cause & Effect library is designed around these principles:

- **Minimal API**: Core primitives with a small but powerful interface
- **Automatic Dependency Tracking**: Fine-grained reactivity with minimal boilerplate
- **Performance-Focused**: Choose the right tool (functions vs computed) for optimal speed
- **Tree-Shakable**: Import only what you need for optimal bundle size
- **Flexible Integration**: Works with any JavaScript application or framework

### Cleanup Functions

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks, for example to remove event listeners.

```js
import { state, computed, effect } from '@zeix/cause-effect'

const user = state({ name: 'Alice', age: 30 })
const greeting = () => `Hello ${user.get().name}!`
const cleanup = effect(() => {
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
import { state, computed, resolve } from '@zeix/cause-effect'

const name = state('Alice')
const age = computed(() => 30)
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
