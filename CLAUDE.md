# Claude Context for Cause & Effect

## Library Overview and Philosophy

Cause & Effect is a reactive state management library that implements the signals pattern for JavaScript and TypeScript applications. The library is designed around the principle of **explicit reactivity** - where dependencies are automatically tracked but relationships remain clear and predictable.

### Core Philosophy
- **Granular Reactivity**: Changes propagate only to dependent computations, minimizing unnecessary work
- **Explicit Dependencies**: Dependencies are tracked through `.get()` calls, no hidden subscriptions
- **Type Safety First**: Comprehensive TypeScript support with strict generic constraints (`T extends {}`)
- **Performance Conscious**: Minimal overhead through efficient dependency tracking and batching

## Mental Model for Understanding the System

Think of signals as **observable cells** in a spreadsheet:
- **State signals** are input cells for primitive values and objects
- **Sensor signals** are read-only cells that track external input (mouse position, resize, mutable objects) and update lazily
- **Memo signals** are formula cells that automatically recalculate when dependencies change
- **Task signals** are async formula cells with abort semantics and pending state
- **Store signals** are structured tables where individual columns (properties) are reactive
- **List signals** are tables with stable row IDs that survive sorting and reordering
- **Collection signals** are read-only derived tables with item-level memoization
- **SourceCollection signals** are externally-fed tables with a watched lifecycle (WebSocket, SSE)
- **Effects** are event handlers that trigger side effects when cells change

## Architectural Deep Dive

### The Graph System
The core of reactivity lies in the linked graph system (`src/graph.ts`):
- Each source node maintains a linked list of `Edge` entries pointing to sink nodes
- When a signal's `.get()` method is called during effect/memo/task execution, it automatically links the source to the active sink via `link()`
- When a signal changes, it calls `propagate()` on all linked sinks, which flags them dirty
- `flush()` processes queued effects after propagation
- `batch()` defers flushing until the outermost batch completes
- `trimSources()` removes stale edges after recomputation

### Node Types in the Graph

```
StateNode<T>  — source-only with equality + guard (State, Sensor)
MemoNode<T>   — source + sink (Memo, Store, List, Collection)
TaskNode<T>   — source + sink + async (Task)
EffectNode    — sink + owner (Effect)
Scope         — owner-only (createScope)
```

### Signal Hierarchy and Type System

```typescript
// Base Signal interface - all signals implement this
interface Signal<T extends {}> {
  get(): T
}

// State adds mutation methods
type State<T extends {}> = {
  get(): T
  set(value: T): void
  update(fn: (current: T) => T): void
}

// Memo is read-only computed
type Memo<T extends {}> = {
  get(): T
}

// Task adds async control
type Task<T extends {}> = {
  get(): T
  isPending(): boolean
  abort(): void
}

// Collection interface
type Collection<T extends {}> = {
  get(): T[]
  at(index: number): Signal<T> | undefined
  byKey(key: string): Signal<T> | undefined
  keys(): IterableIterator<string>
  deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>
  deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>
}
```

The generic constraint `T extends {}` is crucial - it excludes `null` and `undefined` at the type level, preventing common runtime errors and making the API more predictable.

### Collection Architecture

**Derived Collections** (`createCollection`): Transformed from Lists or other Collections
- Created via `createCollection(source, callback)` or `source.deriveCollection(callback)`
- Item-level memoization: sync callbacks use `createMemo`, async callbacks use `createTask`
- Structural changes tracked via an internal `MemoNode` that reads `source.keys()`
- Chainable for data pipelines

**Source Collections** (`createSourceCollection`): Externally-driven collections with watched lifecycle
- Created via `createSourceCollection(initialValue, start, options?)`
- The `start` callback receives an `applyChanges(diffResult)` function for granular add/change/remove operations
- Same `Collection` interface as derived collections (`.get()`, `.byKey()`, `.keys()`, `.deriveCollection()`)
- Lazy activation: `start` callback invoked on first effect access, cleanup when unwatched

### Store and List Architecture

**Store signals** (`createStore`): Transform objects into reactive data structures
- Each property becomes its own State signal (primitives) or nested Store (objects) via Proxy
- Uses an internal `MemoNode` for structural reactivity (add/remove properties)
- `diff()` computes granular changes when calling `set()`
- Dynamic property addition/removal with `add()`/`remove()`

