---
title: "Errors and Utilities"
description: "API reference for exported error classes, validation types, and utility helpers."
---

Import path for every item on this page: `@zeix/cause-effect`. Source files: `src/errors.ts` and `src/util.ts`.

## Error Types

```ts
class CircularDependencyError extends Error
class NullishSignalValueError extends TypeError
class UnsetSignalValueError extends Error
class InvalidSignalValueError extends TypeError
class InvalidCallbackError extends TypeError
class ReadonlySignalError extends Error
class RequiredOwnerError extends Error
```

The package also defines `DuplicateKeyError` internally in `src/errors.ts`, but it is not re-exported from `index.ts`.

Typical triggers:

| Error | When it appears |
|-------|-----------------|
| `CircularDependencyError` | A memo, task, or effect re-enters while already running. |
| `NullishSignalValueError` | You try to create or set a signal to `null` or `undefined`. |
| `UnsetSignalValueError` | A Sensor or Task is read before it has a value. |
| `InvalidSignalValueError` | A factory helper receives an invalid input shape. |
| `InvalidCallbackError` | A callback parameter is missing or not of the expected function kind. |
| `ReadonlySignalError` | `Slot#set()` reaches a read-only delegated source. |
| `RequiredOwnerError` | `match()` is called without an active effect or scope owner. |

## Validation Type

```ts
type Guard<T extends {}> = (value: unknown) => value is T
```

Use `guard` inside `SignalOptions<T>` and `ComputedOptions<T>` when the runtime value shape matters.

## Utility Functions

```ts
function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T
function isAsyncFunction<T>(fn: unknown): fn is (...args: unknown[]) => Promise<T>
function isSignalOfType<T>(value: unknown, type: string): value is T
function isRecord<T extends Record<string, unknown>>(value: unknown): value is T
function valueString(value: unknown): string
```

Deprecated exports:

```ts
function isObjectOfType<T>(value: unknown, type: string): value is T
function isUniformArray<T>(value: unknown, guard?: (item: T) => item is T & {}): value is T[]
const isEqual: <T extends {}>(a: T, b: T) => boolean
```

Usage:

```ts
import {
  createState,
  InvalidSignalValueError,
  isSignalOfType,
} from '@zeix/cause-effect'

const state = createState(1)

if (isSignalOfType(state, 'State')) {
  console.log(state.get())
}

try {
  // invalid on purpose
  throw new InvalidSignalValueError('Demo', null)
} catch (error) {
  console.error(error)
}
```

If you are building a wrapper library, prefer `isSignalOfType()` over `Object.prototype.toString` checks. The implementation in `src/util.ts` avoids string allocations and matches how the package's own guards work.
