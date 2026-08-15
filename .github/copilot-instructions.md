# Copilot Instructions for Cause & Effect

## Project Overview

Cause & Effect is a reactive state management library for JavaScript and TypeScript. It is built on a linked graph of source and sink nodes (`src/graph.ts`). Every signal type has a factory function.

`CONTEXT.md` at the repo root defines the domain vocabulary. Use the approved term for each concept and avoid the listed synonyms.

## Core Architecture

### Graph Engine (`src/graph.ts`)
- **Nodes**: StateNode (source + equality), MemoNode (source + sink), TaskNode (source + sink + async), EffectNode (sink + owner)
- **Edges**: Doubly-linked list connecting sources to sinks
- **Operations**: `link()` creates edges, `propagate()` flags sinks dirty, `flush()` runs queued effects, `batch()` defers the flush
- **Flags**: FLAG_CLEAN, FLAG_CHECK, FLAG_DIRTY, FLAG_RUNNING, FLAG_RELINK — the two-level flag state machine
- **Convergence**: `flush()` drains in passes, bounded by `MAX_FLUSH_PASSES`; exceeding it throws `EffectConvergenceError`

### Signal Types (all in `src/nodes/`)
- **State** (`createState`): Mutable signals for values (`get`, `set`, `update`)
- **Sensor** (`createSensor`): Read-only source for external input. Activates when watched. Use `SKIP_EQUALITY` when the reference stays the same and internal state changes.
- **Memo** (`createMemo`): Synchronous computed with memoization. Supports a reducer form and an optional `watched(invalidate)` callback
- **Task** (`createTask`): Asynchronous computed. Cancels through an AbortController. Supports an optional `watched(invalidate)` callback
- **Store** (`createStore`): Proxy-based reactive object with a per-property State, Store, or List signal. Also exported as `MutableStore` — the name it keeps in 2.0, where `Store` is repurposed as the readonly base. `Store`/`isStore` are `@deprecated` since 1.5.0 in favor of `MutableStore`/`isMutableStore`. See `MIGRATION-2.0.md`.
- **List** (`createList`): Reactive array with stable keys and a per-item State signal. Also exported as `MutableList` — the name it keeps in 2.0, where `List` is repurposed as the readonly base. `List`/`isList` are `@deprecated` since 1.5.0 in favor of `MutableList`/`isMutableList`.
- **Collection** (`createCollection`): Keyed items with per-item memoization. Either externally driven with a watched lifecycle, or derived from a List or a Collection. Not a reactive `Map`. `createCollection`, `Collection`/`isCollection`, and `.deriveCollection()` are all `@deprecated` since 1.5.0 — use `deriveList(seed, { watched })` / `deriveList(source, itemFn)`, which return `DerivedList`/`isDerivedList` (the 2.0 name is `List`).
- **Slot** (`createSlot`): Forwarding layer to a swappable backing signal, for integration layers such as property descriptors and custom elements. Not an event bus, and has no `update()`
- **Effect** (`createEffect`): Terminal sink that runs side effects. Runs synchronously

## Key Files Structure

- `src/graph.ts` - Core reactive engine (nodes, edges, link, propagate, flush, batch)
- `src/errors.ts` - Error classes and validation functions
- `src/nodes/state.ts` - createState, isState, State type
- `src/nodes/sensor.ts` - createSensor, isSensor, SensorCallback type
- `src/nodes/memo.ts` - createMemo, isMemo, Memo type
- `src/nodes/task.ts` - createTask, isTask, Task type
- `src/nodes/effect.ts` - createEffect, match, MatchHandlers type
- `src/nodes/store.ts` - createStore, deriveStore, MutableStore/isMutableStore, Store/isStore (deprecated), DerivedStore, diff, isEqual
- `src/nodes/list.ts` - createList, MutableList/isMutableList, List/isList (deprecated)
- `src/nodes/collection.ts` - deriveList, DerivedList/isDerivedList, createCollection/Collection/isCollection/deriveCollection (all deprecated)
- `src/nodes/slot.ts` - createSlot, isSlot, Slot type
- `src/signal.ts` - Polymorphic factories (createSignal, createMutableSignal, createComputed) and type predicates (isSignal, isMutableSignal, isComputed)
- `src/util.ts` - Utility functions and type checks
- `index.ts` - Entry point / main export file

## Coding Conventions

### TypeScript Style
- Use `const` for immutable values, prefer immutability
- Generic constraints: `T extends {}` to exclude nullish values
- Function overloads for complex type inference (e.g., `createCollection`, `deriveCollection`)
- Pure functions marked with `/*#__PURE__*/` for tree-shaking
- JSDoc comments for all public APIs

### Naming Conventions
- Factory functions: `create*` for sources (e.g., `createState`, `createStore`, `createList`, `createSensor`, `createSlot`), `derive*` for the read-only forms (`deriveStore`, `deriveList`)
- Type predicates: `is*` (e.g., `isState`, `isMemo`, `isMutableStore`, `isMutableList`, `isDerivedList`, `isSensor`, `isSlot`). `isStore`, `isList`, `isCollection` are `@deprecated` 1.x aliases.
- Type constants: `TYPE_*` for internal type tags
- Callback types: `*Callback` suffix (MemoCallback, TaskCallback, EffectCallback, SensorCallback, CollectionCallback, DeriveCollectionCallback)
- Private variables: use descriptive names, no underscore prefix

