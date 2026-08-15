# Copilot Instructions for Cause & Effect

## Project Overview

Cause & Effect is a reactive state management library for JavaScript and TypeScript. It is built on a linked graph of source and sink nodes (`src/graph.ts`). Value types are indexed by shape and mutability; construction is indexed by origin (`create*` → mutable, `derive*` → readonly).

`CONTEXT.md` at the repo root defines the domain vocabulary. Use the approved term for each concept and avoid the listed synonyms.

## Core Architecture

### Graph Engine (`src/graph.ts`)
- **Nodes**: StateNode (source + equality), MemoNode (source + sink), TaskNode (source + sink + async), EffectNode (sink + owner)
- **Edges**: Doubly-linked list connecting sources to sinks
- **Operations**: `link()` creates edges, `propagate()` flags sinks dirty, `flush()` runs queued effects, `batch()` defers the flush
- **Flags**: FLAG_CLEAN, FLAG_CHECK, FLAG_DIRTY, FLAG_RUNNING, FLAG_RELINK — the two-level flag state machine
- **Convergence**: `flush()` drains in passes, bounded by `MAX_FLUSH_PASSES`; exceeding it throws `EffectConvergenceError`

### Value Types (six, indexed by shape × mutability)
- **Signal** (`deriveSignal`): Readonly single value — sync derivation, async derivation, or external push (`createSignal` returns the mutable extension)
- **MutableSignal** (`createSignal`, `createState`): Writable single value (`get`, `set`, `update`)
- **List** (`deriveList`): Readonly keyed sequence with per-item memoization. Stable keys survive sorting; `byKey()`/`at()` create no graph edge
- **MutableList** (`createList`): Writable keyed sequence (`set`, `update`, `add`, `remove`, `replace`, `sort`, `splice`)
- **Store** (`deriveStore`): Readonly keyed record, proxy-based, per-property reactivity
- **MutableStore** (`createStore`): Writable keyed record (`set`, `update`, `add`, `remove`); nested records become nested stores, nested arrays become lists

### Orthogonal Primitives
- **Effect** (`createEffect`): Terminal sink that runs side effects. Runs synchronously. Write outward (DOM, network, storage) — never write a derived value from inside an effect
- **Slot** (`createSlot`): Forwarding layer to a swappable backing signal, for integration layers such as property descriptors and custom elements. Not an event bus, and has no `update()`

### Construction Routing ("you have Y, you want X → call Z")

| You have | Single value | Keyed sequence | Keyed record |
|---|---|---|---|
| Value you own | `createSignal(value)` | `createList(array)` | `createStore(record)` |
| Other signals, sync | `deriveSignal(fn)` | `deriveList(fn)` | `deriveStore(fn)` |
| Other signals, async | `deriveSignal(asyncFn)` | `deriveList(asyncFn, { initial })` | `deriveStore(asyncFn, { initial })` |
| External source | `deriveSignal(seed, { watched })` | `deriveList(seed, { watched })` | `deriveStore(seed, { watched })` |
| Source array + item transform | — | `deriveList(source, itemFn)` | — |

## Key Files Structure

- `src/graph.ts` - Core reactive engine (nodes, edges, link, propagate, refresh, flush, batch)
- `src/errors.ts` - Error classes and validation functions
- `src/nodes/state.ts` - createState (narrow mutable-source factory)
- `src/nodes/sensor.ts` - createSensor (narrow external-push factory)
- `src/nodes/memo.ts` - createMemo (narrow sync-derivation factory)
- `src/nodes/task.ts` - createTask (narrow async-derivation factory)
- `src/nodes/effect.ts` - createEffect, match, MatchHandlers type
- `src/nodes/store.ts` - createStore, deriveStore, isStore, isMutableStore
- `src/nodes/list.ts` - createList, deriveList, isList, isMutableList
- `src/nodes/slot.ts` - createSlot, isSlot, Slot type
- `src/nodes/signal.ts` - Signal/MutableSignal types, createSignal, deriveSignal, isSignal, isMutableSignal
- `src/util.ts` - Utility functions and type checks
- `index.ts` - Entry point / main export file

## Coding Conventions

### TypeScript Style
- Use `const` for immutable values, prefer immutability
- Generic constraints: `T extends {}` to exclude nullish values
- Function overloads for complex type inference (e.g., `deriveList`, `deriveSignal`)
- Pure functions marked with `/*#__PURE__*/` for tree-shaking
- JSDoc comments for all public APIs