**List signals** (`createList`): Arrays with stable keys and reactive items
- Each item becomes a `State` signal in a `Map<string, State<T>>`
- Uses an internal `MemoNode` for structural reactivity
- Configurable key generation: auto-increment, string prefix, or function
- Provides `byKey()`, `keyAt()`, `indexOfKey()` for key-based access
- `deriveCollection()` creates derived Collections

### Computed Signal Memoization Strategy

Computed signals implement smart memoization:
- **Dependency Tracking**: Automatically tracks which signals are accessed during computation via `link()`
- **Stale Detection**: Flag-based dirty checking (CLEAN, CHECK, DIRTY) — only recalculates when dependencies actually change
- **Async Support**: `createTask` handles Promise-based computations with automatic AbortController cancellation
- **Error Handling**: Preserves error states and prevents cascade failures
- **Reducer Capabilities**: Access to previous value enables state accumulation and transitions

## Resource Management with Watch Callbacks

Sensor and SourceCollection signals use a **start callback** pattern for lazy resource management. Resources are allocated only when a signal is first accessed by an effect and automatically cleaned up when no effects are watching:

```typescript
// Sensor: track external input with state updates
const mousePos = createSensor<{ x: number; y: number }>((set) => {
  const handler = (e: MouseEvent) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('mousemove', handler)
  return () => window.removeEventListener('mousemove', handler)
})

// Sensor: observe a mutable external object (SKIP_EQUALITY)
const element = createSensor<HTMLElement>((set) => {
  const node = document.getElementById('status')!
  set(node)
  const observer = new MutationObserver(() => set(node))
  observer.observe(node, { attributes: true })
  return () => observer.disconnect() // cleanup when unwatched
}, { value: node, equals: SKIP_EQUALITY })

// SourceCollection: receive keyed data from external source
const feed = createSourceCollection<{ id: string; text: string }>([], (applyChanges) => {
  const es = new EventSource('/feed')
  es.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => es.close()
}, { keyConfig: item => item.id })
```

Store and List signals support an optional `watched` callback in their options:

```typescript
const user = createStore({ name: 'Alice', email: 'alice@example.com' }, {
  watched: () => {
    console.log('Store is now being watched')
    const ws = new WebSocket('/updates')
    return () => ws.close() // cleanup returned as Cleanup
  }
})
```

**Watch Lifecycle**:
1. First effect accesses signal → start/watched callback executed
2. Last effect stops watching → returned cleanup function executed
3. New effect accesses signal → start/watched callback executed again

This pattern enables **lazy resource allocation** - resources are only consumed when actually needed and automatically freed when no longer used.

## Advanced Patterns and Best Practices

### When to Use Each Signal Type

**State (`createState`)**:
- Primitive values (numbers, strings, booleans)
- Objects that you replace entirely rather than mutating properties
- Simple toggles and flags

```typescript
const count = createState(0)
const theme = createState<'light' | 'dark'>('light')
```

**Sensor (`createSensor`)**:
- External input streams (mouse position, window size, media queries)
- External mutable objects observed via MutationObserver, IntersectionObserver, etc.
- Returns a read-only signal that activates lazily and tears down when unwatched
- Starts undefined until first `set()` unless `options.value` is provided

```typescript
// Tracking external values (default equality)
const windowSize = createSensor<{ w: number; h: number }>((set) => {
  const update = () => set({ w: innerWidth, h: innerHeight })
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
})

// Observing a mutable object (SKIP_EQUALITY)
const el = createSensor<HTMLElement>((set) => {
  const node = document.getElementById('box')!
  set(node)
  const obs = new MutationObserver(() => set(node))
  obs.observe(node, { attributes: true })
  return () => obs.disconnect()
}, { value: node, equals: SKIP_EQUALITY })
```

**Store (`createStore`)**:
- Objects where individual properties change independently
- Proxy-based: access properties directly as signals

```typescript
const user = createStore({ name: 'Alice', email: 'alice@example.com' })
user.name.set('Bob') // Only name subscribers react
```

**List (`createList`)**:
- Arrays with stable keys and reactive items

```typescript
const todoList = createList([
  { id: 'task1', text: 'Learn signals' }
], { keyConfig: todo => todo.id })
const firstTodo = todoList.byKey('task1') // Access by stable key
```

**Collection (`createCollection`)**:
- Read-only derived transformations of Lists or other Collections

```typescript
const doubled = createCollection(numbers, (value: number) => value * 2)

// Async transformation
const enriched = createCollection(users, async (user, abort) => {
  const response = await fetch(`/api/${user.id}`, { signal: abort })
  return { ...user, details: await response.json() }
})

// Chain collections for data pipelines
const processed = todoList
  .deriveCollection(todo => ({ ...todo, urgent: todo.priority > 8 }))
  .deriveCollection(todo => todo.urgent ? `URGENT: ${todo.text}` : todo.text)
```

