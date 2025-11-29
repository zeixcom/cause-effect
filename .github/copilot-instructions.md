# Copilot Instructions for Cause & Effect

## Project Overview

Cause & Effect is a reactive state management library for JavaScript/TypeScript that provides signals-based reactivity. The library is built with modern JavaScript/TypeScript and follows functional programming principles with a focus on performance and type safety.

## Core Architecture

- **Signals**: Base reactive primitives with `.get()` method
- **State**: Mutable signals for primitive values (`createState()`)
- **Store**: Mutable signals for objects with reactive properties (`createStore()`)
- **Computed**: Derived read-only signals with memoization (`createComputed()`)
- **Effects**: Side effect handlers that react to signal changes (`createEffect()`)

## Key Files Structure

- `src/signal.ts` - Base signal types and utilities
- `src/state.ts` - Mutable state signals
- `src/store.ts` - Object stores with reactive properties
- `src/computed.ts` - Computed/derived signals
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
- Factory functions: `create*` (e.g., `createState`, `createStore`)
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
const count = createState(42)
const name = createState("Alice")

// Store for objects
const user = createStore({ name: "Alice", age: 30 })

// Computed for derived values
const doubled = createComputed(() => count.get() * 2)
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

## When suggesting code:
1. Follow the established patterns for signal creation and usage
2. Use proper TypeScript types and generics
3. Include JSDoc for public APIs
4. Consider performance implications
5. Handle errors appropriately
6. Support async operations with AbortSignal when relevant
7. Use the established utility functions (`UNSET`, `isEqual`, etc.)