---
title: "Async Data Pipelines"
description: "Build cancellable async workflows with createTask, match, and batching."
---

This guide shows a realistic pattern for search or detail views where requests can overlap, stale data should stay visible during refresh, and the UI should not manage separate loading flags. The core APIs are `createState()`, `createTask()`, `createMemo()`, `createEffect()`, and `match()` from `@zeix/cause-effect`.

<Steps>
<Step>
### Model the reactive inputs

```ts
import { createState, createMemo } from '@zeix/cause-effect'

const query = createState('books')
const page = createState(1)

const requestKey = createMemo(() => ({
  query: query.get().trim(),
  page: page.get(),
}))
```

</Step>
<Step>
### Create a task that derives from those inputs

```ts
import { createTask } from '@zeix/cause-effect'

type SearchResponse = {
  items: { id: string; title: string }[]
  total: number
}

const results = createTask<SearchResponse>(
  async (prev, abort) => {
    const { query, page } = requestKey.get()
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&page=${page}`,
      { signal: abort },
    )

    if (!response.ok) throw new Error('Search failed')
    return response.json()
  },
  { value: { items: [], total: 0 } },
)
```

</Step>
<Step>
### Derive synchronous view state from the task

```ts
import { createMemo } from '@zeix/cause-effect'

const totalPages = createMemo(() => {
  const total = results.get().total
  return Math.max(1, Math.ceil(total / 20))
})
```

</Step>
<Step>
### Route side effects with `match()`

```ts
import { createEffect, match } from '@zeix/cause-effect'

createEffect(() => {
  match(results, {
    nil: () => console.log('Loading first page...'),
    stale: () => console.log('Refreshing while keeping current rows visible...'),
    ok: data => console.log(`Loaded ${data.items.length} rows`),
    err: error => console.error(error.message),
  })
})
```

</Step>
<Step>
### Update related inputs in one transaction

```ts
import { batch } from '@zeix/cause-effect'

function submitSearch(nextQuery: string) {
  batch(() => {
    query.set(nextQuery)
    page.set(1)
  })
}
```

</Step>
</Steps>

Complete runnable example:

```ts
import {
  batch,
  createEffect,
  createMemo,
  createState,
  createTask,
  match,
} from '@zeix/cause-effect'

const query = createState('books')
const page = createState(1)

const requestKey = createMemo(() => ({
  query: query.get().trim(),
  page: page.get(),
}))

const results = createTask(
  async (_prev, abort) => {
    const { query, page } = requestKey.get()
    const response = await fetch(`/api/search?q=${query}&page=${page}`, {
      signal: abort,
    })
    if (!response.ok) throw new Error('Search failed')
    return response.json() as Promise<{
      items: { id: string; title: string }[]
      total: number
    }>
  },
  { value: { items: [], total: 0 } },
)

const totalPages = createMemo(() =>
  Math.max(1, Math.ceil(results.get().total / 20)),
)

createEffect(() => {
  match(results, {
    stale: () => console.log('Refreshing...'),
    ok: data => console.log(data.items.map(item => item.title)),
    err: error => console.error(error.message),
  })
})

function submitSearch(nextQuery: string) {
  batch(() => {
    query.set(nextQuery)
    page.set(1)
  })
}

submitSearch('signals')
console.log(totalPages.get())
```

Why this pattern works:

- `createTask()` cancels obsolete requests with the task's `AbortSignal`.
- The previous successful result stays readable while a refresh is pending.
- `batch()` prevents an intermediate request for the old page number and the new query.
- `match()` keeps UI or adapter code declarative instead of manually checking booleans.
