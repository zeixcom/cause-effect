---
title: "Slot"
description: "API reference for stable delegated signal surfaces used in integration layers."
---

Import path for every item on this page: `@zeix/cause-effect`. Source file: `src/nodes/slot.ts`.

## `createSlot`

```ts
function createSlot<T extends {}>(
  initialSignal: Signal<T> | SlotDescriptor<T>,
  options?: SignalOptions<T>,
): Slot<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialSignal` | `Signal<T> \| SlotDescriptor<T>` | — | Initial delegated source. |
| `options.guard` | `Guard<T>` | `undefined` | Validates forwarded writes. |
| `options.equals` | `(a: T, b: T) => boolean` | `DEFAULT_EQUALITY` | Equality for delegated reads. |

Return type:

```ts
type Slot<T extends {}> = {
  readonly [Symbol.toStringTag]: 'Slot'
  configurable: true
  enumerable: true
  get(): T
  set(next: T): void
  replace<U extends T>(next: Signal<U> | SlotDescriptor<U>): void
  current(): Signal<T> | SlotDescriptor<T>
}
```

Related descriptor type:

```ts
type SlotDescriptor<T extends {}> = {
  get(): T
  set?(next: T): void
}
```

Usage as a property descriptor:

```ts
import { createSlot, createState } from '@zeix/cause-effect'

const source = createState('draft')
const slot = createSlot(source)

const target: Record<string, unknown> = {}
Object.defineProperty(target, 'value', slot)

;(target as { value: string }).value = 'published'
console.log(source.get()) // published
```

Usage with replacement:

```ts
import { createMemo, createSlot, createState } from '@zeix/cause-effect'

const local = createState(1)
const parent = createState(10)
const derived = createMemo(() => parent.get() * 2)

const slot = createSlot(local)
slot.replace(derived)

console.log(slot.get()) // 20
```

### `isSlot`

```ts
function isSlot<T extends {} = unknown & {}>(value: unknown): value is Slot<T>
```

Common pattern: keep the slot reference in your adapter layer, even if you expose only the descriptor fields on an object. The descriptor stored on the object will not give you `replace()` back later, because `Object.getOwnPropertyDescriptor()` only exposes the standard descriptor fields. If you need to inspect or swap the active source, call `slot.current()` on the retained slot handle. That makes Slot a good fit for custom elements, framework adapters, or host objects that need a stable property contract while the backing signal changes over time.

Related pages: `/docs/external-integration` and `/docs/guides/custom-elements`.