### Error Handling
- Error classes defined in `src/errors.ts`: CircularDependencyError, NullishSignalValueError, InvalidSignalValueError, InvalidCallbackError, RequiredOwnerError, UnsetSignalValueError
- `validateSignalValue()` and `validateCallback()` for input validation at public API boundaries
- Optional `guard` function in SignalOptions for runtime type checking
- AbortSignal for cancellation in async Tasks

### Performance Patterns
- Linked-list edges for O(1) link/unlink
- Flag-based dirty checking avoids unnecessary recomputation
- `batch()` defers `flush()` to minimize effect re-runs
- Lazy evaluation: Memos only recompute when accessed and dirty
- `trimSources()` removes stale edges after recomputation
- `unlink()` calls `source.stop()` when the last sink disconnects (auto-cleanup)

### API Design Principles
- All signals created via `create*()` factory functions (no class constructors)
- All signals have `.get()` for value access
- Mutable signals (State) have `.set(value)` and `.update(fn)`
- Store properties are automatically reactive signals via Proxy
- Sensor and Collection take a watched callback that returns a Cleanup (lazy activation)
- Memo and Task take an optional `watched(invalidate)` callback in options
- Store and List take an optional `watched` callback in options that returns a Cleanup
- Effects return a dispose function (Cleanup)

### Testing Patterns
- Use Bun test runner (`bun test`)
- Test files: `test/*.next.test.ts`
- Test reactivity chains and dependency tracking
- Test async cancellation behavior
- Test error conditions and edge cases

## Common Code Patterns

### Creating Signals
```typescript
// State for values
const count = createState(42)
const name = createState('Alice')

// Sensor for external input
const mouse = createSensor<{ x: number; y: number }>((set) => {
  const h = (e: MouseEvent) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('mousemove', h)
  return () => window.removeEventListener('mousemove', h)
})

// Sensor for a mutable object (SKIP_EQUALITY)
const box = document.getElementById('box')!
const element = createSensor<HTMLElement>((set) => {
  const obs = new MutationObserver(() => set(box))
  obs.observe(box, { attributes: true })
  return () => obs.disconnect()
}, { value: box, equals: SKIP_EQUALITY })

// Store for reactive objects
const user = createStore({ name: 'Alice', age: 30 })

// List with stable keys
const items = createList(['apple', 'banana'], { keyConfig: 'fruit' })
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: u => u.id }
)
const key = users.add({ id: 'bob', name: 'Bob' })
users.replace(key, { id: 'bob', name: 'Bobby' }) // update item, propagates to every sink
users.remove(key)

// Memo for synchronous derived values
const doubled = createMemo(() => count.get() * 2)

// Memo with reducer capabilities
const counter = createMemo(prev => {
  const action = actions.get()
  return action === 'increment' ? prev + 1 : prev - 1
}, { value: 0 })

// Task for async derived values
const userData = createTask(async (prev, abort) => {
  const id = userId.get()
  if (!id) return prev
  const response = await fetch(`/users/${id}`, { signal: abort })
  return response.json()
})

// Collection derived from a List — prefer deriveList(source, itemFn) over the
// deprecated .deriveCollection() method shown here (same behavior, current name)
const numbers = createList([1, 2, 3])
const doubledItems = numbers.deriveCollection((n: number) => n * 2)
// Async form: annotate both parameters — overload resolution picks the sync
// signature first, so unannotated params fall back to implicit `any`.
type User = { id: string; name: string }
const enriched = users.deriveCollection(async (user: User, abort: AbortSignal) => {
  const res = await fetch(`/api/${user.id}`, { signal: abort })
  return { ...user, details: await res.json() }
})

// Collection for externally-driven data
const feed = createCollection<{ id: string; text: string }>((applyChanges) => {
  const ws = new WebSocket('/feed')
  ws.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => ws.close()
}, { keyConfig: item => item.id })

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
function createSignal<T extends {}>(value: T): Signal<T>

// Type predicates for runtime checks
if (isState(value)) value.set(newValue)
if (isMemo(value)) console.log(value.get())
if (isMutableStore(value)) value.name.set('Bob') // isStore also matches, but is deprecated and matches a DerivedStore too

// Guards for runtime type validation
const count = createState(0, {
  guard: (v): v is number => typeof v === 'number'
})
```

## Resource Management

```typescript
// Sensor: lazy external input tracking (watched callback with set)
const sensor = createSensor<T>((set) => {
  // setup — call set(value) to update
  return () => { /* cleanup — called when last effect stops watching */ }
})

// Collection: lazy external data source (watched callback with applyChanges)
const feed = createCollection<T>((applyChanges) => {
  // setup — call applyChanges(diffResult) on changes
  return () => { /* cleanup */ }
}, { keyConfig: item => item.id })

// Memo/Task: optional watched callback with invalidate
const derived = createMemo(() => element.get().textContent ?? '', {
  watched: (invalidate) => {
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
1. Use `create*()` factory functions, not class constructors
2. Follow the established patterns for signal creation and usage
3. Use proper TypeScript types and generics with `T extends {}`
4. Include JSDoc for public APIs
5. Consider performance implications (batching, granular dependencies)
6. Handle errors with the existing error classes and validation functions
7. Support async operations with AbortSignal when relevant
8. Use function overloads when callback signatures have sync/async variants
