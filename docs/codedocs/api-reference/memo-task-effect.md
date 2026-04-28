---
title: "Memo, Task, and Effect"
description: "API reference for synchronous derivation, async derivation, and side-effect routing."
---

Import path for every item on this page: `@zeix/cause-effect`. Source files: `src/nodes/memo.ts`, `src/nodes/task.ts`, and `src/nodes/effect.ts`.

## `createMemo`

```ts
function createMemo<T extends {}>(
  fn: (prev: T) => T,
  options: ComputedOptions<T> & { value: T },
): Memo<T>
function createMemo<T extends {}>(
  fn: MemoCallback<T>,
  options?: ComputedOptions<T>,
): Memo<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `MemoCallback<T>` | — | Sync computation that may read signals and receive the previous value. |
| `options.value` | `T` | `undefined` | Initial value for reducer patterns. |
| `options.equals` | `(a: T, b: T) => boolean` | `DEFAULT_EQUALITY` | Suppresses downstream propagation on equal results. |
| `options.guard` | `Guard<T>` | `undefined` | Validates the computed value. |
| `options.watched` | `(invalidate: () => void) => Cleanup` | `undefined` | Lazy invalidation hook for external triggers. |

```ts
type Memo<T extends {}> = {
  readonly [Symbol.toStringTag]: 'Memo'
  get(): T
}
```

## `createTask`

```ts
function createTask<T extends {}>(
  fn: (prev: T, signal: AbortSignal) => Promise<T>,
  options: ComputedOptions<T> & { value: T },
): Task<T>
function createTask<T extends {}>(
  fn: TaskCallback<T>,
  options?: ComputedOptions<T>,
): Task<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `TaskCallback<T>` | — | Async computation; the synchronous preamble defines dependencies. |
| `options.value` | `T` | `undefined` | Seed value used before the first resolution. |
| `options.equals` | `(a: T, b: T) => boolean` | `DEFAULT_EQUALITY` | Equality strategy for resolved values. |
| `options.guard` | `Guard<T>` | `undefined` | Validates resolved values. |
| `options.watched` | `(invalidate: () => void) => Cleanup` | `undefined` | External invalidation hook. |

```ts
type Task<T extends {}> = {
  readonly [Symbol.toStringTag]: 'Task'
  get(): T
  isPending(): boolean
  abort(): void
}
```

## `createEffect`

```ts
function createEffect(fn: EffectCallback): Cleanup
```

Runs immediately, tracks dependencies, and re-runs when they change.

## `match`

```ts
function match<T extends {}>(
  signal: Signal<T>,
  handlers: SingleMatchHandlers<T>,
): MaybeCleanup

function match<T extends readonly Signal<unknown & {}>[]>(
  signals: readonly [...T],
  handlers: MatchHandlers<T>,
): MaybeCleanup
```

Routing order is `nil` > `err` > `stale` > `ok`.

```ts
type MaybePromise<T> = T | Promise<T>
type SingleMatchHandlers<T extends {}> = {
  ok: (value: T) => MaybePromise<MaybeCleanup>
  err?: (error: Error) => MaybePromise<MaybeCleanup>
  nil?: () => MaybePromise<MaybeCleanup>
  stale?: () => MaybePromise<MaybeCleanup>
}
```

Usage:

```ts
import {
  createState,
  createTask,
  createEffect,
  match,
} from '@zeix/cause-effect'

const id = createState(1)

const user = createTask(async (_prev, abort) => {
  const response = await fetch(`/api/users/${id.get()}`, { signal: abort })
  return response.json() as Promise<{ name: string }>
})

createEffect(() => {
  match(user, {
    nil: () => console.log('Loading'),
    stale: () => console.log('Refreshing'),
    ok: value => console.log(value.name),
    err: error => console.error(error.message),
  })
})
```

Combined pattern:

```ts
import { createMemo } from '@zeix/cause-effect'

const displayName = createMemo(() => user.get().name.toUpperCase())
```

### Guards

```ts
function isMemo<T extends {} = unknown & {}>(value: unknown): value is Memo<T>
function isTask<T extends {} = unknown & {}>(value: unknown): value is Task<T>
```

Related pages: `/docs/async-effects` and `/docs/guides/async-data-pipelines`.
