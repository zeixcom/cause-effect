# Ownership Bug: Component Scope Disposed by Parent Effect

## Symptom

In `module-todo`, `form-checkbox` elements wired via `checkboxes: pass(...)` lose their
reactive effects after the initial render — `setProperty('checked')` stops updating
`input.checked`, and the `on('change')` event listener is silently removed. Reading
`fc.checked` (a pull) still works correctly, but reactive push is gone.

## Root Cause

`createScope` registers its `dispose` on `prevOwner` — the `activeOwner` at the time the
scope is created. This is the right behavior for *hierarchical component trees* where a
parent component logically owns its children. But custom elements have a different ownership
model: **the DOM owns them**, via `connectedCallback` / `disconnectedCallback`.

The problem arises when a custom element's `connectedCallback` fires *inside* a
re-runnable reactive effect:

1. `module-todo`'s list sync effect runs inside `flush()` with `activeOwner = listSyncEffect`.
2. `list.append(li)` connects the `<li>`, which connects the `<form-checkbox>` inside it.
3. `form-checkbox.connectedCallback()` calls `runEffects(ui, setup(ui))`, which calls
   `createScope`. `prevOwner = listSyncEffect`, so `dispose` is **registered on
   `listSyncEffect`**.
4. Later, the `items = all('li[data-key]')` MutationObserver fires (the DOM mutation from
   step 2 is detected) and re-queues `listSyncEffect`.
5. `runEffect(listSyncEffect)` calls `runCleanup(listSyncEffect)`, which calls all
   registered cleanups — including `form-checkbox`'s `dispose`.
6. `dispose()` runs `runCleanup(fc1Scope)`, which removes the `on('change')` event
   listener and trims the `setProperty` effect's reactive subscriptions.
7. The `<form-checkbox>` elements are still in the DOM, but their effects are permanently
   gone. `connectedCallback` does not re-fire on already-connected elements.

The same problem recurs whenever `listSyncEffect` re-runs for any reason (e.g. a new todo
is added), disposing the scopes of all existing `<form-checkbox>` elements.

## Why `unown` Is the Correct Fix

`createScope`'s "register on `prevOwner`" semantics model one ownership relationship:
*parent reactive scope owns child*. Custom elements model a different one: *the DOM owns
the component*. `disconnectedCallback` is the authoritative cleanup trigger, not the
reactive graph.

`unown` is the explicit handshake that says "this scope is DOM-owned". It prevents
`createScope` from registering `dispose` on whatever reactive effect happens to be running
when `connectedCallback` fires, while leaving `this.#cleanup` + `disconnectedCallback` as
the sole lifecycle authority.

A `createScope`-only approach (without `unown`) has two failure modes:

| Scenario | Problem |
|---|---|
| Connects in static DOM (`activeOwner = null`) | `dispose` is discarded; effects never cleaned up on disconnect — memory leak |
| Connects inside a re-runnable effect | Same disposal bug as described above |

Per-item scopes (manually tracking a `Map<key, Cleanup>`) could also fix the disposal
problem but require significant restructuring of the list sync effect and still need
`unown` to prevent re-registration on each effect re-run.

## Required Changes

### `@zeix/cause-effect`

**`src/graph.ts`** — Add `unown` next to `untrack`:

```typescript
/**
 * Runs a callback without any active owner.
 * Any scopes or effects created inside the callback will not be registered as
 * children of the current active owner (e.g. a re-runnable effect). Use this
 * when a component or resource manages its own lifecycle independently of the
 * reactive graph.
 *
 * @since 0.18.5
 */
function unown<T>(fn: () => T): T {
    const prev = activeOwner
    activeOwner = null
    try {
        return fn()
    } finally {
        activeOwner = prev
    }
}
```

Export it from the internal graph exports and from **`index.ts`**:

```typescript
export {
    // ...existing exports...
    unown,
    untrack,
} from './src/graph'
```
