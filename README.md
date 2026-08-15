# Cause & Effect

**Cause & Effect** is a reactive state management primitives library for TypeScript. It provides the building blocks for complex, dynamic, composite, and asynchronous state in a unified signal graph.

It is deliberately **not a framework**. It has no opinions about rendering, persistence, or application architecture. It is a thin layer over JavaScript that gives you fine-grained reactivity with explicit guarantees.

## Documentation

- [Guide for Framework Developers](GUIDE.md) — conceptual differences, mental models, comparisons, and how to choose a construction call
- [Advanced Patterns & Recipes](RECIPES.md) — multi-step wizards, nested collections, batching, and lazy resources
- [Signal Graph Architecture](ARCHITECTURE.md) — core data structures, graph engine, and ownership
- [React Integration](REACT_INTEGRATION.md) — why it is out of scope and how you would build one
- [Migrating toward 2.0](MIGRATION-2.0.md) — bridge names, the codemod, and what the 2.0 break changes

## Who Is This For?

**Library authors** who need a reactive foundation and do not want to write their own primitives. External data feeds, async derivations, and keyed collections are handled inside one graph rather than bolted on.

**Experienced developers** writing framework-agnostic applications with explicit dependencies and type safety. You compose your own rendering layer; the library supplies the guarantees.

