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
- **Ref signals** are cells that reference external objects (DOM, Map, Set) requiring manual notification
- **Computed signals** are formula cells that automatically recalculate when dependencies change
- **Store signals** are structured tables where individual columns (properties) are reactive
- **List signals** are tables with stable row IDs that survive sorting and reordering
- **Collection signals** are read-only derived tables with item-level memoization
- **Effects** are event handlers that trigger side effects when cells change

## Architectural Deep Dive

### The Watcher System
The core of reactivity lies in the watcher system (`src/system.ts`):
- Each signal maintains a `Set<Watcher>` of subscribers
- When a signal's `.get()` method is called during effect/computed execution, it automatically subscribes the current watcher
- When a signal changes, it notifies all watchers, which then re-execute their callbacks
- Batching prevents cascade updates during synchronous operations

### Signal Hierarchy and Type System

```typescript
// Base Signal interface - all signals implement this
interface Signal<T extends {}> {
  get(): T
}

// Mutable signals extend this with mutation methods
interface MutableSignal<T extends {}> extends Signal<T> {
  set(value: T): void
  update(fn: (current: T) => T): void
}

// Collection interface - implemented by various collection types
interface Collection<T extends {}> {
  get(): T[]
  at(index: number): Signal<T> | undefined
  byKey(key: string): Signal<T> | undefined
  deriveCollection<R extends {}>(callback: CollectionCallback<R, T>): Collection<R>
}
```

The generic constraint `T extends {}` is crucial - it excludes `null` and `undefined` at the type level, preventing common runtime errors and making the API more predictable.

### Collection Architecture

Collections are an interface implemented by different reactive array types:

**DerivedCollection**: Read-only transformations of Lists or other Collections
- Item-level memoization with Computed signals
- Async support with automatic cancellation
- Chainable for data pipelines

**ElementCollection**: DOM element collections with MutationObserver
- Uses Ref signals for elements that change externally
- Watches attributes and childList mutations
- Stable keys for persistent element identity

Key patterns:
- Collections return arrays of values via `.get()`
- Individual items accessed as signals via `.at()` and `.byKey()`
- All collections support `.deriveCollection()` for chaining

### Store and List Architecture

**Store signals** (`createStore`): Transform objects into reactive data structures
- Each property becomes its own signal via Proxy
- Lazy signal creation and automatic cleanup
- Dynamic property addition/removal with proper reactivity

**List signals** (`new List`): Arrays with stable keys and reactive items
- Maintains stable keys that survive sorting and splicing
- Built on `Composite` class for consistent signal management
- Provides `byKey()`, `keyAt()`, `indexOfKey()` for key-based access

### Computed Signal Memoization Strategy

Computed signals implement smart memoization:
- **Dependency Tracking**: Automatically tracks which signals are accessed during computation
- **Stale Detection**: Only recalculates when dependencies actually change
- **Async Support**: Handles Promise-based computations with automatic cancellation
- **Error Handling**: Preserves error states and prevents cascade failures
- **Reducer Capabilities**: Access to previous value enables state accumulation and transitions

## Resource Management with Watch Callbacks

All signals support the `watched` and `unwatched` callbacks for lazy resource management. Resources are allocated only when a signal is first accessed by an effect and automatically cleaned up when no effects are watching:

```typescript
// Basic watch callbacks pattern
const config = new State({ apiUrl: 'https://api.example.com' }, {
  watched: () => {
    console.log('Setting up API client...')
    const client = new ApiClient(config.get().apiUrl)
  },
  unwatched: () => {
    console.log('Cleaning up API client...')
    client.disconnect()
  }
})

// Resource is only created when effect runs
const cleanup = createEffect(() => {
  console.log('API URL:', config.get().apiUrl) // Triggers watched callback
})

cleanup() // Triggers unwatched callback
```

**Practical Use Cases**:
- Event listeners that activate only when data is watched
- Network connections established on-demand
- Expensive computations that pause when not needed
- External subscriptions (WebSocket, Server-Sent Events)
- Database connections tied to data access patterns

**Watch Lifecycle**:
1. First effect accesses signal → `watched` callback executed
3. Last effect stops watching → `unwatched` callback executed
4. New effect accesses signal → `watched` callback executed again

This pattern enables **lazy resource allocation** - resources are only consumed when actually needed and automatically freed when no longer used.

## Advanced Patterns and Best Practices

### When to Use Each Signal Type

**State Signals (`State`)**:
- Primitive values (numbers, strings, booleans)
- Objects that you replace entirely rather than mutating properties
- Simple toggles and flags
- Values with straightforward update patterns

```typescript
const count = new State(0)
const theme = new State<'light' | 'dark'>('light')
```

**Ref Signals (`new Ref`)**:
- External objects that change outside the reactive system
- DOM elements, Map, Set, Date objects, third-party APIs
- Requires manual `.notify()` when external object changes

```typescript
const elementRef = new Ref(document.getElementById('status'))
const cacheRef = new Ref(new Map())
// When external change occurs: cacheRef.notify()
```

**Store Signals (`createStore`)**:
- Objects where individual properties change independently

