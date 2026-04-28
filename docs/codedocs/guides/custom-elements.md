---
title: "Custom Elements and External Lifecycles"
description: "Integrate Cause & Effect with custom elements using Sensor, Slot, createScope, and unown."
---

Cause & Effect is intentionally not a rendering framework, but it is designed to support integration layers cleanly. This guide shows a practical pattern for a custom element that owns its own lifecycle, consumes external attributes, and exposes a stable delegated property.

<Steps>
<Step>
### Create internal state and reactive DOM updates

```ts
import { createState, createScope, createEffect, unown } from '@zeix/cause-effect'

const label = createState('idle')

class StatusBadge extends HTMLElement {
  #dispose?: () => void

  connectedCallback() {
    this.#dispose = unown(() =>
      createScope(() => {
        createEffect(() => {
          this.textContent = label.get()
        })
      }, { root: true }),
    )
  }

  disconnectedCallback() {
    this.#dispose?.()
  }
}
```

</Step>
<Step>
### Bridge external events with a Sensor

```ts
import { createSensor, createEffect } from '@zeix/cause-effect'

const online = createSensor<boolean>(set => {
  const update = () => set(navigator.onLine)
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  return () => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
})

createEffect(() => {
  label.set(online.get() ? 'online' : 'offline')
})
```

</Step>
<Step>
### Expose a stable property with a Slot

```ts
import { createSlot, createState } from '@zeix/cause-effect'

const internalValue = createState('draft')
const valueSlot = createSlot(internalValue)

Object.defineProperty(StatusBadge.prototype, 'value', valueSlot)
```

</Step>
<Step>
### Swap the backing source when a parent controls it

```ts
import { createMemo } from '@zeix/cause-effect'

const controlledValue = createMemo(() => `${label.get()}:${internalValue.get()}`)
valueSlot.replace(controlledValue)
```

</Step>
</Steps>

Complete runnable example:

```ts
import {
  createEffect,
  createMemo,
  createScope,
  createSensor,
  createSlot,
  createState,
  unown,
} from '@zeix/cause-effect'

const internalValue = createState('draft')
const online = createSensor<boolean>(set => {
  const update = () => set(navigator.onLine)
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  return () => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
})

const valueSlot = createSlot(internalValue)

class StatusBadge extends HTMLElement {
  #dispose?: () => void

  connectedCallback() {
    this.#dispose = unown(() =>
      createScope(() => {
        createEffect(() => {
          this.textContent = `${online.get() ? 'online' : 'offline'}:${valueSlot.get()}`
        })
      }, { root: true }),
    )
  }

  disconnectedCallback() {
    this.#dispose?.()
  }
}

Object.defineProperty(StatusBadge.prototype, 'value', valueSlot)
customElements.define('status-badge', StatusBadge)

const controlled = createMemo(() => `status:${internalValue.get()}`)
valueSlot.replace(controlled)
```

This is the pattern the source code is optimized for: the DOM owns connection and disconnection, while the graph owns reactive updates and cleanup inside that lifetime.