Cause & Effect is open source, built to power **Le Truc** (a Web Component library) by [Zeix AG](https://zeix.com).

## Value Types

Value types are indexed by shape and mutability. Construction is indexed by origin: `create*` yields the mutable type, `derive*` yields a readonly one. Every value type participates in the same dependency graph, with the same propagation, batching, and cleanup semantics.

| Type | Shape | Create with |
|------|-------|-------------|
| **Signal** | Single value | `createSignal()`, `deriveSignal()` |
| **MutableSignal** | Single value, writable | `createSignal()`, `createState()` |
| **List** | Keyed sequence (stable identity, per-item reactivity) | `deriveList()` |
| **MutableList** | Keyed sequence, writable | `createList()` |
| **Store** | Keyed record (proxy-based, per-property reactivity) | `deriveStore()` |
| **MutableStore** | Keyed record, writable | `createStore()` |
| **Slot** | Stable delegation for integration layers (swappable backing signal) | `createSlot()` |
| **Effect** | Side-effect sink (terminal) | `createEffect()` |

The narrow factories `createState`, `createMemo`, `createTask`, and `createSensor` construct the same shapes with one origin each; they exist so a bundle imports only the construction paths it uses. `deriveSignal` dispatches to them.

See [Choosing the Right Signal](GUIDE.md#choosing-the-right-signal) for the construction matrix.

## Design Principles

- **Explicit reactivity**: `.get()` calls track dependencies — the graph reflects the true dependency structure, with no hidden edges
- **Non-nullable types**: All signals enforce `T extends {}`, excluding `null` and `undefined` at the type level — trust returned values without null checks
- **Unified graph**: Composites (Store, List) and async derivations are first-class — every shape is derivable from every origin, and nothing derived exposes a setter
- **Tree-shakable, zero dependencies**: The synchronous core (`createState`, `createMemo`, `createEffect`) is less than 3 kB gzipped; the full library is around 8 kB

## Guarantees

1. Writes inside `batch()` merge. Effects run once, when the outermost batch exits.
2. Effects run synchronously. A write reaches its effects before the next statement, with no microtask and no scheduler tick.
3. Reads are glitch-free. You never observe a partially updated graph.
4. A write that compares equal propagates nothing to the entire downstream subtree.
5. `untrack()` reads a signal without creating an edge.
6. Cleanups run before every re-run and on disposal.
7. A scope disposes everything created inside it.

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

## API

### Signal

The single-value shape. `createSignal()` returns the writable `MutableSignal`; `deriveSignal()` returns a readonly `Signal` and picks the origin from its input.

```js
import { createSignal, deriveSignal, createEffect } from '@zeix/cause-effect'

const count = createSignal(42)

createEffect(() => console.log(count.get()))
count.set(24)

document.querySelector('.increment').addEventListener('click', () => {
  count.update(v => ++v)
})
```

**Derived signals** cover the other origins. A function input derives — synchronously or asynchronously, decided by the `async` keyword:

```js
const greeting = deriveSignal(() => `Hello ${user.get().name}!`)

const data = deriveSignal(async (_oldValue, abortSignal) => {
  const response = await fetch(`/api/users/${id.get()}`, { signal: abortSignal })
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
}, { initial: fallbackData })

id.set(2) // cancels the previous fetch automatically
```

A seed input plus a `watched` lifecycle is external push. The callback receives an `emit` function and runs lazily when an effect first reads the signal; its cleanup runs when nothing watches it:

```js
const mousePos = deriveSignal({ x: 0, y: 0 }, {
  watched: (emit) => {
    const handler = (e) => emit({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  },
})
```

`isPending(signal)` reports whether an async computation is in progress, and `abort(signal)` cancels it. Both are graph utilities, safe to call on any signal.

Use a derivation instead of a plain function when you need memoization, cancellation, or reactive pending and error states.

**Narrow factories.** `createState`, `createMemo`, `createTask`, and `createSensor` construct the same shape with one origin each — `createSignal` and `deriveSignal` dispatch to them. They exist for tree-shaking: a bundle that imports only `createState`, `createMemo`, and `createEffect` ships under 3 kB gzipped and pulls in no async machinery. `createTask(asyncFn, { initial? })` and `createSensor({ watched, initial?, equals?, guard? })` are the async and external-push singles.

**Reducer style**: a derivation callback receives the previous value, and `initial` seeds it.

```js
const counter = createMemo(prev => {
  switch (actions.get()) {
    case 'increment': return (prev ?? 0) + 1
    case 'decrement': return (prev ?? 0) - 1
    case 'reset': return 0
    default: return prev ?? 0
  }
}, { initial: 0 })
```

**Unset reads.** An async derivation without `initial` and an external-push signal without `initial` have no value before the first one arrives — `.get()` throws `UnsetSignalValueError`. When there is no natural default, omit `initial` and handle the unset case with [`match()`](#error-handling-with-match) and its `nil` handler.

**Observing mutable objects**: pass `{ equals: SKIP_EQUALITY }` when the reference stays the same but internal state changes, such as a DOM element watched by a `MutationObserver`.

**Tip**: for a simple derivation, a plain function is faster — `const isEven = () => !(count.get() % 2)`.

### Store

A reactive object where each property becomes its own signal. `createStore()` returns the mutable `MutableStore`; nested objects recursively become nested stores, so writes always have a target. A Proxy provides direct property access.

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

createEffect(() => console.log('User:', user.get())) // watch the full object
```

Access a property with `.byKey()`, or directly as `user.name` through the Proxy. Iterate with the reactive `.keys()` method to observe structural changes. Add and remove properties with `.add(key, value)` and `.remove(key)`.

**Derived stores** (`deriveStore`) produce the readonly `Store` from any origin — a sync function, an async function with `{ initial }`, or a seed record with `{ watched }` receiving `emit(patch)`. Each property is a signal that reads the source itself, so a write to one property of the source re-runs only the effects that read that property. A derived store does not recurse into nested values — a nested property is a plain signal of the nested value; compose `deriveStore` or `deriveList` on that property for deeper granularity.

### List

A reactive array with individually reactive items and stable keys. `createList()` returns the writable `MutableList`; each item becomes its own signal and keeps its identity through sorting and reordering.

```js
import { createList, createEffect } from '@zeix/cause-effect'

const items = createList(['banana', 'apple', 'cherry'])

createEffect(() => console.log(`First: ${items.at(0)?.get()}`))

items.add('date')
items.splice(1, 1, 'orange')
items.sort()
```

Access items with `.byKey()` or `.at()`. `.indexOfKey()` returns an item's current index, and `.keyAt()` returns the key at a position. Lists also provide `.keys()`, `.add()`, `.remove()`, `.replace()`, `.set()`, `.update()`, `.sort()`, `.splice()`, and a reactive `.length`. Unlike Store, deeply nested properties inside items do not become individual signals.

**Use `.replace(key, value)` to update an existing item.** `.byKey()` returns the item's own signal, and calling `.set()` on it is not guaranteed to reach sinks that read the list structurally through `.keys()`, `.length`, or the iterator. `.replace()` propagates to every sink regardless of how it reads the list.

Keys stay stable across reordering. Control key generation with `keyConfig`:

```js
// String prefix keys → 'item-0', 'item-1'
const items = createList(['banana', 'apple'], { keyConfig: 'item-' })

// Function-based keys
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: user => user.id }
)
```

To rebuild a list from inside a reactive handler, use `.set()` or `.update()` rather than a remove-then-add loop, which throws `EffectConvergenceError`. See [Rebuilding a List from a reactive handler](RECIPES.md#3-rebuilding-a-list-from-a-reactive-handler).

**Derived lists** (`deriveList`) produce the readonly `List` from any origin:

```js
// Whole-array derivation, sync or async — never unset, so `initial` is required
const users = deriveList(
  async (_prev, abortSignal) =>
    (await fetch(`/api/users?q=${query.get()}`, { signal: abortSignal })).json(),
  { initial: [], keyConfig: user => user.id }
)

// Per-item memoization: only the changed item's signal recomputes.
// The item callback may be async and receives an AbortSignal.
const details = deriveList(users, async (user, abortSignal) => {
  const response = await fetch(`/users/${user.id}`, { signal: abortSignal })
  return { ...user, details: await response.json() }
})

// External push: a seed array plus a watched lifecycle with granular changes
const feed = deriveList([], {
  watched: (emit) => {
    const ws = new WebSocket('/items')
    ws.onmessage = (e) => {
      const { add, change, remove } = JSON.parse(e.data)
      emit({ add, change, remove })
    }
    return () => ws.close()
  },
  keyConfig: item => item.id
})
```

The source of the per-item form can be any signal holding an array — including an async derivation, which is how a fetched array becomes a keyed sequence without an intermediate effect. `isPending(list)` distinguishes loading-empty from resolved-empty. Derived lists compose into pipelines — derive from a derived list, and each stage memoizes per item.

### Slot

A Slot is a forwarding layer to a swappable backing signal, and it holds no value of its own. It has no `update()` method, and `isMutableSignal()` excludes it. Slots serve integration layers such as custom element systems, where a property must switch its backing signal without breaking existing sinks. The slot object doubles as a property descriptor for `Object.defineProperty()`:

```js
import { createState, createMemo, createSlot, createEffect } from '@zeix/cause-effect'

const local = createState(1)
const slot = createSlot(local)

const target = {}
Object.defineProperty(target, 'value', slot)

createEffect(() => console.log(target.value)) // logs: 1

// Swap the backing signal — sinks re-run automatically
const derived = createMemo(() => 42)
slot.replace(derived) // logs: 42

// Write through to the current backing signal
slot.replace(local)
target.value = 10 // sets local to 10
```

`replace()` and `current()` live on the slot object, not on the installed property — keep the slot reference for later control. Writing through the property forwards to the delegated signal, and throws `ReadonlySignalError` if that signal is read-only.

### Effect

A side-effect sink that runs whenever the signals it reads change. Effects are terminal: they consume values and produce none. The returned function disposes the effect.

```js
import { createState, createEffect } from '@zeix/cause-effect'

const count = createState(42)

const cleanup = createEffect(() => {
  console.log(count.get())
  return () => console.log('Cleanup')
})

cleanup()
```

An effect callback may return a cleanup function, which runs before the effect re-runs and on disposal:

```js
createEffect(() => {
  const timer = setInterval(() => console.log(count.get()), 1000)
  return () => clearInterval(timer)
})
```

#### Error handling with match()

`match()` handles signal values declaratively inside an effect, including the pending and error states of a Task:

```js
import { createState, createTask, createEffect, match } from '@zeix/cause-effect'

const userId = createState(1)
const userData = createTask(async (_, abortSignal) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})

