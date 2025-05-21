# Cause & Effect

Version 0.13.2

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses the concept of signals to create a predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all parts of your app that depend on it, ensuring your UI stays in sync with your data.

## Key Features

- ⚡ **Reactive States**: Automatic updates when dependencies change
- 🧩 **Composable**: Chain signals with `.map()` and `.tap()`
- ⏱️ **Async Ready**: Built-in `Promise` and `AbortController` support
- 🛡️ **Error Handling**: Declare handlers for errors and unset states in effects
- 🚀 **Performance**: Batching and efficient dependency tracking
- 📦 **Tiny**: ~1kB gzipped, zero dependencies

## Quick Start

```js
import { state, computed, effect } from '@zeix/cause-effect'

// 1. Create state
const user = state({ name: 'Alice', age: 30 })

// 2. Create computed values
const greeting = computed(() => `Hello ${user.get().name}!`)

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

### Single State Signal

`state()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or `.update()` with an updater function of the form `(v: T) => T`.

The `.tap()` method on either `State` or `Computed` is a shorthand for creating an effect on the signal.

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

### Sync Computed Signal

`computed()` creates a new computed signal. Computed signals are read-only and you can access the current resulting value using the `.get()` method.

```js
import { state, computed, effect } from '@zeix/cause-effect'

const count = state(42)
const isOdd = computed(() => count.get() % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment').addEventListener('click', () => {
	count.update(v => ++v)
})
// Click on button logs 'true', 'false', and so on
```

If you want to derive a computed signal from a single other signal you can use the `.map()` method on either `State` or `Computed`. This does the same as the snippet above:

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

### Async Computed Signal

Async computed signals are as straight forward as their sync counterparts. Just create the computed signal with an async function.

**Caution**: Async computed signals will return a Symbol `UNSET` until the Promise is resolved.

```js
import { state } from '@zeix/cause-effect'

const entryId = state(42)
const entryData = entryId.map(async id => {
    const response = await fetch(`/api/entry/${id}`)
    if (!response.ok) return new Error(`Failed to fetch data: ${response.statusText}`)
    return response.json()
})
// Updates h1 and p of the entry as soon as fetched data for entry becomes available
document.querySelector('button.next').addEventListener('click', () => {
	entryId.update(v => ++v)
})
// Click on button updates h1 and p of the entry as soon as fetched data for the next entry is loaded
```

## Error Handling

Cause & Effect provides three paths for robust error handling:

1. **Ok**: Value is available
2. **Nil**: Loading/Unset state (especially for async)
3. **Err**: Error occurred

Handle all cases declaratively:

```js
effect({
    signals: [data],
    ok: (value) => /* update UI */,
    nil: () => /* show loading */,
    err: (error) => /* show error */
})
```

Instead of a single callback function, provide an object with `ok` (required), `err` and `nil` keys (both optional) and Cause & Effect will take care of anything that might go wrong with the listed signals in the rest parameters of `effect()`.

If you want an effect based on a single signal, there's a shorthand too: The `.tap()` method on either `State` or `Computed`. You can use it for easy debugging, for example:

```js
signal.tap({
	ok: v => console.log('Value:', v),
	nil: () => console.warn('Not ready'),
	err: e => console.error('Error:', e)
})
```

## DOM Updates

The `enqueue()` function allows you to schedule DOM updates to be executed on the next animation frame. It returns a `Promise`, which makes it easy to detect when updates are applied or if they fail.

```js
import { enqueue } from '@zeix/cause-effect'

// Schedule a DOM update
enqueue(() => {
  document.getElementById('myElement').textContent = 'Updated content'
})
  .then(() => console.log('Update applied successfully'))
  .catch(error => console.error('Update failed:', error))
```

You can also use the deduplication feature to ensure that only the latest update for a specific element and operation is applied:

```js
import { state, effect, enqueue } from '@zeix/cause-effect'

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
	}, [nameSpan, 'setName']) // For deduplication
		.then(result => console.log(`Name was updated to ${result}`))
		.catch(error => console.error('Failed to update name:', error))
})
```

In this example, as the user types in the input field only 'Jane' will be applied to the DOM. 'J', 'Ja', 'Jan' were superseded by more recent updates and deduplicated (if typing was fast enough).

When multiple `enqueue` calls are made with the same deduplication key before the next animation frame, only the last call will be executed. Previous calls are superseded and their Promises will not be resolved or rejected. This "last-write-wins" behavior ensures that only the most recent update is applied, which is typically desirable for UI updates and state changes.

## Advanced Usage

### Batching

Effects run synchronously as soon as source signals update. If you need to set multiple signals you can batch them together to ensure dependent effects are executed simultanously and only once.

```js
import { state, computed, batch } from '@zeix/cause-effect'

// State: define an array of State<number>
const signals = [state(2), state(3), state(5)]

// Computed: derive a calculation ...
const sum = computed({
	signals,
	ok: (...values) => values.reduce((total, v) => total + v, 0),
}).map(v => { // ... perform validation and handle errors
	if (!Number.isFinite(v)) throw new Error('Invalid value')
	return v
})

// Effect: switch cases for the result
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

### Cleanup

Effects return a cleanup function. When executed, it will unsubscribe from signals and run cleanup functions returned by effect callbacks, for example to remove event listeners.

```js
import { state, computed, effect } from '@zeix/cause-effect'

const user = state({ name: 'Alice', age: 30 })
const greeting = computed(() => `Hello ${user.get().name}!`)
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

### Abort Controller

For asynchronous computed signals, Cause & Effect uses an `AbortController` to cancel pending promises when source signals update. You can use the `abort` parameter in `computed()` callbacks and pass it on to other AbortController aware APIs like `fetch()`:

```js
import { state, computed } from '@zeix/cause-effect'

const id = state(42)
const url = id.map(v => `https://example.com/api/entries/${v}`)
const data = computed(async abort => {
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
id.set(24) // Cancels or ignores the previous fetch request and starts a new one
```

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

Licence: [MIT](LICENCE.md)

(c) 2025 [Zeix AG](https://zeix.com)
