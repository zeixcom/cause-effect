# PLAN: External-push Store never activates its `watched` lifecycle for property-only consumers

**Priority rank:** 1 of 5 — do this first.
**Suggested TODO ID:** CE-015 (skill: `cause-effect-dev`), plus a `tech-writer` follow-up and a `changelog-keeper` entry.
**Size:** ~40 lines of source change, ~120 lines of tests, small doc additions.
**Baseline at time of writing:** `bunx tsc --noEmit` clean, `bun test` 670/670, branch `v2/shape-exploration`.

## Goal

`deriveStore(seed, { watched })` currently never runs its `watched` callback when consumers
only read individual properties (`store.name.get()`, `store.byKey('name')`, `'name' in store`).
Since an external-push Store receives values *only* through the `emit` handed to `watched`,
such a store stays frozen at its seed value forever. `deriveCell(seed, { watched })` and
`deriveList(seed, { watched })` activate on **every** read form; Store is the only shape where
the most idiomatic access pattern silently kills the feature.

Fix: activation (lifecycle) must be decoupled from structural edge creation (ADR-0015
granularity). Property reads activate the watched lifecycle **without** linking the store's
structural node, so per-property reactivity is preserved exactly.

## Root cause (verified)

- `src/nodes/store.ts:401` — `createStore`'s `byKey` (and therefore every proxy property
  access, the `has` trap, and `getOwnPropertyDescriptor`, which all funnel through `byKey`)
  never calls `subscribe()`. Only `get()`, `keys()`, and the iterator do.
- `src/nodes/store.ts:520-534` — the external-push branch of `deriveStore` delegates to
  `inner.byKey(key)`, inheriting the gap.
- `src/graph.ts:758-769` — `makeSubscribe` couples the two concerns: it starts `watched`
  (`if (!node.sinks) node.stop = onWatch()`) **and** links the structural node
  (`link(node, activeSink)`). There is no way to get lifecycle activation alone from it.