createEffect(() => {
  match(userData, {
    ok: user => console.log('User:', user),
    nil: () => console.log('Loading...'),
    err: error => console.error(error),
    stale: () => console.log('Refreshing...')
  })
})
```

**Handler routing precedence: `nil` > `err` > `stale` > `ok`.** `nil` fires when a signal has no value yet. `err` fires when a signal holds an error. `stale` fires when every signal has a value but an async derivation is re-computing. When `stale` is absent, `ok` runs instead.

**Handler bodies run in the caller's tracking scope.** `match()` calls its handlers synchronously inside the enclosing effect. Any signal read inside a handler becomes a tracked dependency of that effect, including implicit reads by collection methods such as `List.keys()` or `List.at()`. Wrap a handler body in `untrack()` to opt out.

**`stale` is a thunk and receives no arguments.** The retained value is withheld deliberately. The cleanup returned by `stale` runs before the next dispatch, which makes it the right place to reset a stale indicator:

```js
createEffect(() => match(userData, {
  ok: user => renderUser(user),
  nil: () => showSpinner(),
  stale: () => {
    dimContent()           // show stale indicator
    return clearDimmed     // called when ok or err fires next
  },
  err: e => showError(e)
}))
```

An `ok` or `err` handler may return a `Promise`, but must not write signal state. See [Async side effects in match()](RECIPES.md#4-async-side-effects-in-match) for the rules and the correct alternative.

### Utilities

Type predicates serve generic and library-author code. Each guard matches one shape — `isSignal` narrows to the single-value shape, and `isList`, `isStore`, and `isSlot` have their own. The `isMutable*` guards additionally require write access. `isSignalOfType(value, type)` is the primitive they are built on.

For "is this any reactive value at all", use the structural check — `typeof x?.get === 'function'` — rather than a guard. See [Utilities for generic code](GUIDE.md#utilities-for-generic-code).

## Advanced Usage

### Batching

`batch()` groups updates so effects run once, after every change is applied:

```js
import { batch, createState } from '@zeix/cause-effect'

