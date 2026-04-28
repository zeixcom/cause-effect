---
title: "Signal Factories"
description: "API reference for createSignal, createMutableSignal, createComputed, and runtime signal guards."
---

Import path for every item on this page: `@zeix/cause-effect`. Source file: `src/signal.ts`.

These helpers are convenience factories that choose the appropriate primitive from a value or callback. They are useful in generic libraries that need to accept user input in more than one shape.

## `createComputed`

```ts
function createComputed<T extends {}>(
  callback: TaskCallback<T>,
  options?: ComputedOptions<T>,
): Task<T>
function createComputed<T extends {}>(
  callback: MemoCallback<T>,
  options?: ComputedOptions<T>,
): Memo<T>
```

If the callback is async, the factory returns a `Task`; otherwise it returns a `Memo`.

## `createSignal`

```ts
function createSignal<T extends {}>(value: Signal<T>): Signal<T>
function createSignal<T extends {}>(value: readonly T[]): List<T>
function createSignal<T extends UnknownRecord>(value: T): Store<T>
function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>
function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>
function createSignal<T extends {}>(value: T): State<T>
```

Resolution order from `src/signal.ts`:

1. Existing signal values are returned as-is.
2. Async functions become `Task`.
3. Sync functions become `Memo`.
4. Uniform arrays become `List`.
5. Plain records become `Store`.
6. Everything else becomes `State`.

## `createMutableSignal`

```ts
function createMutableSignal<T extends {}>(value: MutableSignal<T>): MutableSignal<T>
function createMutableSignal<T extends {}>(value: readonly T[]): List<T>
function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>
function createMutableSignal<T extends {}>(value: T): State<T>
```

This variant rejects functions and read-only signals because its job is to guarantee mutability.

## Runtime Guards

```ts
function isComputed<T extends {}>(value: unknown): value is Memo<T>
function isSignal<T extends {}>(value: unknown): value is Signal<T>
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}>
```

## Related Type

```ts
type MutableSignal<T extends {}> = {
  get(): T
  set(value: T): void
  update(callback: (value: T) => T): void
}
```

Usage:

```ts
import {
  createMutableSignal,
  createSignal,
  isSignal,
} from '@zeix/cause-effect'

const a = createSignal(() => 1)
const b = createSignal({ theme: 'light' })
const c = createMutableSignal(['a', 'b'])

console.log(isSignal(a), isSignal(b), c.get())
```

Use these helpers when building wrapper libraries, form adapters, or generic configuration APIs. In direct application code, explicit factories such as `createState()` or `createTask()` are usually clearer.
