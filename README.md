# Cause & Effect

Version 0.9.1

**Cause & Effect** is a lightweight library for reactive state management with signals.

## Key Features

* **State Signals**: Define states that auto-track their dependencies and auto-notify them when the value changes. The set method
* **Computed Signals**: Derive computed signals from sync or async functions. Like state signals they auto-track their dependencies and auto-notify them when the computed value changes. With optional memoization, which is by default off for sync functions and on for async functions.
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

`State.of()` creates a new state signal. To access the current value of the signal use the `.get()` method. To update the value of the signal use the `.set()` method with a new value or an updater function of the form `(v: T) => T`.

```js
import { State, effect } from '@efflore/cause-effect'

const count = State.of(42)
effect(() => console.log(count.get())) // logs '42'
count.set(24) // logs '24'
document.querySelector('button.increment')
    .addEventListener('click', () => count.set(v => ++v))
// Click on button logs '25', '26', and so on
```

### Sync Computed Signal

`Computed.of()` creates a new computed signal. Computed signals are read-only and you can access the current resulting value using the `.get()` method.

```js
import { State, Computed, effect } from '@efflore/cause-effect'

const count = State.of(42)
const isOdd = Computed.of(() => count.get() % 2)
effect(() => console.log(isOdd.get())) // logs 'false'
count.set(24) // logs nothing because 24 is also an even number
document.querySelector('button.increment')
    .addEventListener('click', () => count.set(v => ++v))
// Click on button logs 'true', 'false', and so on
```

### Async Computed Signal

Async computed signals are as straight forward as their sync counterparts. Just create the computed signal with an async function.

```js
import { State, Computed, effect } from '@efflore/cause-effect'

const entryId = State.of(42)
const entryData = Computed.of(async () => {
    const id = entryId.get()
    if (null == id) return new ReferenceError('No entry ID provided')
    const response = await fetch(`/api/entry/${id}`)
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