```typescript
const user = createStore({ name: 'Alice', email: 'alice@example.com' })
user.name.set('Bob') // Only name subscribers react
```

**List Signals (`new List`)**:
```typescript
const todoList = new List([
  { id: 'task1', text: 'Learn signals' }
], todo => todo.id)
const firstTodo = todoList.byKey('task1') // Access by stable key
```

**Collection Signals (`new DerivedCollection`)**:
```typescript
const completedTodos = new DerivedCollection(todoList, todo => 
  todo.completed ? { ...todo, status: 'done' } : null
)
const todoDetails = new DerivedCollection(todoList, async (todo, abort) => {
  const response = await fetch(`/todos/${todo.id}`, { signal: abort })
  return { ...todo, details: await response.json() }
})

// Chain collections for data pipelines
const urgentTodoSummaries = todoList
  .deriveCollection(todo => ({ ...todo, urgent: todo.priority > 8 }))
  .deriveCollection(todo => todo.urgent ? `URGENT: ${todo.text}` : todo.text)

// Collections maintain stable references through List changes
const firstTodoDetail = todoDetails.byKey('task1') // Computed signal
todoList.sort() // Reorders list but collection signals remain stable
```

**Computed Signals (`Memo` and `Task`)**:
- Expensive calculations that should be memoized
- Derived data that depends on multiple signals
- Async operations that need automatic cancellation
- Cross-cutting concerns that multiple components need

```typescript
const expensiveCalc = new Memo(() => {
  return heavyComputation(data1.get(), data2.get()) // Memoized
})

const userData = new Task(async (prev, abort) => {
  const id = userId.get()
  if (!id) return prev // Keep previous data if no ID
  const response = await fetch(`/users/${id}`, { signal: abort })
  return response.json()
})

// Reducer pattern for state machines
const gameState = new Memo(prev => {
  const action = playerAction.get()
  switch (prev) {
    case 'menu':
      return action === 'start' ? 'playing' : 'menu'
    case 'playing':
      return action === 'pause' ? 'paused' : action === 'gameover' ? 'ended' : 'playing'
    case 'paused':
      return action === 'resume' ? 'playing' : action === 'quit' ? 'menu' : 'paused'
    case 'ended':
      return action === 'restart' ? 'playing' : action === 'menu' ? 'menu' : 'ended'
    default:
      return 'menu'
  }
}, 'menu') // Initial state

// Accumulating values over time
const runningTotal = new Memo(prev => {
  const newValue = currentValue.get()
  return previous + newValue
}, 0) // Start with 0
```

### Error Handling Strategies

The library provides several layers of error handling:

1. **Input Validation**: Custom error classes for invalid operations
2. **Async Cancellation**: AbortSignal integration prevents stale async operations
3. **Error Propagation**: Computed signals preserve and propagate errors
4. **Helper Functions**: `resolve()` and `match()` for ergonomic error handling

```typescript
// Error handling with resolve() and match()
const apiData = new Task(async (prev, abort) => {
  const response = await fetch('/api/data', { signal: abort })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
})

createEffect(() => {
  match(resolve({ apiData }), {
    ok: ({ apiData }) => updateUI(apiData),
    nil: () => showLoading(),
    err: errors => showError(errors[0].message)
  })
})
```

### Performance Optimization

**Batching**: Use `batchSignalWrites()` for multiple updates
```typescript
batchSignalWrites(() => {
  user.name.set('Alice')
  user.email.set('alice@example.com')
}) // Single effect trigger
```

**Granular Dependencies**: Structure computed signals to minimize dependencies
```typescript
// Bad: depends on entire user object
const display = new Memo(() => user.get().name + user.get().email)
// Good: only depends on specific properties  
const display = new Memo(() => user.name.get() + user.email.get())
```

## Common Pitfalls

1. **Infinite Loops**: Don't update signals within their own computed callbacks
2. **Memory Leaks**: Clean up effects when components unmount  
3. **Over-reactivity**: Structure data to minimize unnecessary updates
4. **Async Race Conditions**: Trust automatic cancellation with AbortSignal

## Advanced Patterns

### Event Bus with Type Safety
```typescript
type Events = {
  userLogin: { userId: number; timestamp: number }
  userLogout: { userId: number }
}

const eventBus = createStore<Events>({
  userLogin: UNSET,
  userLogout: UNSET
})

const emit = <K extends keyof Events>(event: K, data: Events[K]) => {
  eventBus[event].set(data)
}

const on = <K extends keyof Events>(event: K, callback: (data: Events[K]) => void) =>
  createEffect(() => {
    const data = eventBus[event].get()
    if (data !== UNSET) callback(data)
  })
```

### Data Processing Pipelines
```typescript
const rawData = new List([{ id: 1, value: 10 }])
const processed = rawData
  .deriveCollection(item => ({ ...item, doubled: item.value * 2 }))
  .deriveCollection(item => ({ ...item, formatted: `$${item.doubled}` }))
```

### Stable List Keys
```typescript
const playlist = new List([
  { id: 'track1', title: 'Song A' }
], track => track.id)

const firstTrack = playlist.byKey('track1') // Persists through sorting
playlist.sort((a, b) => a.title.localeCompare(b.title))
```
