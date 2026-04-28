---
title: "Graph Utilities"
description: "Reference for the core graph-level exports: batch, createScope, untrack, unown, equality presets, and shared option types."
---

Import path for every item on this page: `@zeix/cause-effect`. Source definitions live primarily in `src/graph.ts`.

## Equality Presets

```ts
const DEFAULT_EQUALITY: <T extends {}>(a: T, b: T) => boolean
const DEEP_EQUALITY: <T extends {}>(a: T, b: T) => boolean
const SKIP_EQUALITY: (_a?: unknown, _b?: unknown) => boolean
```

- `DEFAULT_EQUALITY` uses strict equality and is the implicit default for all signals.
- `DEEP_EQUALITY` recursively compares arrays and plain objects.
- `SKIP_EQUALITY` always returns `false`, so every write propagates.

## Functions

### `batch`

```ts
function batch(fn: () => void): void
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `() => void` | — | Runs a transaction. Effects flush only after the outermost batch ends. |

```ts
import { batch, createState } from '@zeix/cause-effect'

const a = createState(1)
const b = createState(2)

batch(() => {
  a.set(3)
  b.set(4)
})
```

### `createScope`

```ts
function createScope(fn: () => MaybeCleanup, options?: ScopeOptions): Cleanup
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `() => MaybeCleanup` | — | Runs with a temporary active owner. |
| `options` | `ScopeOptions` | `undefined` | Pass `{ root: true }` to avoid automatic parent registration. |

```ts
import { createScope, createEffect, createState } from '@zeix/cause-effect'

const count = createState(0)

const dispose = createScope(() => {
  createEffect(() => console.log(count.get()))
})
```

### `untrack`

```ts
function untrack<T>(fn: () => T): T
```

Reads inside `fn` do not create dependency edges.

### `unown`

```ts
function unown<T>(fn: () => T): T
```

Runs `fn` with no active owner. Use it for DOM-owned or externally-owned lifecycles.

## Shared Types

```ts
type Signal<T extends {}> = { get(): T }
type Cleanup = () => void
type MaybeCleanup = Cleanup | undefined | void
type SignalOptions<T extends {}> = {
  guard?: Guard<T>
  equals?: (a: T, b: T) => boolean
}
type ComputedOptions<T extends {}> = SignalOptions<T> & {
  value?: T
  watched?: (invalidate: () => void) => Cleanup
}
type ScopeOptions = { root?: boolean }
type MemoCallback<T extends {}> = (prev: T | undefined) => T
type TaskCallback<T extends {}> = (
  prev: T | undefined,
  signal: AbortSignal,
) => Promise<T>
type EffectCallback = () => MaybeCleanup
```

## Common Pattern

Combine `batch()` with `createScope()` when an integration point owns a bundle of effects:

```ts
import {
  batch,
  createEffect,
  createScope,
  createState,
} from '@zeix/cause-effect'

const left = createState(0)
const top = createState(0)

const dispose = createScope(() => {
  createEffect(() => {
    console.log(`${left.get()},${top.get()}`)
  })
})

batch(() => {
  left.set(10)
  top.set(20)
})

dispose()
```

Related pages: `/docs/api-reference/state-sensor`, `/docs/api-reference/memo-task-effect`, and `/docs/types`.
