---
title: "Getting Started"
description: "Learn what Cause & Effect is, why it exists, and how to build your first reactive graph."
---

Cause & Effect is a framework-agnostic TypeScript library for building fine-grained reactive state, derived values, async tasks, and keyed composite data structures in one signal graph.

## The Problem

- Application state usually splits into separate tools for sync values, async loading, collections, and side effects, which creates duplicated mental models.
- Framework-level effects and selectors often depend on manual dependency lists, manual loading flags, or ad-hoc memoization that drifts from the real data flow.
- Dynamic structures such as nested objects, keyed arrays, and external event streams are easy to make reactive incorrectly or inefficiently.
- Integration layers such as custom elements or framework adapters need stable reactive primitives without adopting a full rendering framework.

## The Solution

Cause & Effect exposes a small set of signal primitives that all participate in the same graph. `createState()` owns mutable values, `createMemo()` and `createTask()` derive sync and async values, `createEffect()` reacts to them, and `createStore()`, `createList()`, `createCollection()`, `createSensor()`, and `createSlot()` extend the same semantics to nested data, external inputs, and integration points.

```ts
import { createState, createMemo, createEffect } from '@zeix/cause-effect'

const user = createState({ name: 'Alice', age: 30 })
const greeting = createMemo(() => `Hello ${user.get().name}`)

createEffect(() => {
  console.log(`${greeting.get()}, age ${user.get().age}`)
})

user.update(value => ({ ...value, age: 31 }))
```

## Installation

" "bun"]}>
<Tab value="npm">

```bash
npm install @zeix/cause-effect
```

</Tab>
<Tab value="pnpm">

```bash
pnpm add @zeix/cause-effect
```

</Tab>
<Tab value="yarn">

```bash
yarn add @zeix/cause-effect
```

</Tab>
<Tab value="bun">

```bash
bun add @zeix/cause-effect
```

</Tab>
</Tabs>

Supported environments from `REQUIREMENTS.md`: evergreen browsers, Bun, modern Node.js with ESM, and Deno. The package itself is ESM-only and ships zero runtime dependencies.

## Quick Start

```ts
import {
  createState,
  createMemo,
  createTask,
  createEffect,
  match,
} from '@zeix/cause-effect'

const userId = createState(1)
const label = createMemo(() => `User ${userId.get()}`)

const profile = createTask(
  async (_prev, abort) => {
    const response = await fetch(`https://example.com/users/${userId.get()}`, {
      signal: abort,
    })
    return response.json() as Promise<{ id: number; name: string }>
  },
  { value: { id: 0, name: 'Loading...' } },
)

createEffect(() => {
  match(profile, {
    stale: () => console.log(`Refreshing ${label.get()}...`),
    ok: user => console.log(`${label.get()}: ${user.name}`),
    err: error => console.error(error.message),
  })
})

userId.set(2)
```

Expected output:

```txt
User 1: Loading...
Refreshing User 2...
User 2: Alice
```

## Key Features

- Fine-grained dependency tracking through `.get()` reads instead of dependency arrays.
- Unified primitives for mutable state, sync derivation, async derivation, effects, collections, and external inputs.
- Lazy watched lifecycles for sensors, collections, memos, tasks, stores, and lists.
- Stable keyed collections with item-level reactivity through `createList()` and `createCollection()`.
- Ownership utilities such as `createScope()` and `unown()` for integration layers.
- Strong TypeScript bias: non-null signal values, guard-based validation, and exported runtime type guards.

## Next Steps

<Cards>
  <Card title="Architecture" href="/docs/architecture">See how `src/graph.ts` drives propagation, cleanup, and batching.</Card>
  <Card title="Core Concepts" href="/docs/state-and-derived">Learn the mental model for state, derived values, async tasks, and composite signals.</Card>
  <Card title="API Reference" href="/docs/api-reference/graph-utilities">Jump to grouped API pages with signatures, options, and import paths.</Card>
</Cards>
