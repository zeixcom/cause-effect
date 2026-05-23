---
title: "State and Sensor"
description: "API reference for mutable state and lazy external input signals."
---

Import path for every item on this page: `@zeix/cause-effect`. Source files: `src/nodes/state.ts` and `src/nodes/sensor.ts`.

## `createState`

```ts
function createState<T extends {}>(
  value: T,
  options?: SignalOptions<T>,
): State<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `T` | — | Initial non-null value. |
| `options.guard` | `Guard<T>` | `undefined` | Runtime value validator for future writes. |
| `options.equals` | `(a: T, b: T) => boolean` | `DEFAULT_EQUALITY` | Equality strategy for propagation. |

Return type:

```ts
type State<T extends {}> = {
  readonly [Symbol.toStringTag]: 'State'
  get(): T
  set(next: T): void
  update(fn: UpdateCallback<T>): void
}
```

Usage:

```ts
import { createState } from '@zeix/cause-effect'

const count = createState(0)
count.set(1)
count.update(value => value + 1)
```

### `isState`

```ts
function isState<T extends {} = unknown & {}>(value: unknown): value is State<T>
```

## `createSensor`

```ts
function createSensor<T extends {}>(
  watched: SensorCallback<T>,
  options?: SensorOptions<T>,
): Sensor<T>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `watched` | `SensorCallback<T>` | — | Starts external observation and returns cleanup. |
| `options.value` | `T` | `undefined` | Initial value to avoid unset reads. |
| `options.guard` | `Guard<T>` | `undefined` | Validates `set(next)` values inside the sensor. |
| `options.equals` | `(a: T, b: T) => boolean` | `DEFAULT_EQUALITY` | Use `SKIP_EQUALITY` for mutable references. |

Return type:

```ts
type Sensor<T extends {}> = {
  readonly [Symbol.toStringTag]: 'Sensor'
  get(): T
}
```

Usage:

```ts
import { createSensor, createEffect } from '@zeix/cause-effect'

const mouse = createSensor<{ x: number; y: number }>(set => {
  const handler = (event: MouseEvent) => set({ x: event.clientX, y: event.clientY })
  window.addEventListener('mousemove', handler)
  return () => window.removeEventListener('mousemove', handler)
})

createEffect(() => console.log(mouse.get()))
```

Mutable-object pattern:

```ts
import {
  createSensor,
  createEffect,
  SKIP_EQUALITY,
} from '@zeix/cause-effect'

const element = document.getElementById('status')!

const observed = createSensor<HTMLElement>(set => {
  set(element)
  const observer = new MutationObserver(() => set(element))
  observer.observe(element, { attributes: true })
  return () => observer.disconnect()
}, { value: element, equals: SKIP_EQUALITY })

createEffect(() => console.log(observed.get().className))
```

### `isSensor`

```ts
function isSensor<T extends {} = unknown & {}>(value: unknown): value is Sensor<T>
```

## Related Types

```ts
type UpdateCallback<T extends {}> = (prev: T) => T
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup
type SensorOptions<T extends {}> = SignalOptions<T> & { value?: T }
```

Related pages: `/docs/state-and-derived`, `/docs/external-integration`, `/docs/types`.
