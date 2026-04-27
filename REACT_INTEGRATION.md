# React Integration

## Status: Non-Goal for This Library

React integration is out of scope for `@zeix/cause-effect` and will not be added to this repository. The reasons:

**Different rendering models.** React renders through a reconciler and virtual DOM; re-renders are React's mechanism for propagating state changes to the UI. Cause & Effect propagates changes through a fine-grained signal graph and drives updates directly, without diffing. The two models solve the same problem differently, and bridging them adds complexity without benefiting either.

**Bundle coupling.** The core library targets any JavaScript environment — browsers, Bun, Node, Deno — and must stay runtime-agnostic. React integration means React becomes a dependency.

**DevTools.** A production-ready React integration requires React DevTools-compatible instrumentation: named signals, a dependency graph inspector, and integration with the React DevTools component tree. This is a non-trivial ongoing maintenance commitment that belongs in a dedicated package, maintained by people who have a stake in it.

## When It Might Make Sense

Building a React integration is worth the effort if:

- You maintain a design system built on Cause & Effect and need React bindings alongside Web Component bindings, sharing the same signal graph across both.
- Your codebase mixes Le Truc Web Components and React components — for example, a server-rendered shell with Le Truc handling most interactivity, but a few isolated React client components that need to read from the same signal state.
- You are building tooling or a framework layer on top of Cause & Effect and React is one of the target rendering environments.

If your use case is a standard React application, Jotai, Zustand, or TanStack Query are simpler choices — they are purpose-built for React's rendering model, have mature DevTools support, and large ecosystems. See the [GUIDE](GUIDE.md#coming-from-state-management-libraries) for a comparison.

## What a React Integration Requires

If you choose to build one, here is what a minimal but complete integration needs.

### Core hook: `useSyncExternalStore`

React 18's `useSyncExternalStore` is the correct primitive for subscribing React components to any external reactive store. It prevents value tearing in concurrent mode and is the only safe way to read external state during render.

```ts
import { useSyncExternalStore } from 'react'
import { createScope, createEffect, untrack } from '@zeix/cause-effect'
import type { ReadableSignal } from '@zeix/cause-effect'

function useSignal<T extends {}>(signal: ReadableSignal<T>): T {
  return useSyncExternalStore(
    (notify) => {
      let first = true
      return createScope(() =>
        createEffect(() => {
          signal.get()                              // establishes dependency
          if (first) { first = false; return }
          notify()                                  // tells React to re-read snapshot
        })
      )
    },
    () => untrack(() => signal.get()),              // render-time read — no graph edges
  )
}
```

Two non-obvious requirements:

**First-run guard.** `createEffect` runs immediately to establish dependencies. On that first run, `notify` must not be called — React already called `getSnapshot` during render. Calling `notify` here causes a spurious extra render on mount.

**`untrack` in `getSnapshot`.** React calls `getSnapshot` during render. Reading a signal at that point must not create reactive graph edges — that is React's job. Without `untrack()`, you risk polluting whatever `activeSink` happens to be active at render time.

### Lifecycle: scopes tied to components

Signals created inside a component should be disposed when the component unmounts. The right place is `useEffect`, not `useMemo` — `useMemo` does not guarantee cleanup on unmount:

```ts
import { useEffect } from 'react'
import { createScope } from '@zeix/cause-effect'
import type { Cleanup } from '@zeix/cause-effect'

function useScope(setup: () => void): void {
  useEffect(() => createScope(setup) as Cleanup, [])
}
```

React StrictMode mounts and unmounts components twice in development. Because `createScope` returns a dispose function and `useEffect` cleanup calls it, the double-mount cycle works correctly without any special handling.

### Async: Task states in React

Two variants cover different needs.

**Explicit state** — the component handles all branches itself:

```ts
import { useSyncExternalStore } from 'react'
import type { Task } from '@zeix/cause-effect'

function useTask<T extends {}>(task: Task<T>): {
  data: T | undefined
  isPending: boolean
  error: unknown
}
```

**Suspense variant** — throws a Promise when the Task is in the `nil` state (no value yet), throws an Error in the `err` state, returns `T` when resolved. For the `stale` state (re-fetching with a retained value), it should return the retained value rather than throwing — this matches the `stale` fallback in `match()` and aligns with React's `useDeferredValue` mental model:

```ts
function useTaskSuspense<T extends {}>(task: Task<T>): T
// throws Promise when nil (→ <Suspense> boundary)
// throws Error when err (→ <ErrorBoundary>)
// returns retained T when stale (→ render continues with previous value)
// returns T when ok
```

