---
title: "Types"
description: "Reference for the exported TypeScript types and interfaces shipped by Cause & Effect."
---

All types on this page are exported from `@zeix/cause-effect`. The canonical declarations live in `types/index.d.ts` and the module files under `types/src/`.

## Core Graph Types

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
type Guard<T extends {}> = (value: unknown) => value is T
```

Use these when authoring wrappers or higher-level abstractions. `SignalOptions<T>` is the shared configuration surface for writable and computed signals. `ComputedOptions<T>` adds the reducer seed (`value`) and the lazy watched invalidation hook.

## Signal Interfaces

```ts
type State<T extends {}> = {
  get(): T
  set(next: T): void
  update(fn: UpdateCallback<T>): void
}

type Memo<T extends {}> = {
  get(): T
}

type Task<T extends {}> = {
  get(): T
  isPending(): boolean
  abort(): void
}

type Sensor<T extends {}> = {
  get(): T
}

type SlotDescriptor<T extends {}> = {
  get(): T
  set?(next: T): void
}

type Slot<T extends {}> = {
  get(): T
  set(next: T): void
  replace<U extends T>(next: Signal<U> | SlotDescriptor<U>): void
  current(): Signal<T> | SlotDescriptor<T>
}

type MutableSignal<T extends {}> = {
  get(): T
  set(value: T): void
  update(callback: (value: T) => T): void
}
```

`State` and `MutableSignal` overlap, but `MutableSignal` is deliberately broader: it is the common writable contract used by helpers such as `createMutableSignal()` and the `List` item factory.

## Collection Types

```ts
type UpdateCallback<T extends {}> = (prev: T) => T
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup
type SensorOptions<T extends {}> = SignalOptions<T> & { value?: T }
type KeyConfig<T> = string | ((item: T) => string | undefined)
type ListOptions<T extends {}, S extends MutableSignal<T> = MutableSignal<T>> = {
  keyConfig?: KeyConfig<T>
  watched?: () => Cleanup
  itemEquals?: (a: T, b: T) => boolean
  createItem?: (value: T) => S
}
type StoreOptions = { watched?: () => Cleanup }
type CollectionChanges<T> = { add?: T[]; change?: T[]; remove?: T[] }
type CollectionOptions<T extends {}, S extends Signal<T> = Signal<T>> = {
  value?: T[]
  keyConfig?: KeyConfig<T>
  createItem?: (value: T) => S
  itemEquals?: (a: T, b: T) => boolean
}
type CollectionCallback<T extends {}> = (
  apply: (changes: CollectionChanges<T>) => void,
) => Cleanup
type DeriveCollectionCallback<T extends {}, U extends {}> =
  | ((sourceValue: U) => T)
  | ((sourceValue: U, abort: AbortSignal) => Promise<T>)
```

These types express the customizability of Store, List, and Collection. `KeyConfig<T>` is especially important because it determines whether identity is positional or content-based.

## Match Handler Types

```ts
type MaybePromise<T> = T | Promise<T>

type SingleMatchHandlers<T extends {}> = {
  ok: (value: T) => MaybePromise<MaybeCleanup>
  err?: (error: Error) => MaybePromise<MaybeCleanup>
  nil?: () => MaybePromise<MaybeCleanup>
  stale?: () => MaybePromise<MaybeCleanup>
}

type MatchHandlers<T extends readonly Signal<unknown & {}>[]> = {
  ok: (values: {
    [K in keyof T]: T[K] extends Signal<infer V> ? V : never
  }) => MaybePromise<MaybeCleanup>
  err?: (errors: readonly Error[]) => MaybePromise<MaybeCleanup>
  nil?: () => MaybePromise<MaybeCleanup>
  stale?: () => MaybePromise<MaybeCleanup>
}
```

These are the types that make `match()` practical in TypeScript. The tuple-preserving `MatchHandlers<T>` declaration is why `match([user, settings], { ok(values) { ... } })` receives typed values in order instead of a widened union array.

## Shape Types for Composite Signals

The exact `Store<T>`, `List<T, S>`, and `Collection<T, S>` definitions are large because they map nested generic structure to nested reactive structure. The short version is:

- `Store<T>` mirrors a plain object where each property becomes `State`, nested `Store`, or `List`.
- `List<T, S>` is an ordered iterable of item signals `S` with structural helpers such as `keyAt`, `replace`, and `splice`.
- `Collection<T, S>` is the read-only keyed counterpart with `deriveCollection()` support.

For the full method surfaces and examples, see `/docs/api-reference/store-list-collection`.