**SourceCollection (`createSourceCollection`)**:
- Externally-driven keyed collections (WebSocket streams, SSE, external data feeds)
- Same `Collection` interface — `.get()`, `.byKey()`, `.keys()`, `.deriveCollection()`
- Watched lifecycle: activates on first effect access, tears down when unwatched

```typescript
const feed = createSourceCollection<{ id: string; text: string }>([], (applyChanges) => {
  const ws = new WebSocket('/feed')
  ws.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => ws.close()
}, { keyConfig: item => item.id })
```

**Memo (`createMemo`)**:
- Synchronous derived computations with memoization
- Reducer pattern with previous value access

```typescript
const doubled = createMemo(() => count.get() * 2)

// Reducer pattern for state machines
const gameState = createMemo(prev => {
  const action = playerAction.get()
  switch (prev) {
    case 'menu': return action === 'start' ? 'playing' : 'menu'
    case 'playing': return action === 'pause' ? 'paused' : 'playing'
    default: return prev
  }
}, { value: 'menu' })

// Accumulating values
const runningTotal = createMemo(prev => prev + currentValue.get(), { value: 0 })
```

**Task (`createTask`)**:
- Async computations with automatic cancellation

```typescript
const userData = createTask(async (prev, abort) => {
  const id = userId.get()
  if (!id) return prev
  const response = await fetch(`/users/${id}`, { signal: abort })
  return response.json()
})
```

### Error Handling Strategies

The library provides several layers of error handling:

1. **Input Validation**: `validateSignalValue()` and `validateCallback()` with custom error classes
2. **Async Cancellation**: AbortSignal integration prevents stale async operations
3. **Error Propagation**: Memo and Task preserve error states and throw on `.get()`
4. **Match Helper**: `match()` for ergonomic signal value extraction inside effects

```typescript
const apiData = createTask(async (prev, abort) => {
  const response = await fetch('/api/data', { signal: abort })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
})

createEffect(() => {
  match([apiData], {
    ok: ([data]) => updateUI(data),
    nil: () => showLoading(),
    err: errors => showError(errors[0].message)
  })
})
```

### Performance Optimization

**Batching**: Use `batch()` for multiple updates
```typescript
batch(() => {
  user.name.set('Alice')
  user.email.set('alice@example.com')
}) // Single effect trigger
```

**Granular Dependencies**: Structure computed signals to minimize dependencies
```typescript
// Bad: depends on entire user object
const display = createMemo(() => user.get().name + user.get().email)
// Good: only depends on specific properties
const display = createMemo(() => user.name.get() + user.email.get())
```

## Common Pitfalls

1. **Infinite Loops**: Don't update signals within their own computed callbacks
2. **Memory Leaks**: Clean up effects when components unmount
3. **Over-reactivity**: Structure data to minimize unnecessary updates
4. **Async Race Conditions**: Trust automatic cancellation with AbortSignal
5. **Circular Dependencies**: The graph detects and throws `CircularDependencyError`

## Advanced Patterns

### Event Bus with Type Safety
```typescript
type Events = {
  userLogin: { userId: number; timestamp: number }
  userLogout: { userId: number }
}

const eventBus = createStore<Events>({
  userLogin: undefined as unknown as Events['userLogin'],
  userLogout: undefined as unknown as Events['userLogout'],
})

const emit = <K extends keyof Events>(event: K, data: Events[K]) => {
  eventBus[event].set(data)
}

const on = <K extends keyof Events>(event: K, callback: (data: Events[K]) => void) =>
  createEffect(() => {
    const data = eventBus[event].get()
    if (data != null) callback(data)
  })
```

### Data Processing Pipelines
```typescript
const rawData = createList([{ id: 1, value: 10 }], { keyConfig: item => String(item.id) })
const processed = rawData
  .deriveCollection(item => ({ ...item, doubled: item.value * 2 }))
  .deriveCollection(item => ({ ...item, formatted: `$${item.doubled}` }))
```

### Stable List Keys
```typescript
const playlist = createList([
  { id: 'track1', title: 'Song A' }
], { keyConfig: track => track.id })

const firstTrack = playlist.byKey('track1') // Persists through sorting
playlist.sort((a, b) => a.title.localeCompare(b.title))
```
