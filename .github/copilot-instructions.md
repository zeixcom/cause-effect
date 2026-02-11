# Copilot Instructions for Cause & Effect

## Project Overview

Cause & Effect is a reactive state management library for JavaScript/TypeScript that provides signals-based reactivity. The library is built on a linked graph of source and sink nodes (`src/graph.ts`) with functional factory functions for all signal types.

## Core Architecture

### Graph Engine (`src/graph.ts`)
- **Nodes**: StateNode (source + equality), MemoNode (source + sink), TaskNode (source + sink + async), EffectNode (sink + owner)
- **Edges**: Doubly-linked list connecting sources to sinks
- **Operations**: `link()` creates edges, `propagate()` flags sinks dirty, `flush()` runs queued effects, `batch()` defers flushing
- **Flags**: FLAG_CLEAN, FLAG_CHECK, FLAG_DIRTY, FLAG_RUNNING for efficient dirty checking

### Signal Types (all in `src/nodes/`)
- **State** (`createState`): Mutable signals for values (`get`, `set`, `update`)
- **Sensor** (`createSensor`): Read-only signals for external input with automatic state updates. Use `SKIP_EQUALITY` for mutable object observation.
- **Memo** (`createMemo`): Synchronous derived computations with memoization and reducer capabilities
- **Task** (`createTask`): Async derived computations with automatic AbortController cancellation
- **Store** (`createStore`): Proxy-based reactive objects with per-property State/Store signals
- **List** (`createList`): Reactive arrays with stable keys and per-item State signals
- **Collection** (`createCollection`): Reactive collections — either externally-driven with watched lifecycle, or derived from List/Collection with item-level memoization
- **Effect** (`createEffect`): Side effects that react to signal changes

## Key Files Structure

- `src/graph.ts` - Core reactive engine (nodes, edges, link, propagate, flush, batch)
- `src/errors.ts` - Error classes and validation functions
- `src/nodes/state.ts` - createState, isState, State type
- `src/nodes/sensor.ts` - createSensor, isSensor, SensorCallback type
- `src/nodes/memo.ts` - createMemo, isMemo, Memo type
- `src/nodes/task.ts` - createTask, isTask, Task type
- `src/nodes/effect.ts` - createEffect, match, MatchHandlers type
- `src/nodes/store.ts` - createStore, isStore, Store type, diff, isEqual
- `src/nodes/list.ts` - createList, isList, List type
- `src/nodes/collection.ts` - createCollection, isCollection, Collection type, deriveCollection (internal)
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
- Factory functions: `create*` (e.g., `createState`, `createMemo`, `createEffect`, `createStore`, `createList`, `createCollection`, `createSensor`)
- Type predicates: `is*` (e.g., `isState`, `isMemo`, `isStore`, `isList`, `isCollection`, `isSensor`)
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
- `unlink()` calls `source.stop()` when last sink disconnects (auto-cleanup)

### API Design Principles
- All signals created via `create*()` factory functions (no class constructors)
- All signals have `.get()` for value access
- Mutable signals (State) have `.set(value)` and `.update(fn)`
- Store properties are automatically reactive signals via Proxy
- Sensor/Collection use a start callback returning Cleanup (lazy activation)
- Store/List use optional `watched` callback in options returning Cleanup
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

// Sensor for mutable object observation (SKIP_EQUALITY)
const element = createSensor<HTMLElement>((set) => {
  const node = document.getElementById('box')!
  set(node)
  const obs = new MutationObserver(() => set(node))
  obs.observe(node, { attributes: true })
  return () => obs.disconnect()
}, { value: node, equals: SKIP_EQUALITY })

// Store for reactive objects
const user = createStore({ name: 'Alice', age: 30 })

// List with stable keys
const items = createList(['apple', 'banana'], { keyConfig: 'fruit' })
const users = createList(
  [{ id: 'alice', name: 'Alice' }],
  { keyConfig: u => u.id }
)

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

// Collection for derived transformations
const doubled = numbers.deriveCollection((n: number) => n * 2)
const enriched = users.deriveCollection(async (user, abort) => {
  const res = await fetch(`/api/${user.id}`, { signal: abort })
  return { ...user, details: await res.json() }
})

// Collection for externally-driven data
const feed = createCollection<{ id: string; text: string }>((applyChanges) => {
  const ws = new WebSocket('/feed')
  ws.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => ws.close()
}, { keyConfig: item => item.id })
```

### Reactivity
```typescript
// Effects run when dependencies change, return Cleanup
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
if (isStore(value)) value.name.set('Bob')

// Guards for runtime type validation
const count = createState(0, {
  guard: (v): v is number => typeof v === 'number'
})
```

## Resource Management

```typescript
// Sensor: lazy external input tracking
const sensor = createSensor<T>((set) => {
  // setup — call set(value) to update
  return () => { /* cleanup — called when last effect stops watching */ }
})

// Collection: lazy external data source
const feed = createCollection<T>((applyChanges) => {
  // setup — call applyChanges(diffResult) on changes
  return () => { /* cleanup */ }
}, { keyConfig: item => item.id })

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
