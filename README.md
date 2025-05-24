# Cause & Effect

Version 0.14.0

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses fine-grained reactivity with signals to create predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all dependent computations and effects, ensuring your UI stays in sync with your data without manual intervention.

### Core Concepts

- **State signals**: Hold values that can be directly modified
- **Computed signals**: Derive values from other signals (either `memo()` for sync or `task()` for async)
- **Effects**: Run side effects when signals change

## Key Features

- ⚡ **Reactive States**: Automatic updates when dependencies change
- 🧩 **Composable**: Chain signals with `.map()` and `.tap()`
- ⏱️ **Async Ready**: Built-in `Promise` and `AbortController` support
- 🛡️ **Error Handling**: Declare handlers for errors and unset states in effects
- 🚀 **Performance**: Batching and efficient dependency tracking
- 📦 **Tiny**: ~1kB gzipped, zero dependencies

## Quick Start

```js
import { state, memo, effect } from '@zeix/cause-effect'

// 1. Create state
const user = state({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = memo(() => `Hello ${user.get().name}!`)

// 3. React to changes
effect({
  signals: [user, greeting],
  ok: ({ age }, greet) => {
    console.log(`${greet} You are ${age} years old`)
  }
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

`state()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or `.update()` with an updater function of the form `(v: T) => T`.

Both `State` and `Computed` signals provide a `.tap()` method as a shorthand for creating an effect on a single signal.

```js
import { state } from '@zeix/cause-effect'

const count = state(42)
count.tap(v => {
  console.log(v) // logs '42'
})
count.set(24) // logs '24'
document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs '25', '26', and so on
```

### Computed Signals: memo() and task()

#### Synchronous Computations with memo()

`memo()` creates a new computed signal for synchronous computations. Computed signals are read-only and you can access the current resulting value using the `.get()` method.

```js
import { state, memo, effect } from '@zeix/cause-effect'

const count = state(42)
const isOdd = memo(() => count.get() % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs 'true', 'false', and so on
```

To derive a computed signal from a single existing signal, you can use the `.map()` method on either `State` or `Computed`. The following example demonstrates an alternative to the above approach:

```js
import { state } from '@zeix/cause-effect'

const count = state(42)
count.map(v => v % 2).tap(v => console.log(v)) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
// Click on button logs 'true', 'false', and so on
```

#### Asynchronous Computations with task()

`task()` creates computed signals for asynchronous operations. Like `memo()` but for async functions, it tracks dependencies and automatically recomputes when they change.

**Caution**: Task signals will return a Symbol `UNSET` until the Promise is resolved, which you can handle with the `nil` case in effects.

```js
import { state, task } from '@zeix/cause-effect'

const entryId = state(42)
const entryData = task(async abort => {
  const response = await fetch(`/api/entry/${entryId.get()}`, { signal: abort })
  if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`)
  return response.json()
})

// Display data when available
entryData.tap({
  ok: data => console.log('Data loaded:', data),
  nil: () => console.log('Loading...'),
  err: error => console.error('Error:', error)
})

// Move to next entry, automatically triggers a new fetch
document.querySelector('button.next').addEventListener('click', () => {
  entryId.update(v => ++v)
})
```

## Effects and Error Handling

### Creating Effects

Effects allow you to run side effects in response to signal changes. You can create effects using the `effect()` function or the `.tap()` method on signals.

### Error Handling Paths

Cause & Effect provides a robust error handling model with three distinct paths:

1. **Ok**: When a value is successfully computed and available
2. **Nil**: For loading/unset states (primarily with async `task()` operations)
3. **Err**: When an error occurs during computation

This allows you to handle all possible states declaratively:

```js
effect({
  signals: [data],
  ok: (value) => /* update UI */,
  nil: () => /* show loading */,
  err: (error) => /* show error */
})
```

Instead of using a single callback function, you can provide an object with an `ok` handler (required), plus optional `err` and `nil` handlers. Cause & Effect will automatically route to the appropriate handler based on the state of the signals.

For effects on a single signal, the `.tap()` method on both `State` and `Computed` signals provides a convenient shorthand. This is particularly useful for debugging:

```js
signal.tap({
  ok: v => console.log('Value:', v),
  nil: () => console.warn('Not ready'),
  err: e => console.error('Error:', e)
})
```

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
import { state, enqueue } from '@zeix/cause-effect'

// Create a Symbol for a specific update operation
const NAME_UPDATE = Symbol('name-update')

// Define a signal and update it in an event handler
const name = state('')
document.querySelector('input[name="name"]').addEventListener('input', e => {
  name.set(e.target.value) // Triggers an update on every keystroke
})

// Define an effect to react to signal changes
name.tap(text => {
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

Effects run synchronously as soon as source signals update. If you need to set multiple signals you can batch them together to ensure dependent effects are executed simultanously and only once.

```js
import { state, memo, batch } from '@zeix/cause-effect'

