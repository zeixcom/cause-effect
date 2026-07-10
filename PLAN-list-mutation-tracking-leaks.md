# PLAN: Untrack Internal Reads in List (and Collection) Mutation Methods

## Goal

Mutation methods must never create dependency edges to the caller's reactive context. Today, several `List` mutation methods read child item signals **without `untrack()`**, so calling them inside an effect or memo secretly subscribes that effect/memo to every item signal it touched.

**Confirmed defect (reproduced on `next`, 2026-07-10):**

```ts
const list = createList([3, 1, 2])
const trigger = createState(0)
let runs = 0
createEffect(() => {
    trigger.get()
    runs++
    if (runs === 1) list.sort()   // leaks item-signal edges into this effect
})
list.byKey('0')?.set(99)
// BUG: runs === 2 — the effect re-ran even though it never *reads* the list.
```

The same leak class exists in `list.set()` (via an untracked-missing `buildValue()` call) and `list.splice()` (reads removed items' values tracked). The codebase already establishes the correct pattern in two places — `Store.set()` uses `untrack(buildValue)` with an explaining comment (`src/nodes/store.ts:314–319`), and `List.replace()` wraps its read in `untrack` (`src/nodes/list.ts:507–513`) — but `List.set`, `List.sort`, `List.splice`, and the `update()` methods were never given the same treatment.

## Files to touch

- `src/nodes/list.ts` — `set()`, `sort()`, `splice()`, `update()`
- `src/nodes/store.ts` — `update()` (consistency with List; `set()` is already correct)
- `src/nodes/collection.ts` — `onChanges` change branch in `createCollection`
- `test/list.test.ts`, `test/store.test.ts`, `test/collection.test.ts` — new tests
- `.agents/skills/shared/references/non-obvious-behaviors.md` — no entry needed once fixed (this is a bug fix, not a documented behavior); do not add one

## Implementation steps

All edits use the already-imported `untrack` from `../graph` (it is imported in all three files).

1. **`src/nodes/list.ts` — `set()`** (~line 425). Change:

   ```ts
   const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value
   ```

   to (mirroring `store.ts` `set()` exactly, including the rationale comment):

   ```ts
   // Use cached value if clean, recompute if dirty. untrack prevents
   // buildValue's child .get() calls from leaking edges into whatever
   // effect is currently active (which would cause over-broad re-runs).
   const prev =
       node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value
   ```

2. **`src/nodes/list.ts` — `sort()`** (~line 526–531). The entry-collection loop reads `signals.get(key)?.get()` tracked. Wrap only the reads:

   ```ts
   const entries: [string, T][] = []
   untrack(() => {
       for (const key of keys) {
           const v = signals.get(key)?.get()
           if (v !== undefined) entries.push([key, v])
       }
   })
   ```

3. **`src/nodes/list.ts` — `splice()`** (~line 568–578). In the "Collect items to delete" loop, change `remove[key] = signal.get()` so the read is untracked. Simplest: wrap the whole collect loop in `untrack(() => { ... })`, same shape as step 2.

4. **`src/nodes/list.ts` — `update()`** (~line 443). Change:

   ```ts
   update(fn: (prev: T[]) => T[]) {
       list.set(fn(list.get()))
   },
   ```

   to:

   ```ts
   update(fn: (prev: T[]) => T[]) {
       list.set(fn(untrack(() => list.get())))
   },
   ```

   Rationale: `State.update()` reads `node.value` directly and creates no edge (`src/nodes/state.ts:105–110`); `List.update`/`Store.update` calling the tracked `get()` is an inconsistency — a mutation API must not subscribe its caller.

5. **`src/nodes/store.ts` — `update()`** (~line 329): same change, `store.set(fn(untrack(() => store.get())))`.

6. **`src/nodes/collection.ts` — `createCollection`'s `onChanges`, change branch** (~line 451–456): `itemToKey.delete(signal.get())` reads the item signal tracked. `onChanges` is normally called from the external `watched` callback (no active sink), but nothing stops a consumer from calling `applyChanges` inside an effect. Change to:

   ```ts
   itemToKey.delete(untrack(() => signal.get()))
   ```

7. **Tests.** Add to the respective test files (style: `bun:test`, existing helpers):
   - For each of `set`, `sort`, `splice`, `update` on List: create a list, an unrelated `trigger` state, and an effect that reads only `trigger` and performs the mutation on its first run. Then mutate an item via `list.byKey(key)!.set(...)` and assert the effect's run count did **not** increase. (Use the auto-increment keys `'0'`, `'1'`, … — the default `keyConfig`.)
   - For `List.set` specifically, reproduce the transient variant: effect does `list.add(4)` (marks the node dirty) then `list.set([...])` in its first run; assert run count is exactly 1 after flush (before the fix it becomes 2).
   - `Store.update` inside an effect that reads only `trigger`: later `store.byKey('name').set(...)` must not re-run the effect.
   - Behavior preservation: `sort`/`splice`/`set` called *outside* any effect still propagate to subscribers exactly as before (there are existing tests; just make sure they pass).

8. Run `bun test`, `bun run regression`, `bunx biome lint .`, `bunx tsc --noEmit`.

## Edge cases a weaker model would likely miss

- **`untrack` only suppresses `activeSink` linking; it does not suppress the composite node's own bookkeeping.** Wrapping `buildValue()` in `untrack` is safe: the child→list-node edges (ADR-0014's value-rebuild path) are established by `refresh()`/`recomputeMemo()` during `get()`, not by these mutation-path reads. Do not "fix" this by skipping `buildValue` — the dirty-prev computation is needed for correct diffing.
- **Do NOT untrack the public read APIs** (`get()`, `at()`, `byKey()`, `keys()`, `length`, iterator). ADR-0015 made those deliberately tracking. Only *mutation-internal* reads are in scope.
- **`replace()` is already correct** (`untrack` at `src/nodes/list.ts:507`) — leave it alone; it's the precedent, and there's a batch-wrapping subtlety there covered by ADR-0015.
- **The leak has two observable modes**: (a) persistent — leaked edges survive until the effect's next run (`sort` case above), and (b) transient — the mutation itself propagates through the just-leaked edge and re-runs the effect once, after which `trimSources` on that re-run removes the edges (the `set` case). Tests must cover both; asserting only mode (a) for `set()` would pass even without the fix.
- **`update()` semantics change is intentional but observable**: an effect that calls `list.update(...)` on its first run today becomes subscribed to the whole list; after the fix it is not. Grep tests for `\.update(` usages inside `createEffect` before changing, and confirm none rely on the tracking (as of today, none do — verify with `grep -n "update(" test/*.test.ts`).
- **`sort()`'s `compareFn` runs on item *values* already read** — do not move the user's `compareFn` inside `untrack`'s callback-read loop in a way that changes when it executes; only the `signals.get(key)?.get()` reads need untracking. (Wrapping the collect loop as shown is fine; the sort itself stays outside.)
- **In `splice()`, the returned array `Object.values(remove)`** is built from those same reads — untracking does not change the return value.
- **Bundle size**: `untrack` closures add a few bytes each; regression limits have headroom, but run `bun run regression` to confirm.

## Acceptance criteria

1. The reproduction at the top yields `runs === 1` after `byKey('0').set(99)` (effect not re-run).
2. New tests for `set` (both modes), `sort`, `splice`, `update` (List + Store) pass.
3. All 561 pre-existing tests pass unchanged (`bun test`), `bun run regression` passes, `bunx tsc --noEmit` exits 0, `bunx biome lint .` clean.
4. `grep -n "signal.get()\|?.get()" src/nodes/list.ts src/nodes/collection.ts` shows no remaining tracked child-signal read inside a mutation method (each is inside `untrack(...)` or in a read API where tracking is intended per ADR-0015).
