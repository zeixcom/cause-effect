# Cause & Effect

Version 0.9.4

**Cause & Effect** is a lightweight library for reactive state management with signals.

## Key Features

* **State Signals**: Define states that auto-subscribe their dependencies and auto-notify them when the value changes. The set method
* **Computed Signals**: Derive computed signals from sync or async functions. Like state signals they auto-subscribe their dependencies and auto-notify them when the computed value changes. With optional memoization, which is by default off for sync functions and on for async functions.
* **Effects**: Trigger any effects when state or computed signals change.

## Installation

```bash
# with npm
npm install @efflore/cause-effect

# or with yarn
yarn add @efflore/cause-effect
```

## Basic Usage

### Single State Signal

`state()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or an updater function of the form `(v: T) => T`.

```js
import { state, effect } from '@efflore/cause-effect'

const count = state(42)
effect(() => console.log(count.get())) // logs '42'
count.set(24) // logs '24'
document.querySelector('button.increment')
    .addEventListener('click', () => count.set(v => ++v))
// Click on button logs '25', '26', and so on
```

### Sync Computed Signal

`computed()` creates a new computed signal. Computed signals are read-only and you can access the current resulting value using the `.get()` method.

```js
import { state, computed, effect } from '@efflore/cause-effect'

const count = state(42)
const isOdd = computed(() => count.get() % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment')
    .addEventListener('click', () => count.set(v => ++v))
// Click on button logs 'true', 'false', and so on
```

If you want to derive a computed signal from a single other signal you can use the `.map()` method on either `State` or `Computed`. This does the same as the snippet above:

```js
import { state, effect } from '@efflore/cause-effect'

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

**Caution**: You can't use the `.map()` method to create an async computed signal. And async computed signals will return `undefined` until the Promise is resolved.

```js
import { state, computed, effect } from '@efflore/cause-effect'

const entryId = state(42)
const entryData = computed(async () => {
    const response = await fetch(`/api/entry/${entryId.get()}`)
    if (!response.ok) return new Error(`Failed to fetch data: ${response.statusText}`)
    return response.json()
})
effect(() => {
    let data
    try {
        data = entryData.get()
    } catch (error) {
        console.error(error.message) // logs the error message if an error ocurred
        return
    }
    if (null == data) return // doesn't do anything while we are still waiting for the data
    document.querySelector('.entry h2').textContent = data.title
    document.querySelector('.entry p').textContent = data.description
})
// Updates h1 and p of the entry as soon as fetched data for entry becomes available
document.querySelector('button.next')
    .addEventListener('click', () => entryId.set(v => ++v))
// Click on button updates h1 and p of the entry as soon as fetched data for the next entry is loaded
```

### Effects and Batching

Effects run synchronously as soon as the signal updates. If you set multiple signals you can batch them together to ensure they are executed at the same time.

```js
import { state, computed, effect, batch } from '@efflore/cause-effect'

const a = state(3)
const b = state(4)
const sum = computed(() => a.get() + b.get())
effect(() => console.log(sum.get())) // logs '7'
document.querySelector('button.double-all')
    .addEventListener('click', () =>
        batch(() => {
            a.set(v => v * 2)
            b.set(v => v * 2)
        }
    ))
// Click on button logs '14' only once (instead of first '10' and then '14' without batch)
```