// State: define an array of State<number>
const signals = [state(2), state(3), state(5)]

// Compute the sum of all signals
const sum = memo(() => signals.reduce((total, signal) => total + signal.get(), 0))
  .map(v => {
    // Validate the result
    if (!Number.isFinite(v)) throw new Error('Invalid value')
    return v
  })

// Effect: handle the result
sum.tap({
  ok: v => console.log('Sum:', v),
  err: error => console.error('Error:', error)
})

// Batch: apply changes to all signals in a single transaction
document.querySelector('.double-all').addEventListener('click', () => {
  batch(() => {
    signals.forEach(signal => signal.update(v => v * 2))
  })
})
// Click on button logs '20' only once
// (instead of first '12', then '15' and then '20' without batch)

// Provoke an error - but no worries: it will be handled fine
signals[0].set(NaN)
```

This example showcases several powerful features of Cause & Effect:

1. **Composability and Declarative Computations**: Easily compose multiple signals into a single computed value, declaring how values should be calculated based on other signals.
2. **Automatic Dependency Tracking and Efficient Updates**: The library tracks dependencies between signals and computed values, ensuring efficient propagation of changes.
3. **Robust Error Handling**: Built-in error handling at computation level and reactive error management allow for graceful handling of unexpected situations.
4. **Performance Optimization through Batching**: Group multiple state changes to ensure dependent computations and effects run only once after all changes are applied.
5. **Flexibility and Integration**: Seamlessly integrates with DOM manipulation and event listeners, fitting into any JavaScript application or framework.

These principles enable developers to create complex, reactive applications with clear data flow, efficient updates, and robust error handling, while promoting code reuse and modularity.

### Cleanup Functions

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks, for example to remove event listeners.

```js
import { state, memo, effect } from '@zeix/cause-effect'

const user = state({ name: 'Alice', age: 30 })
const greeting = memo(() => `Hello ${user.get().name}!`)
const cleanup = effect({
  signals: [user, greeting],
  ok: ({ age }, greet) => {
    console.log(`${greet} You are ${age} years old`)
    return () => console.log('Cleanup') // Cleanup function
  }
})

// When you no longer need the effect, execute the cleanup function
cleanup() // Logs: 'Cleanup' and unsubscribes from signals `user` and `greeting`

user.set({ name: 'Bob', age: 28 }) // Won't trigger the effect anymore
```

### Automatic Abort Control

For asynchronous operations, the `task()` function automatically manages an `AbortController` to cancel pending promises when dependencies change. The function provides an `abort` signal parameter that you can pass to `fetch()` or other AbortController-aware APIs:

```js
import { state, task } from '@zeix/cause-effect'

const id = state(42)
const url = id.map(v => `https://example.com/api/entries/${v}`)
const data = task(async abort => {
  const response = await fetch(url.get(), { signal: abort })
  if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`)
  return response.json()
})
data.tap({
  ok: v => console.log('Value:', v),
  nil: () => console.warn('Not ready'),
  err: e => console.error('Error:', e)
})

// User switches to another entry
id.set(24) // Cancels the previous fetch request and starts a new one
```

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

Licence: [MIT](LICENCE.md)

(c) 2025 [Zeix AG](https://zeix.com)
