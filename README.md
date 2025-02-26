# Cause & Effect

Version 0.11.0

**Cause & Effect** is a lightweight, reactive state management library for JavaScript applications. It uses the concept of signals to create a predictable and efficient data flow in your app.

## What is Cause & Effect?

**Cause & Effect** provides a simple way to manage application state using signals. Signals are containers for values that can change over time. When a signal's value changes, it automatically updates all parts of your app that depend on it, ensuring your UI stays in sync with your data.

## Why Cause & Effect?

- **Simplicity**: Easy to learn and use, with a small API surface.
- **Performance**: Efficient updates that only recompute what's necessary.
- **Type Safety**: Full TypeScript support for robust applications.
- **Flexibility**: Works well with any UI framework or vanilla JavaScript.
- **Lightweight**: Around 1kB gzipped over the wire.

## Key Features

- 🚀 Efficient state management with automatic dependency tracking
- ⏳ Built-in support for async operations
- 🧠 Memoized computed values
- 🛡️ Type-safe and non-nullable signals
- 🎭 Declarative error and pending state handling

## Quick Example

```js
import { state, computed, effect } from '@zeix/cause-effect'

// Create a state signal
const count = state(0)

// Create a computed signal
const doubleCount = computed(() => count.get() * 2)

// Create an effect
effect(() => {
    console.log(`Count: ${count.get()}, Double: ${doubleCount.get()}`)
})

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

## Basic Usage

### Single State Signal

`state()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or `.update()` with an updater function of the form `(v: T) => T`.

```js
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
effect(() => console.log(count.get())) // logs '42'
count.set(24) // logs '24'
document.querySelector('button.increment')
    .addEventListener('click', () => count.update(v => ++v))
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
document.querySelector('button.increment')
    .addEventListener('click', () => count.update(v => ++v))
// Click on button logs 'true', 'false', and so on
```

If you want to derive a computed signal from a single other signal you can use the `.map()` method on either `State` or `Computed`. This does the same as the snippet above:

```js
import { state, effect } from '@zeix/cause-effect'

const count = state(42)
const isOdd = count.map(v => v % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment')
    .addEventListener('click', () => count.set(v => ++v))
// Click on button logs 'true', 'false', and so on
```

### Async Computed Signal

Async computed signals are as straight forward as their sync counterparts. Just create the computed signal with an async function.

**Caution**: You can't use the `.map()` method to create an async computed signal. And async computed signals will return a Symbol `UNSET` until the Promise is resolved.

```js
import { state, computed, effect } from '@zeix/cause-effect'

const entryId = state(42)
const entryData = computed(async () => {
    const response = await fetch(`/api/entry/${entryId.get()}`)
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

### Effects and Batching

Effects run synchronously as soon as source signals update. If you need to set multiple signals you can batch them together to ensure dependents are executed only once.

```js
import { state, computed, effect, batch } from '@zeix/cause-effect'

const a = state(3)
const b = state(4)
const sum = computed(() => a.get() + b.get())
effect(() => console.log(sum.get())) // logs '7'
document.querySelector('button.double-all')
    .addEventListener('click', () =>
        batch(() => {
            a.update(v => v * 2)
            b.update(v => v * 2)
        }
    ))
// Click on button logs '14' only once (instead of first '10' and then '14' without batch)
```