### Naming Conventions
- Factory functions: `create*` (mutable source) and `derive*` (everything else), e.g., `createSignal`, `deriveList`
- Narrow single-origin factories keep their origin names: `createState`, `createMemo`, `createTask`, `createSensor`
- Type predicates: `is*`, indexed by shape and mutability (`isSignal`, `isList`, `isStore`, `isMutableSignal`, `isMutableList`, `isMutableStore`, `isSlot`)
- Type constants: `TYPE_*` for internal shape tags
- Callback types: `*Callback` suffix (`TaskCallback`, `EffectCallback`, `SignalCallback`, `ListCallback`, `StoreCallback`)
- Push-callback argument is always named `emit`; the seed option is always `initial`; an `AbortSignal` callback parameter is always named `abortSignal`
- Private variables: use descriptive names, no underscore prefix

### Error Handling
- Error classes defined in `src/errors.ts`: CircularDependencyError, NullishSignalValueError, InvalidSignalValueError, InvalidCallbackError, RequiredOwnerError, UnsetSignalValueError
- `validateSignalValue()` and `validateCallback()` for input validation at public API boundaries
- Optional `guard` function in SignalOptions for runtime type checking
- AbortSignal for cancellation in async derivations

### Performance Patterns
- Linked-list edges for O(1) link/unlink
- Flag-based dirty checking avoids unnecessary recomputation
- `batch()` defers `flush()` to minimize effect re-runs
- Lazy evaluation: memos only recompute when accessed and dirty
- `trimSources()` removes stale edges after recomputation
- `unlink()` calls `source.stop()` when the last sink disconnects (auto-cleanup)
- Tree-shaking is a hard constraint: the sync-only core (`createState`, `createMemo`, `createEffect`) must stay under 4096 B gzipped. An import of one construction path must not pull in the others.

### API Design Principles
- All signals created via factory functions (no class constructors)
- All signals have `.get()` for value access
- Mutable signals have `.set(value)` and `.update(fn)`; derived signals have neither
- Store properties are automatically reactive signals via Proxy
- `watched` is an option, never a callback position: `(emit) => Cleanup` for a seed input, `(invalidate) => Cleanup` for a function input
- Effects return a dispose function (Cleanup)

### Testing Patterns
- Use Bun test runner (`bun test`)
- Test files: `test/*.test.ts`
- Test reactivity chains and dependency tracking
- Test async cancellation behavior
- Test error conditions and edge cases

## Common Code Patterns

### Creating Signals
```typescript
// Mutable single value
const count = createSignal(42)
const name = createState('Alice') // narrow factory, same shape

// Derived single value — sync, async, or external push
const doubled = deriveSignal(() => count.get() * 2)
const user = deriveSignal(async (_prev, abortSignal) => {
  const response = await fetch(`/users/${userId.get()}`, { signal: abortSignal })
  return response.json()
}, { initial: fallbackUser })
const mouse = deriveSignal({ x: 0, y: 0 }, {
  watched: emit => {
    const h = (e: MouseEvent) => emit({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  },
})

// Sensor for a mutable object (SKIP_EQUALITY, option-form watched)
const box = document.getElementById('box')!
const element = createSensor<HTMLElement>({
  watched: emit => {
    const obs = new MutationObserver(() => emit(box))
    obs.observe(box, { attributes: true })
    return () => obs.disconnect()
  },
  initial: box,
  equals: SKIP_EQUALITY,
})

// Store for reactive objects
const userStore = createStore({ name: 'Alice', age: 30 })

// List with stable keys
const items = createList(['apple', 'banana'], { keyConfig: 'fruit' })
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: u => u.id }
)
const key = users.add({ id: 'bob', name: 'Bob' })
users.replace(key, { id: 'bob', name: 'Bobby' }) // update item, propagates to every sink
users.remove(key)

// Memo for synchronous derived values (narrow factory)
const doubledMemo = createMemo(() => count.get() * 2)

// Memo with reducer capabilities
const counter = createMemo(prev => {
  const action = actions.get()
  return action === 'increment' ? prev + 1 : prev - 1
}, { initial: 0 })

// Task for async derived values (narrow factory)
const userData = createTask(async (prev, abortSignal) => {
  const id = userId.get()
  if (!id) return prev
  const response = await fetch(`/users/${id}`, { signal: abortSignal })
  return response.json()
})

// Derived list, per item — sync or async item function
const doubledItems = deriveList(numbers, (n: number) => n * 2)
type User = { id: string; name: string }
const enriched = deriveList(users, async (user: User, abortSignal: AbortSignal) => {
  const res = await fetch(`/api/${user.id}`, { signal: abortSignal })
  return { ...user, details: await res.json() }
})

// Derived list, async computation over the whole array
const results = deriveList(
  async (_prev, abortSignal) => {
    const res = await fetch(`/api/search?q=${query.get()}`, { signal: abortSignal })
    return res.json() as Promise<Item[]>
  },
  { initial: [], keyConfig: item => item.id },
)

// Derived list, external push
const feed = deriveList<Item[]>([], {
  watched: emit => {
    const ws = new WebSocket('/feed')
    ws.onmessage = e => emit(JSON.parse(e.data))
    return () => ws.close()
  },
  keyConfig: item => item.id,
})

// Slot for stable property delegation
const local = createState('default')
const slot = createSlot(local)
Object.defineProperty(element, 'label', slot)
slot.replace(createMemo(() => parentState.get())) // swap backing signal
```

