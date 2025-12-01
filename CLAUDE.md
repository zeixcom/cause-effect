# Claude Context for Cause & Effect

## Library Overview and Philosophy

Cause & Effect is a reactive state management library that implements the signals pattern for JavaScript and TypeScript applications. The library is designed around the principle of **explicit reactivity** - where dependencies are automatically tracked but relationships remain clear and predictable.

### Core Philosophy
- **Granular Reactivity**: Changes propagate only to dependent computations, minimizing unnecessary work
- **Explicit Dependencies**: No hidden subscriptions or magic - dependencies are tracked through `.get()` calls
- **Functional Design**: Immutable by default, with pure functions and predictable state updates
- **Type Safety First**: Comprehensive TypeScript support with strict generic constraints
- **Performance Conscious**: Minimal overhead through efficient dependency tracking and batching

## Mental Model for Understanding the System

Think of signals as **observable cells** in a spreadsheet:
- **State signals** are like input cells where you can directly enter values
- **Computed signals** are like formula cells that automatically recalculate when their dependencies change
- **Store signals** are like structured data tables where individual columns (properties) are reactive
- **Effects** are like event handlers that trigger side effects when cells change

The key insight is that the system tracks which cells (signals) are read during computation, creating an automatic dependency graph that ensures minimal and correct updates.

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
```

The generic constraint `T extends {}` is crucial - it excludes `null` and `undefined` at the type level, preventing common runtime errors and making the API more predictable.

### Store Signal Deep Dive

Store signals are the most complex part of the system. They transform plain objects into reactive data structures:

1. **Property Proxification**: Each property becomes its own signal
2. **Nested Reactivity**: Objects within objects recursively become stores
3. **Array Support**: Arrays get special treatment with length tracking and efficient sorting
4. **Dynamic Properties**: Runtime addition/removal of properties with proper reactivity

Key implementation details:
- Uses Proxy to intercept property access
- Maintains internal signal instances for each property
- Supports change notifications for fine-grained updates
- Handles edge cases like symbol properties and prototype chain

### Computed Signal Memoization Strategy

Computed signals implement smart memoization:
- **Dependency Tracking**: Automatically tracks which signals are accessed during computation
- **Stale Detection**: Only recalculates when dependencies actually change
- **Async Support**: Handles Promise-based computations with automatic cancellation
- **Error Handling**: Preserves error states and prevents cascade failures
- **Reducer-like Capabilities**: Access to previous value enables state accumulation and transitions

## Advanced Patterns and Best Practices

### When to Use Each Signal Type

**State Signals (`createState`)**:
- Primitive values (numbers, strings, booleans)
- Objects that you replace entirely rather than mutating properties
- Simple toggles and flags
- Values with straightforward update patterns

```typescript
const count = createState(0)
const theme = createState<'light' | 'dark'>('light')
const user = createState<User>({ id: 1, name: 'John Doe', email: 'john@example.com' }) // Replace entire user object
```

**Store Signals (`createStore`)**:
- Objects where individual properties change independently
- Nested data structures
- Form state where fields update individually
- Configuration objects with multiple settings

```typescript
const form = createStore({
  email: '',
  password: '',
  errors: { email: null, password: null }
})
// form.email.set('user@example.com') // Only email subscribers react
```

**Computed Signals (`createComputed`)**:
- Expensive calculations that should be memoized
- Derived data that depends on multiple signals
- Async operations that need automatic cancellation
- Cross-cutting concerns that multiple components need

```typescript
const expensiveCalc = createComputed(() => {
  return heavyComputation(data1.get(), data2.get()) // Memoized
})

const userData = createComputed(async (prev, abort) => {
  const id = userId.get()
  if (!id) return prev // Keep previous data if no ID
  const response = await fetch(`/users/${id}`, { signal: abort })
  return response.json()
})