const a = createState(2)
const b = createState(3)

batch(() => {
  a.set(4)
  b.set(5)
})
```

### Cleanup and scopes

`createEffect()` returns a cleanup function. Calling it severs the effect's edges and runs the cleanup returned by the callback, after which further writes no longer trigger it.

`createScope()` gives hierarchical cleanup for nested effects and resources, and returns one cleanup function:

```js
import { createState, createEffect, createScope } from '@zeix/cause-effect'

const dispose = createScope(() => {
  const count = createState(0)
  createEffect(() => console.log(count.get()))
  return () => console.log('Scope disposed')
})

dispose() // cleans up the effect and runs the returned cleanup
```

Pass `{ root: true }` when an external lifecycle owns the teardown, such as a web component's `disconnectedCallback`. Without it, a scope created inside a re-runnable effect is disposed on the next re-run.

### Watched callbacks

External-push signals — the seed forms of `deriveSignal`, `deriveList`, and `deriveStore`, and `createSensor` — take a `watched` callback in their options for lazy resource management. It runs when an effect first reads the signal, and its returned cleanup runs when no effect watches it. The callback receives an `emit` function shaped for the target: `emit(value)`, `emit(changes)`, or `emit(patch)`.

Store and List accept an optional `watched` callback in their options:

```js
const user = createStore({ name: 'Alice' }, {
  watched: () => {
    const ws = new WebSocket('/updates')
    return () => ws.close()
  }
})
```

Derivations with a function input also accept `watched`, but their callback receives an `invalidate` function that marks the signal dirty and triggers recomputation.

See [Lazy resources with watched callbacks](RECIPES.md#5-lazy-resources-with-watched-callbacks) for propagation through `deriveList()`, activation timing, and the `invalidate` pattern.

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2024 - 2026 [Zeix AG](https://zeix.com)
