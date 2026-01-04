# Copilot Instructions for Cause & Effect

## Project Overview

Cause & Effect is a reactive state management library for JavaScript/TypeScript that provides signals-based reactivity. The library is built with modern JavaScript/TypeScript and follows functional programming principles with a focus on performance and type safety.

## Core Architecture

- **Signals**: Base reactive primitives with `.get()` method
- **State**: Mutable signals for primitive values (`new State()`)
- **Ref**: Signal wrappers for external objects that change outside reactive system (`new Ref()`)
- **Computed**: Derived read-only signals with memoization, reducer capabilities and async support (`new Memo()`, `new Task()`)
- **Store**: Mutable signals for objects with reactive properties (`createStore()`)
- **List**: Mutable signals for arrays with stable keys and reactive entries (`new List()`)
- **Collection**: Interface for reactive collections (implemented by `DerivedCollection`)
- **Effects**: Side effect handlers that react to signal changes (`createEffect()`)

## Key Files Structure

- `src/classes/state.ts` - Mutable state signals
- `src/classes/ref.ts` - Signal wrappers for external objects (DOM, Map, Set, etc.)
- `src/classes/store.ts` - Object stores with reactive properties
- `src/classes/list.ts` - Array stores with stable keys and reactive items
- `src/classes/collection.ts` - Collection interface and DerivedCollection implementation
- `src/classes/computed.ts` - Computed/derived signals
- `src/signal.ts` - Base signal types and utilities
- `src/effect.ts` - Effect system
- `src/system.ts` - Core reactivity system (watchers, batching)
- `src/util.ts` - Utility functions and constants
- `index.ts` - Main export file

## Coding Conventions

### TypeScript Style
- Use `const` for immutable values, prefer immutability
- Generic constraints: `T extends {}` to exclude nullish values
- Function overloads for complex type inference
- Pure functions marked with `/*#__PURE__*/` for tree-shaking
- JSDoc comments for all public APIs

### Naming Conventions
- Factory functions: `create*` (e.g., `createEffect`, `createStore`)
- Type predicates: `is*` (e.g., `isSignal`, `isState`)
- Constants: `TYPE_*` for type tags, `UPPER_CASE` for values
- Private variables: use descriptive names, no underscore prefix

### Error Handling
- Custom error classes in `src/errors.ts`
- Validate inputs and throw descriptive errors
- Use `UNSET` symbol for uninitialized/pending states
- Support AbortSignal for cancellation in async operations

### Performance Patterns
- Use `Set<Watcher>` for efficient subscription management
- Batch updates to minimize effect re-runs
- Memoization in computed signals
- Shallow equality checks with `isEqual()` utility
- Tree-shaking friendly with pure function annotations

### API Design Principles
- All signals have `.get()` method for value access
- Mutable signals have `.set(value)` and `.update(fn)` methods
- Store properties are automatically reactive signals
- Effects receive AbortSignal for async cancellation
- Helper functions like `resolve()`, `match()`, `diff()` for ergonomics

### Testing Patterns
- Use Bun test runner
- Test reactivity chains and dependency tracking
- Test async cancellation behavior
- Test error conditions and edge cases

## Common Code Patterns

### Creating Signals
```typescript
// State for primitives
const count = new State(42)
const name = new State('Alice')
const actions = new State<'increment' | 'decrement'>('increment')

// Ref for external objects
const elementRef = new Ref(document.getElementById('status'))
const cacheRef = new Ref(new Map())

// Store for objects
const user = createStore({ name: 'Alice', age: 30 })

// List with stable keys for arrays
const items = new List(['apple', 'banana', 'cherry'])
const users = new List([{ id: 'alice', name: 'Alice' }], user => user.id)

// Computed for derived values
const doubled = new Memo(() => count.get() * 2)

// Computed with reducer capabilities
const counter = new Memo(prev => {
  const action = actions.get()
  return action === 'increment' ? prev + 1 : prev - 1
}, 0) // Initial value
```

### Reactivity
```typescript
// Effects run when dependencies change
createEffect(() => {
  console.log(`Count is ${count.get()}`)
})

// Async effects with cancellation
createEffect(async (abort) => {
  const response = await fetch('/api', { signal: abort })
  return response.json()
})

// Async computed with old value access
const userData = new Task(async (prev, abort) => {
  if (!userId.get()) return prev // Keep previous data if no user
  const response = await fetch(`/users/${userId.get()}`, { signal: abort })
  return response.json()
})
```

### Type Safety
```typescript
// Use proper generic constraints
function createSignal<T extends {}>(value: T): Signal<T>

// Type predicates for runtime checks
function isSignal<T extends {}>(value: unknown): value is Signal<T>
```

## Build System
- Uses Bun as build tool and runtime
- TypeScript compilation with declaration files
- Minified production build
- ES modules only (`"type": "module"`)

## Store Methods and Stable Keys

### List Methods
- `byKey(key)` - Access signals by stable key instead of index
- `keyAt(index)` - Get stable key at specific position
- `indexOfKey(key)` - Get position of stable key in current order
- `splice(start, deleteCount, ...items)` - Array-like splicing with stable key preservation
- `sort(compareFn)` - Sort items while maintaining stable key associations

### Stable Keys Usage
```typescript
// Default auto-incrementing keys
const items = new List(['a', 'b', 'c'])

// String prefix keys
const items = new List(['apple', 'banana'], 'fruit')
// Creates keys: 'fruit0', 'fruit1'

// Function-based keys
const users = new List([
  { id: 'user1', name: 'Alice' },
  { id: 'user2', name: 'Bob' }
], user => user.id) // Uses user.id as stable key

// Collections derived from lists
const userProfiles = new DerivedCollection(users, user => ({
  ...user,
  displayName: `${user.name} (ID: ${user.id})`
}))

// Chained collections for data pipelines
const activeUserSummaries = users
  .deriveCollection(user => ({ ...user, active: user.lastLogin > Date.now() - 86400000 }))
  .deriveCollection(user => user.active ? `Active: ${user.name}` : null)
  .filter(Boolean)
```

## Resource Management

All signals support `.on('watch', callback)` for lazy resource allocation. Resources are only created when signals are accessed by effects and automatically cleaned up when no longer watched.

## When suggesting code:
1. Follow the established patterns for signal creation and usage
2. Use proper TypeScript types and generics
3. Include JSDoc for public APIs
4. Consider performance implications
5. Handle errors appropriately
6. Support async operations with AbortSignal when relevant
7. Use the established utility functions (`UNSET`, `isEqual`, etc.)