### Reactivity
```typescript
// Effects run when a dependency changes and return a Cleanup
const dispose = createEffect(() => {
  console.log(`Count is ${count.get()}`)
})

// Effects can return cleanup functions
createEffect(() => {
  const timer = setInterval(() => console.log(count.get()), 1000)
  return () => clearInterval(timer)
})

// match() for ergonomic signal value handling
createEffect(() => {
  match([userData], {
    ok: ([data]) => updateUI(data),
    nil: () => showLoading(),
    err: errors => showError(errors[0].message)
  })
})
```

### Type Safety
```typescript
// Generic constraints exclude nullish
function createSignal<T extends {}>(value: T): MutableSignal<T>

// Shape guards for runtime checks — isSignal matches the single-value shape only
if (isSignal(value)) console.log(value.get())
if (isMutableSignal(value)) value.set(newValue)
if (isStore(value)) value.get()

// "Anything reactive" — structural check, not a guard
const toValue = (x: unknown) => typeof x?.get === 'function' ? x.get() : x

// Guards for runtime type validation
const count = createState(0, {
  guard: (v): v is number => typeof v === 'number'
})
```

## Resource Management

```typescript
// Sensor: lazy external input (option-form watched, emit callback)
const sensor = createSensor<T>({
  watched: emit => {
    // setup — call emit(value) to update
    return () => { /* cleanup — called when last effect stops watching */ }
  },
})

// Derived list, external push (seed + watched with emit)
const feed = deriveList<T[]>(seed, {
  watched: emit => {
    // setup — call emit({ add, change, remove }) with granular changes
    return () => { /* cleanup */ }
  },
  keyConfig: item => item.id,
})

// Memo/Task/deriveSignal function form: optional watched with invalidate
const derived = createMemo(() => element.get().textContent ?? '', {
  watched: invalidate => {
    const obs = new MutationObserver(() => invalidate())
    obs.observe(element.get(), { childList: true })
    return () => obs.disconnect()
  }
})

// Store/List: optional watched callback
const store = createStore(initialValue, {
  watched: () => {
    // setup
    return () => { /* cleanup */ }
  }
})

// Scope for hierarchical cleanup
const dispose = createScope(() => {
  const state = createState(0)
  createEffect(() => console.log(state.get()))
  return () => console.log('scope disposed')
})
dispose() // cleans up effect and runs the returned cleanup
```

## Build System
- Uses Bun as build tool and runtime
- TypeScript compilation with declaration files
- ES modules only (`"type": "module"`)
- Biome for code formatting and linting

## When suggesting code:
1. Use factory functions (`create*` for mutable sources, `derive*` for derivations), not class constructors
2. Route construction through the matrix above — never write a derived value from inside an effect
3. Use proper TypeScript types and generics with `T extends {}`
4. Include JSDoc for public APIs
5. Consider performance implications (batching, granular dependencies)
6. Handle errors with the existing error classes and validation functions
7. Support async operations with AbortSignal when relevant — name the parameter `abortSignal`
8. Use function overloads when callback signatures have sync/async variants
