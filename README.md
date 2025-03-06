# Cause & Effect

Version 0.12.3

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses the concept of signals to create a predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all parts of your app that depend on it, ensuring your UI stays in sync with your data.

## Why Cause & Effect?

- **Simplicity**: Easy to learn and use, with a small API surface.
- **Performance**: Efficient updates that only recompute what's necessary.
- **Type Safety**: Full TypeScript support for robust applications.
- **Flexibility**: Works well with any UI framework or vanilla JavaScript.
- **Lightweight**: Dependency-free, only 1kB gzipped over the wire.

## Key Features

- 🚀 Efficient state management with automatic dependency tracking
- ⏳ Built-in support for async operations
- 🧠 Memoized computed values
- 🛡️ Type-safe and non-nullable signals
- 🎭 Declarative error and pending state handling

## Quick Example

```js
import { state, effect } from '@zeix/cause-effect'

// Create a state signal
const count = state(0)

// Create a computed signal
const doubleCount = count.map(v => v * 2)

// Create an effect
effect((c, d) => {
    console.log(`Count: ${c}, Double: ${d}`)
}, count, doubleCount)

// Update the state
count.set(5) // Logs: "Count: 5, Double: 10"
```

## Installation

```bash
# with npm
npm install @zeix/cause-effect

# or with bun
bun add @zeix/cause-effect
```

## Usage

### Single State Signal

`state()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or `.update()` with an updater function of the form `(v: T) => T`.

```js
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
effect(() => console.log(count.get())) // logs '42'
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
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
const isOdd = count.map(v => v % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
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
import { state, effect } from '@zeix/cause-effect'

const entryId = state(42)
const entryData = entryId.map(async id => {
    const response = await fetch(`/api/entry/${id}`)
    if (!response.ok) return new Error(`Failed to fetch data: ${response.statusText}`)
    return response.json()
})
// Updates h1 and p of the entry as soon as fetched data for entry becomes available
document.querySelector('button.next')
    .addEventListener('click', () => entryId.update(v => ++v))
// Click on button updates h1 and p of the entry as soon as fetched data for the next entry is loaded
```

### Handling Unset Values and Errors in Effects

Computations can fail and throw errors. Promises may not have resolved yet when you try to access their value. **Cause & Effect makes it easy to deal with errors and unresolved async functions.** Computed functions will catch errors and re-throw them when you access their values.

**Effects** are where you handle different cases:

```js
const h2 = document.querySelector('.entry h2')
const p = document.querySelector('.entry p')
effect({

    // Handle pending states while fetching data
    nil: () => {
        h2.textContent = 'Loading...'
    },

    // Handle errors
    err: (error) => {
        h2.textContent = 'Oops, Something Went Wrong'
        p.textContent = error.message
    },

    // Happy path, data is entryData.get()
    ok: (data) => {
        h2.textContent = data.title
        p.textContent = data.description
    }
}, entryData) // assuming an `entryData` async computed signal as in the example above
```

Instead of a single callback function, provide an object with `ok` (required), `err` and `nil` keys (both optional) and Cause & Effect will take care of anything that might go wrong with the listed signals in the rest parameters of `effect()`.

If you want an effect based on a single signal, there's a shorthand too: The `.match()` method on either `State` or `Computed`. You can use it for easy debugging, for example:

```js
signal.match({
	ok: v => console.log('Value:', v),
	nil: () => console.warn('Not ready'),
	err: e => console.error('Error:', e)
})
```

### Effects and Batching

Effects run synchronously as soon as source signals update. If you need to set multiple signals you can batch them together to ensure dependents are executed only once.

```js
import { state, computed, batch } from '@zeix/cause-effect'

// State: define an array of State<number>
const signals = [state(2), state(3), state(5)]

// Computed: derive a calculation ...
const sum = computed(
	(...values) => values.reduce((total, v) => total + v, 0),
	...signals
).map(v => { // ... perform validation and handle errors
	if (!Number.isFinite(v)) throw new Error('Invalid value')
	return v
})

// Effect: switch cases for the result
sum.match({
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

### Effects and DOM Updates

The `enqueue()` function allows you to schedule DOM updates to be executed on the next animation frame. This function returns a `Promise`, which makes it easy to detect when updates are applied or if they fail.

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
import { enqueue } from '@zeix/cause-effect'

// Define a signal and update it in an event handler
const name = state('')
document.querySelector('input[name="name"]').addEventListener('input', e => {
	state.set(e.target.value) // Triggers an update on every keystroke
})

// Define an effect to react to signal changes
effect(text => {
	const nameSpan = document.querySelector('.greeting .name')
	enqueue(() => {
		nameSpan.textContent = text
		return text
	}, [nameSpan, 'setName']) // For deduplication
		.then(result => console.log(`Name was updated to ${result}`))
		.catch(error => console.error('Failed to update name:', error))
}, name)
```

In this example, as the user types in the input field only 'Jane' will be applied to the DOM. 'J', 'Ja', 'Jan' were superseded by more recent updates and deduplicated (if typing was fast enough).

When multiple `enqueue` calls are made with the same deduplication key before the next animation frame, only the last call will be executed. Previous calls are superseded and their Promises will not be resolved or rejected. This "last-write-wins" behavior ensures that only the most recent update is applied, which is typically desirable for UI updates and state changes.