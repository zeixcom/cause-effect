# Collections - Read-Only Derived Array-Like Stores

## Overview

Collections are the read-only, derived counterpart to array-like Stores, completing the signal type matrix:

```
              Single Value    Multi-Value
Mutable       State          Store  
Read-Only     Computed       Collection
```

Collections provide a reactive, memoized, and lazily-evaluated way to transform arrays while maintaining the familiar array-like store interface. They use Computed signals internally, inheriting all their benefits: automatic dependency tracking, memoization, glitch-free updates, and automatic cleanup.

## Core Concepts

### Internal Architecture
- **Built on Computed**: Collections use Computed signals internally for lazy evaluation and memoization
- **Automatic Cleanup**: When no longer watched, Collections automatically clean up subscriptions to upstream signals
- **Glitch-Free Updates**: Share the same change propagation mechanism as Computed signals
- **Dependency Tracking**: Automatically track dependencies when `initializeFn` or `mapFn` calls `.get()` on other signals

### Performance Characteristics
- **Lazy Evaluation**: Only computed when requested by watchers/effects
- **Item-Level Laziness**: Each item's `mapFn` is only called when that specific item is accessed
- **Memoization Trade-off**: Higher memory footprint but better performance for repeated access and async operations
- **No Polling**: Updates are purely signal-driven, but users can implement polling in `initializeFn` if needed

## API Surface

### Factory Functions
```typescript
// Standalone Collections (external data sources)
createCollection<T>(
  initializeFn: () => T[],
  keyConfig?: KeyConfig<T>
): Collection<T>

// Derived Collections (from existing stores)
store.deriveCollection<U>(
  mapFn: (items: T[]) => U[],
  keyConfig?: KeyConfig<U>
): Collection<U>

// Type predicate
isCollection<T>(value: unknown): value is Collection<T>
```

### Collection Interface
Collections have the same interface as array-like stores, **minus mutation methods**:

#### Available Methods
- **Value Access**: `.get()`, proxy access via index/key
- **Iteration**: `Symbol.iterator`, `for...of`, spread operator
- **Key Helpers**: `.byKey()`, `.keyAt()`, `.indexOfKey()`
- **Ordering**: `.sort()` (local sorting, overridden by source changes)
- **Properties**: `.length`, event listeners via `.on()`

#### Unavailable Methods (Read-Only)
- **Mutations**: `.add()`, `.remove()`, `.splice()`, `.set()`, `.update()`
  - These methods will throw `ReadOnlyError` if called

## Key Configuration

### Auto-Generated Keys (Default)
```typescript
// Counter-based keys for standalone collections
const files = createCollection(() => glob.sync('src/**/*.ts'))
// Keys: '0', '1', '2', ...

// Inherited keys for derived collections
const activeUsers = users.deriveCollection(users => users.filter(u => u.active))
// Preserves original store keys where possible
```

### String Prefix Keys
```typescript
const elements = createCollection(
  () => document.querySelectorAll('.item'),
  'element'
)
// Keys: 'element0', 'element1', 'element2', ...
```

### Function-Based Keys
```typescript
// Custom identifier extraction
const sourceFiles = createCollection(
  () => glob.sync('src/**/*.ts'),
  filepath => filepath // Use filepath as key
)

// Transform existing keys
const userProfiles = users.deriveCollection(
  users => users.map(transformToProfile),
  user => `profile_${user.id}` // Transform store keys
)
```

## Use Cases

### 1. Data Transformations
```typescript
const allTodos = createStore([
  { id: 'task1', text: 'Learn signals', completed: false },
  { id: 'task2', text: 'Build app', completed: true }
], todo => todo.id)

// Reactive filtered view
const completedTodos = allTodos.deriveCollection(
  todos => todos.filter(todo => todo.completed),
  todo => todo.id
)

// Reactive mapped view
const todoSummaries = allTodos.deriveCollection(
  todos => todos.map(todo => ({
    id: todo.id,
    summary: `${todo.text} (${todo.completed ? 'done' : 'pending'})`
  })),
  summary => summary.id
)
```

