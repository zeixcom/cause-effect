---
title: "Store, List, and Collection"
description: "API reference for composite object and keyed collection primitives."
---

Import path for every item on this page: `@zeix/cause-effect`. Source files: `src/nodes/store.ts`, `src/nodes/list.ts`, and `src/nodes/collection.ts`.

## `createStore`

```ts
function createStore<T extends UnknownRecord>(
  value: T,
  options?: StoreOptions,
): Store<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `T` | — | Initial plain object. Arrays become `List`, nested records become `Store`. |
| `options.watched` | `() => Cleanup` | `undefined` | Optional lifecycle callback for first subscriber / last unsubscribe. |

Key methods:

```ts
type Store<T extends UnknownRecord> = {
  get(): T
  set(next: T): void
  update(fn: (prev: T) => T): void
  keys(): IterableIterator<string>
  byKey<K extends keyof T & string>(key: K): ...
  add<K extends keyof T & string>(key: K, value: T[K]): K
  remove(key: string): void
}
```

## `createList`

```ts
function createList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(
  value: T[],
  options?: ListOptions<T, S>,
): List<T, S>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `T[]` | — | Initial list items. |
| `options.keyConfig` | `KeyConfig<T>` | auto-increment | String prefix or key callback. |
| `options.watched` | `() => Cleanup` | `undefined` | Lifecycle callback tied to subscribers. |
| `options.itemEquals` | `(a: T, b: T) => boolean` | `DEEP_EQUALITY` | Equality for default item signals. |
| `options.createItem` | `(value: T) => S` | `createState` | Custom signal factory for each item. |

Key methods:

```ts
type List<T extends {}, S extends MutableSignal<T> = MutableSignal<T>> = {
  get(): T[]
  set(next: T[]): void
  update(fn: (prev: T[]) => T[]): void
  at(index: number): S | undefined
  byKey(key: string): S | undefined
  keys(): IterableIterator<string>
  keyAt(index: number): string | undefined
  indexOfKey(key: string): number
  add(value: T): string
  remove(keyOrIndex: string | number): void
  replace(key: string, value: T): void
  sort(compareFn?: (a: T, b: T) => number): void
  splice(start: number, deleteCount?: number, ...items: T[]): T[]
  deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>
  deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>
}
```

## `createCollection`

```ts
function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(
  watched: CollectionCallback<T>,
  options?: CollectionOptions<T, S>,
): Collection<T, S>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `watched` | `CollectionCallback<T>` | — | Starts the external source and receives `applyChanges`. |
| `options.value` | `T[]` | `[]` | Initial collection value. |
| `options.keyConfig` | `KeyConfig<T>` | auto-increment | Key strategy. |
| `options.createItem` | `(value: T) => S` | `createState` | Custom item signal factory. |
| `options.itemEquals` | `(a: T, b: T) => boolean` | `DEEP_EQUALITY` | Equality for default item signals. |

Key methods:

```ts
type Collection<T extends {}, S extends Signal<T> = Signal<T>> = {
  get(): T[]
  keys(): IterableIterator<string>
  at(index: number): S | undefined
  byKey(key: string): S | undefined
  keyAt(index: number): string | undefined
  indexOfKey(key: string): number
  deriveCollection<R extends {}>(callback: (sourceValue: T) => R): Collection<R>
  deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): Collection<R>
  readonly length: number
}
```

Related types:

```ts
type StoreOptions = { watched?: () => Cleanup }
type KeyConfig<T> = string | ((item: T) => string | undefined)
type CollectionChanges<T> = { add?: T[]; change?: T[]; remove?: T[] }
type CollectionCallback<T extends {}> = (
  apply: (changes: CollectionChanges<T>) => void,
) => Cleanup
```

Usage:

```ts
import {
  createCollection,
  createEffect,
  createList,
  createStore,
} from '@zeix/cause-effect'

const settings = createStore({ theme: 'light', pageSize: 20 })
const rows = createList([{ id: 'a', value: 1 }], { keyConfig: item => item.id })
const labels = rows.deriveCollection(item => `${item.id}:${item.value}`)

createEffect(() => {
  console.log(settings.theme.get(), labels.get())
})
```

### Guards

```ts
function isStore<T extends UnknownRecord>(value: unknown): value is Store<T>
function isList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(value: unknown): value is List<T, S>
function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is Collection<T, S>
```

Related pages: `/docs/composite-collections` and `/docs/guides/keyed-collections`.