### Props: converting React props to signals

React props are values passed on every render, not signals. To make a prop reactive within the graph, convert it to a stable `State` signal updated synchronously before paint:

```ts
import { useLayoutEffect, useMemo } from 'react'
import { createState } from '@zeix/cause-effect'
import type { State } from '@zeix/cause-effect'

function useSignalProp<T extends {}>(value: T): State<T> {
  const signal = useMemo(() => createState(value), [])
  useLayoutEffect(() => { signal.set(value) }, [value])
  return signal
}
```

`useLayoutEffect` rather than `useEffect` ensures the signal updates before the browser paints — the same timing React uses for DOM mutations. `useEffect` would leave a frame where the signal holds a stale value.

### Collections: keyed list rendering

`List`'s stable-key design maps directly onto React's key-based reconciliation. An `<Each>` component subscribes to the list's structural state (keys) and gives each child a stable item signal — only the child for a changed item re-renders:

```tsx
import { useSignal } from './use-signal'
import type { List, State } from '@zeix/cause-effect'
import type { ReactNode } from 'react'

function Each<T extends {}>({
  list,
  children,
}: {
  list: List<T>
  children: (signal: State<T>, key: string) => ReactNode
}) {
  const keys = useSignal(/* subscribe to list structural changes */)
  return <>{keys.map(key => children(list.byKey(key), key))}</>
}
```

Usage:

```tsx
<Each list={todos}>
  {(signal, key) => <TodoItem key={key} signal={signal} />}
</Each>
```

`TodoItem` calls `useSignal(signal)` internally. Sorting or structural changes re-render `Each`; individual value changes re-render only the affected `TodoItem`.

### `match()` in render

`match()` requires an active owner — it must be called inside an effect or scope. React render has no active owner. The integration needs a `useMatch()` hook that subscribes to the relevant signal states and dispatches to handlers synchronously in render:

```ts
import type { Task, Memo, MatchHandlers } from '@zeix/cause-effect'

function useMatch<T extends {}>(
  signal: Task<T> | Memo<T>,
  handlers: MatchHandlers<T>,
): ReturnType<MatchHandlers<T>[keyof MatchHandlers<T>]>
```

The cleanup semantics from `match()` — cleanup runs before the next handler dispatch — do not map to React render returns. Any cleanup from handlers should be managed in a wrapping `useEffect`, not inside `useMatch` itself.

### SSR

`useSyncExternalStore` accepts a third `getServerSnapshot` argument. For synchronous signals (`State`, `Memo`), `getServerSnapshot` is identical to `getSnapshot` — the value is available synchronously:

```ts
useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
```

For `Task`, the server snapshot should return the nil/pending state, or a pre-fetched value if one was provided via `options.value`. React's streaming SSR handles async resolution through Suspense boundaries.

## Package Shape

A complete integration belongs in a separate repository and package:

```json
{
  "name": "@your-org/cause-effect-react",
  "peerDependencies": {
    "react": ">=18",
    "@zeix/cause-effect": ">=1"
  }
}
```

Recommended exports:

| Export | Purpose |
|---|---|
| `useSignal(signal)` | Subscribe a component to any readable signal |
| `useScope(fn)` | Tie a Cause & Effect scope to component lifecycle |
| `useTask(task)` | Explicit `{ data, isPending, error }` tuple |
| `useTaskSuspense(task)` | Suspense-throwing variant |
| `useMatch(signal, handlers)` | Conditional dispatch in render |
| `useSignalProp(value)` | Convert a React prop to a stable `State` signal |
| `<Each list={...}>` | Keyed list rendering with item-level granularity |

## The DevTools Problem

This is the single largest investment required before a React integration can be considered production-ready, and the primary reason none ships from this repository.

React developers expect to inspect reactive state in the browser's React DevTools panel. Without instrumentation, signals are invisible — you see only the component and whatever values it exposes through `useState` wrappers. A complete DevTools story requires:

- **Named signals.** A `name` option on each factory, or inference from variable names via a Babel/SWC/TypeScript transform at build time.
- **Dependency graph inspection.** A way to read which signals a component subscribes to and what their current values are.
- **React DevTools integration.** Hooking into `__REACT_DEVTOOLS_GLOBAL_HOOK__` to expose signal state alongside component props and state in the component tree.
- **Ongoing maintenance.** React DevTools internals change across React versions. This is a living commitment, not a one-time implementation.

Without DevTools, a React integration is viable for prototyping but difficult to recommend for production use on teams that depend on DevTools for debugging. Factor this cost into any build-vs-adopt decision.