- `test/store.test.ts:556-577` pins the *mutable* `createStore` behavior ("should not activate
  for nested property access only"). That pinned behavior is **not** being changed — this plan
  changes only the derived external-push facade, whose contract differs: a derivation with no
  other value source.

## Exact files to touch

| File | Change |
|---|---|
| `src/nodes/store.ts` | External-push branch of `deriveStore`: own the lifecycle at the facade level via a "lifecycle anchor" node |
| `test/derive-store.test.ts` | New tests under `describe('external push')` |
| `ARCHITECTURE.md` | One paragraph under "Composite Lookup Methods" (Store) |
| `adr/0015-composite-lookup-methods-track-structural-changes.md` | Append a short "Clarification" section (precedent: ADR-0014 carries one added by ADR-0015) |
| `.agents/skills/shared/references/non-obvious-behaviors.md` | New `<watched_activation_is_shape_wide>` section |
| `CHANGELOG.md` | "Fixed" entry under 2.0.0 (coordinate with PLAN-v2-release-readiness) |

## Step-by-step implementation

### Step 1 — Reproduce first (test before fix)

In `test/derive-store.test.ts`, inside `describe('external push')` (around line 187), add:

```ts
test('activates watched for a property-only consumer', () => {
  let push: ((patch: Partial<User>) => void) | undefined
  const store = deriveStore({ name: 'Alice', email: 'a@x.com' } as User, {
    watched: emit => {
      push = emit
      return () => { push = undefined }
    },
  })
  const seen: string[] = []
  const dispose = createScope(() => {
    createEffect(() => { seen.push(store.name?.get() ?? '') })
  })
  expect(push).toBeDefined()          // FAILS today — watched never started
  push?.({ name: 'Bob' })
  expect(seen.at(-1)).toBe('Bob')     // FAILS today — store frozen at seed
  dispose()
})
```

Run `bun test test/derive-store.test.ts` and confirm both marked assertions fail. This proves
you are fixing the real bug, not a hypothetical.

### Step 2 — Rework the external-push branch of `deriveStore`

Replace the body of the `if (!isFunction(input))` branch (`src/nodes/store.ts` ≈ lines
517-534) with the following design. Keep the existing `validateSignalValue` and
`validateCallback` lines unchanged.

```ts
if (!isFunction(input)) {
    validateSignalValue(TYPE_STORE, input, isRecord)
    const watched = options?.watched as StoreCallback<T>
    validateCallback(TYPE_STORE, watched, isSyncFunction)
    const inner = createStore(input as T)

    // Lifecycle anchor: a source node that never holds or propagates a value.
    // Its only job is to carry watcher edges, so that ANY observation form —
    // structural (get/keys/iterator) or per-property (byKey/proxy) — starts and
    // keeps the watched lifecycle alive, without linking the structural node
    // (per ADR-0015, a property read must not subscribe to "any key changed").
    // Nothing ever calls propagate() on it, so its edges never fire.
    const anchor = {
        value: undefined,
        sinks: null,
        sinksTail: null,
        stop: undefined,
    } as unknown as SourceNode
    let stop: Cleanup | undefined
    const stopWatched = () => {
        if (stop) { stop(); stop = undefined }
    }
    const subscribe = () => {
        if (!activeSink) return
        if (!anchor.sinks) {
            stop = watched(emit)
            anchor.stop = stopWatched // re-arm: unlink() clears node.stop after calling it
        }
        link(anchor, activeSink)
    }
    const emit = (patch: Partial<T>): void => {
        inner.update(prev => ({ ...prev, ...patch }))
    }
    return readonlyFacade(
        () => { subscribe(); return inner.get() },
        () => { subscribe(); return inner.keys() },
        key => { subscribe(); return inner.byKey(key) as unknown as Cell<T[keyof T & string] & {}> },
    ) as Store<T>
}
```

Notes for the implementer:

- `inner` is now created **without** `{ watched }` — the facade owns the lifecycle. The old
  `let inner` + late-assignment dance exists only because the old `watched` closure referenced
  `inner`; with `emit` defined after `inner`, a `const` works.
- Add `type SourceNode` to the existing `../graph` import block in `store.ts` (it is already
  exported from `graph.ts`). `Cleanup`, `activeSink`, and `link` are already imported.
- `value: undefined` plus the `as unknown as SourceNode` cast is required because
  `SourceNode['value']` is typed `unknown & {}`. The field is never read: nothing calls
  `setState` on the anchor, `refresh()` only walks sources that have `fn`, and `propagate()`
  is never invoked with the anchor as a dependency. Say this in a comment, then stop
  justifying it.
- Why not just call `subscribe()` (the structural one) from `byKey`? Because that links the
  structural node, and then an effect reading only `store.name` re-runs on a patch to
  `store.email` — the exact granularity loss ADR-0015 rejects and CHANGELOG 1.3.4 documents
  ("The principled line within Store is whole-store vs per-property").
- Why an anchor node at all, instead of a counter? Because `unlink()` already implements
  "run `stop` when the last edge detaches" (ADR-0011). The anchor reuses that machinery —
  including cascading cleanup correctness — with zero new lifecycle code in `graph.ts`.

### Step 3 — Confirm the inner structural path still behaves

The facade's `get()`/`keys()` now call `subscribe()` (anchor) **and then** `inner.get()` /
`inner.keys()`, which still link `inner`'s structural node via its own internal accessor
subscribes (now without any `watched`, those subscribes only link). Verify by reading
`createStore` — no change should be needed there. The consumer ends up with two edges:
an anchor edge (never fires) and a structural edge (fires on structural/whole-record
changes). Both correct; no over-firing.

### Step 4 — Tests (add to `test/derive-store.test.ts`, `describe('external push')`)

1. **Property-only activation** — the Step 1 test, now passing. Use both access forms in
   separate tests: proxy (`store.name?.get()`) and `store.byKey('name')?.get()`.
2. **Stops on last property observer** — dispose the scope; assert the cleanup ran
   (mirror the pattern of the existing `'runs the cleanup when no longer watched'` test at
   ≈ line 218, but with the effect reading only a property).
3. **Restarts after a full stop** — dispose, assert stopped; create a second scope reading
   the property; assert `watched` ran again. This catches the re-arm bug (Step 2's
   `anchor.stop = stopWatched` inside the activation branch): `unlink()` sets
   `source.stop = undefined` after calling it, so a subscribe that fails to re-assign would
   leak the second lifecycle.
4. **No double start** — two effects, one reading `store.get()`, one reading
   `store.name?.get()`; assert `watched` call count is exactly 1. Then dispose one, assert
   still active; dispose the other, assert stopped.
5. **Granularity preserved** — effect reads only `store.name?.get()`; `push({ email: 'b@x.com' })`
   must NOT re-run it; `push({ name: 'Bob' })` must. This is the regression this fix must not
   introduce.
6. **`in` operator activates** — `createEffect(() => { if ('name' in store) seen++ })`; assert
   `push` is defined. (The `has` trap routes through `byKey`.)

Wrap all effect setups in `createScope` and dispose them, following the file's existing style.

### Step 5 — Documentation

- `ARCHITECTURE.md`, "Composite Lookup Methods" → Store paragraph: add two sentences —
  per-property reads create no structural *edge* (unchanged, ADR-0015), but for a derived
  external-push Store they do activate the `watched` *lifecycle* through an anchor node that
  never propagates; activation and tracking are separate concerns.
- `adr/0015-...md`: append a `## Clarification (added 2026-08, external-push Stores)` section
  with the same two-concern distinction. Do not change the ADR's Status.
- `non-obvious-behaviors.md`: add `<watched_activation_is_shape_wide>` documenting: all three
  shapes activate `watched` on any read *inside a computation*; Store's property reads do it
  via the anchor; and the known shape-wide limitation that grabbing a cell outside a
  computation (`const c = store.name; effect(() => c.get())`) does not activate (same for
  `list.byKey(k)` grabbed outside a computation — pre-existing, not fixed here).
- `CHANGELOG.md` under the 2.0.0 section (create it if PLAN-v2-release-readiness has not run
  yet): "Fixed — `deriveStore(seed, { watched })` never started its watched lifecycle when
  consumed only through property reads, leaving the store frozen at its seed" + one-line
  mechanism note.

## Edge cases a weaker model would miss

1. **Do not touch `createStore`'s `byKey`.** `test/store.test.ts:556`
   ("should not activate for nested property access only") pins the mutable-store behavior
   deliberately. The fix lives entirely in `deriveStore`'s facade. If you "fix" createStore
   too, that test fails and you have changed a decided semantic.
2. **The re-arm trap.** `unlink()` (`graph.ts:403-407`) calls `source.stop()` and then sets
   `source.stop = undefined`. If `subscribe` only assigned `anchor.stop` once at setup, the
   second observation cycle would never stop. That is why `anchor.stop = stopWatched` is
   inside the `if (!anchor.sinks)` branch.
3. **`makeSubscribe` cannot be reused here.** It couples start-watched with
   `link(node, activeSink)` on the *same* node. The anchor needs link-on-anchor +
   start-watched, and the structural path needs link-on-inner-node + start-watched-only-once.
   Hand-rolling the small `subscribe` (as in Step 2) is the point, not a shortcut.
4. **`activeSink` guard must stay.** `subscribe()` must no-op outside a computation; there is
   no edge to create there. Grabbing `store.name` outside an effect and reading the returned
   cell inside one still does not activate — identical to `deriveList`'s behavior when you
   grab `list.byKey(k)` outside a computation. Parity, not a new gap.
5. **Double-activation guard is `anchor.sinks`, not a boolean.** Two effects reading two
   different properties both link the anchor; `watched` must run once. `!anchor.sinks` gives
   that for free. Do not add a separate `active` boolean that can drift from edge state.
6. **`emit` still routes through `inner.update`.** Do not "optimize" emit into direct child
   `set`s — `update` → `diffRecords` → per-property sets is what preserves equality
   suppression and the type-change (primitive ↔ array ↔ record) replacement logic.
7. **Throwing `watched` callbacks.** If `watched(emit)` throws inside `subscribe`, the
   exception propagates out of the effect run that triggered it — same as today's
   `makeSubscribe` behavior. Do not swallow it.
8. **`SourceNode` import is type-only.** Keep it in the `type` import group; Biome enforces
   import ordering (`bunx biome check .` will catch mistakes).

## Acceptance criteria

- [ ] `bun test test/derive-store.test.ts` — all new tests pass; Step 1 test fails on the
      pre-fix code (verify by stashing: `git stash && bun test test/derive-store.test.ts && git stash pop`
      is *not* needed if you followed Step 1's fail-first order).
- [ ] `test/store.test.ts:556` ("should not activate for nested property access only")
      still passes **unchanged** — `git diff test/store.test.ts` is empty.
- [ ] `bun test` — full suite green (was 670; expect ≥ 676).
- [ ] `bunx tsc --noEmit` and `bunx biome check .` clean.
- [ ] `bun run build` succeeds and `bun test test/regression-bundle.test.ts` passes
      (core gzip hard limit 3072 B unaffected — the anchor only allocates in the
      external-push path, which the core trio never imports).
- [ ] `ARCHITECTURE.md`, ADR-0015 clarification, and
      `.agents/skills/shared/references/non-obvious-behaviors.md` mention the
      activation-vs-tracking distinction; `grep -n "anchor" ARCHITECTURE.md` finds it.
- [ ] `CHANGELOG.md` has a 2.0.0 "Fixed" entry for this change.