### 2. External Data Sources
```typescript
// File system watching for HMR
const sourceFiles = createCollection(
  () => {
    const files = glob.sync('src/**/*.{ts,tsx}')
    // Could set up file watcher in effect
    return files.map(filepath => ({ path: filepath, mtime: fs.statSync(filepath).mtime }))
  },
  file => file.path
)

// DOM element tracking
const clickableElements = createCollection(
  () => Array.from(document.querySelectorAll('[data-clickable]')).map(el => ({
    id: el.id,
    element: el,
    rect: el.getBoundingClientRect()
  })),
  item => item.id
)
```

### 3. Cross-Signal Dependencies
```typescript
const searchTerm = createState('')
const allItems = createStore([...], item => item.id)

const searchResults = createCollection(() => {
  const term = searchTerm.get().toLowerCase()
  const items = allItems.get()
  
  return term
    ? items.filter(item => item.name.toLowerCase().includes(term))
    : items
}, item => item.id)
```

### 4. Composable Pipelines
```typescript
const users = createStore([...])
const activeUsers = users.deriveCollection(users => users.filter(u => u.active))
const userNames = activeUsers.deriveCollection(users => users.map(u => u.name))
const sortedNames = userNames.deriveCollection(names => [...names].sort())
```

## Sorting Behavior

Collections support local sorting that doesn't affect the source:

```typescript
const items = createStore(['c', 'a', 'b'])
const sortedView = items.deriveCollection(items => items)

sortedView.sort() // Sorts view locally: ['a', 'b', 'c']

items.add('d') // Adds to source, overrides local sort
// sortedView now shows: ['c', 'a', 'b', 'd'] (source order)
```

## Error Handling

### Read-Only Violations
```typescript
const collection = createCollection(() => [1, 2, 3])

collection.add(4)    // Throws ReadOnlyError
collection.remove(0) // Throws ReadOnlyError
collection.set([4])  // Throws ReadOnlyError
```

### Key Namespace Isolation
Collections maintain their own key namespace, preventing conflicts:
- Source keys don't conflict with collection keys
- Users responsible for uniqueness in destination systems (e.g., DOM IDs)

## Implementation Todo List

### Phase 1: Core Infrastructure
- [ ] Define `Collection<T>` interface extending base signal types
- [ ] Implement `TYPE_COLLECTION` constant and type tagging
- [ ] Create `isCollection<T>()` type predicate utility
- [ ] Design internal computed signal wrapper architecture
- [ ] Implement basic lazy evaluation mechanism

### Phase 2: Factory Functions
- [ ] Implement `createCollection<T>()` standalone factory
- [ ] Add `deriveCollection<U>()` method to Store interface
- [ ] Implement key configuration parsing and validation
- [ ] Create auto-incrementing key generation system
- [ ] Implement function-based key transformation

### Phase 3: Collection Implementation
- [ ] Implement core Collection class with computed signal integration
- [ ] Add `.get()` method returning current array snapshot
- [ ] Implement proxy handler for index/key access
- [ ] Add `Symbol.iterator` for iteration support
- [ ] Implement `.length` getter with reactivity

### Phase 4: Key Management
- [ ] Implement `.byKey()` method for stable key access
- [ ] Add `.keyAt()` method for index-to-key mapping
- [ ] Implement `.indexOfKey()` method for key-to-index mapping
- [ ] Create stable key preservation logic for derived collections
- [ ] Handle key conflicts and validation

### Phase 5: Array-Like Interface
- [ ] Implement read-only `.sort()` method (local sorting)
- [ ] Add event notification system (`.on()` method)
- [ ] Implement `Symbol.toStringTag` and other standard symbols
- [ ] Add support for spread operator and destructuring
- [ ] Implement `Object.keys()` and enumeration support

### Phase 6: Testing & Documentation
- [ ] Create comprehensive test suite for all methods
- [ ] Test error conditions and edge cases
- [ ] Add performance benchmarks
- [ ] Test memory leak scenarios and cleanup
- [ ] Create integration tests with stores and effects

### Phase 7: TypeScript & Developer Experience
- [ ] Add comprehensive type definitions
- [ ] Implement proper generic constraints
- [ ] Add JSDoc documentation for all public APIs
- [ ] Create type-safe key configuration system
- [ ] Add IntelliSense support for collection methods