// Reducer-like pattern for state machines
const gameState = createComputed((currentState) => {
  const action = playerAction.get()
  switch (currentState) {
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
const runningTotal = createComputed((previous) => {
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
// Robust async data fetching with error handling
const apiData = createComputed(async (abort) => {
  try {
    const response = await fetch('/api/data', { signal: abort })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  } catch (error) {
    if (abort.aborted) return UNSET // Cancelled, not an error
    throw error // Real error
  }
})

// Pattern matching for comprehensive state handling
createEffect(() => {
  match(resolve({ apiData }), {
    ok: ({ apiData }) => updateUI(apiData),
    nil: () => showLoading(),
    err: errors => showError(errors[0].message)
  })
})
```

### Performance Optimization Techniques

1. **Batching Updates**: Use `batch()` for multiple synchronous updates
2. **Selective Dependencies**: Structure computed signals to minimize dependencies
3. **Cleanup Management**: Properly dispose of effects to prevent memory leaks
4. **Shallow vs Deep Equality**: Use appropriate comparison strategies

```typescript
// Create a user store
const user = createStore<{ id: number, name: string, email: string, age?: number }>({
	id: 1,
	name: 'John Doe',
	email: 'john@example.com'
})

// Batch multiple updates to prevent intermediate states
batch(() => {
  user.name.set('Alice Doe')
  user.age.set(30)
  user.email.set('alice@example.com')
}) // Only triggers effects once at the end

// Optimize computed dependencies
const userDisplay = createComputed(() => {
  const { name, email } = user.get() // Gets entire object
  return `${name} <${email}>`
})

// Better: more granular dependencies
const userDisplay = createComputed(() => {
  return `${user.name.get()} <${user.email.get()}>` // Only depends on name/email
})
```

## Integration Patterns

### Framework Integration
The library is framework-agnostic but integrates well with:
- **React**: Use effects to trigger re-renders
- **Vue**: Integrate with Vue's reactivity system
- **Svelte**: Use effects to update Svelte stores
- **Vanilla JS**: Direct DOM manipulation in effects

### Testing Strategies
- **Unit Testing**: Test signal logic in isolation
- **Integration Testing**: Test effect chains and async operations
- **Mock Testing**: Mock external dependencies in computed signals
- **Property Testing**: Use random inputs to verify invariants

### Debugging Techniques
- Use `resolve()` to inspect multiple signal states at once
- Add logging effects for debugging reactivity chains
- Use AbortSignal inspection for async operation debugging
- Leverage TypeScript for compile-time dependency analysis

## Common Pitfalls and How to Avoid Them

1. **Infinite Loops**: Don't update signals within their own computed callbacks
2. **Stale Closures**: Be careful with captured values in async operations
3. **Memory Leaks**: Always clean up effects when components unmount
4. **Over-reactivity**: Structure data to minimize unnecessary updates
5. **Async Race Conditions**: Trust the automatic cancellation, don't fight it

## Advanced Use Cases

### Building Reactive Data Structures
```typescript
// Reactive list with computed properties
const todos = createStore<Todo[]>([])
const completedCount = createComputed(() => 
  todos.get().filter(todo => todo.completed).length
)
const remainingCount = createComputed(() => 
  todos.get().length - completedCount.get()
)
```

### Reactive State Machines
```typescript
const state = createState<'idle' | 'loading' | 'success' | 'error'>('idle')
const canRetry = () => state.get() === 'error'
const isLoading = () => state.get() === 'loading'
```

### Cross-Component Communication
```typescript
// Component ownership pattern: The component that emits events owns the store
// Component B (the emitter) declares the shape of events it will emit upfront
type EventBusSchema = {
  userLogin: { userId: number; timestamp: number }
  userLogout: { userId: number }
  userUpdate: { userId: number; profile: { name: string } }
}

// Initialize the event bus with proper typing
const eventBus = createStore<EventBusSchema>({
  userLogin: UNSET,
  userLogout: UNSET,
  userUpdate: UNSET,
})

// Type-safe emit function
const emit = <K extends keyof EventBusSchema>(
  event: K,
  data: EventBusSchema[K],
) => {
  eventBus[event].set(data)
}

// Type-safe on function with proper callback typing
const on = <K extends keyof EventBusSchema>(
  event: K,
  callback: (data: EventBusSchema[K]) => void,
) =>
  createEffect(() => {
    const data = eventBus[event].get()
    if (data !== UNSET) callback(data)
  })

// Usage example:
// Component A listens for user events
on('userLogin', (data) => {
  console.log('User logged in:', data) // data is properly typed
})

// Component B emits user events
eventBus.userLogin.set({ userId: 123, timestamp: Date.now() })
```

**Component ownership principle**: The component that emits events should own and initialize the event store. This creates clear boundaries and prevents coupling issues.

**Why this pattern?**: By having the owning component (Component B) initialize all known events with `UNSET`, we get:
1. **Fine-grained reactivity**: Each `on()` call establishes a direct dependency on the specific event signal
2. **Full type safety**: Event names and data shapes are constrained at compile time
3. **Simple logic**: No conditional updates, no store-wide watching in `on()`
4. **Clear ownership**: Component B declares its event contract upfront with a schema
5. **Better performance**: Only the specific event listeners trigger, not all listeners
6. **Explicit dependencies**: Effects track exactly which events they care about
7. **IntelliSense support**: IDEs can provide autocomplete for event names and data structures

This context should help you understand not just what the code does, but why it's structured this way and how to use it effectively in real-world applications.
