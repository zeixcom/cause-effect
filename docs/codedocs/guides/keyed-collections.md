---
title: "Keyed Collections"
description: "Manage entity-style arrays with stable keys, item-level updates, and derived collections."
---

This guide covers the library's recommended pattern for entity lists such as todos, menu items, or dashboard widgets. The goal is to keep item identity stable through reordering while preserving granular subscriptions to single items.

<Steps>
<Step>
### Create a keyed list

```ts
import { createList } from '@zeix/cause-effect'

type Todo = { id: string; title: string; done: boolean }

const todos = createList<Todo>(
  [
    { id: 'a', title: 'Write docs', done: false },
    { id: 'b', title: 'Ship release', done: true },
  ],
  { keyConfig: item => item.id },
)
```

</Step>
<Step>
### Subscribe at the item level

```ts
import { createEffect } from '@zeix/cause-effect'

const first = todos.byKey('a')

createEffect(() => {
  console.log(first?.get().title)
})
```

</Step>
<Step>
### Update an item without recreating its signal

```ts
todos.replace('a', {
  id: 'a',
  title: 'Write final docs',
  done: false,
})
```

</Step>
<Step>
### Derive a read-only collection from the list

```ts
const visibleTitles = todos.deriveCollection(item =>
  item.done ? 'archived' : item.title,
)
```

</Step>
<Step>
### Reorder safely

```ts
todos.sort((a, b) => a.title.localeCompare(b.title))
```

</Step>
</Steps>

Complete runnable example:

```ts
import { createList, createEffect, createMemo } from '@zeix/cause-effect'

type Todo = { id: string; title: string; done: boolean }

const todos = createList<Todo>(
  [
    { id: 'a', title: 'Write docs', done: false },
    { id: 'b', title: 'Ship release', done: true },
  ],
  { keyConfig: item => item.id },
)

const openCount = createMemo(
  () => todos.get().filter(item => !item.done).length,
)

const visibleTitles = todos.deriveCollection(item =>
  item.done ? 'archived' : item.title,
)

createEffect(() => {
  console.log(openCount.get(), visibleTitles.get())
})

todos.replace('a', { id: 'a', title: 'Write final docs', done: false })
todos.add({ id: 'c', title: 'Audit docs build', done: false })
todos.sort((a, b) => a.title.localeCompare(b.title))
```

Use `createCollection()` instead of `createList()` when the collection is fed by an external producer and your code should not mutate it directly. Use `createStore()` as `createItem` when each list item needs nested per-property reactivity instead of a single item-level signal.
