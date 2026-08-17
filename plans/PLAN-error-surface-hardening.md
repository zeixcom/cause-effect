# PLAN: Error-surface hardening — provenance, message accuracy, boundary validation

**Priority rank:** 5 of 5. Run after PLAN-agent-docs-sync (that plan syncs
`error-classes.md` to current messages; this plan then changes several messages and must
re-sync the file itself — see Step 8).
**Suggested TODO ID:** CE-019 (skill: `cause-effect-dev`), plus `changelog-keeper` and a
`tech-writer` touch-up.
**Size:** ~60 lines of source change across 8 files, ~80 lines of tests.
**Baseline at time of writing:** `bunx tsc --noEmit` clean, `bun test` 670/670. All 11
error classes in `src/errors.ts` are thrown somewhere (verified) — this plan is about
*quality* of the error surface, plus two robustness gaps.

## Goal

Errors are this library's public contract for misuse (REQUIREMENTS: "a thin, trustworthy
layer"). Eight concrete defects, each small, together a coherent pass:

| # | Defect | Where |
|---|---|---|
| 1 | `deriveStore` seed-path errors report `[Store]` instead of `[deriveStore]`; `createEffect`'s validation reports `[Effect]` — the same user mistake gets different prefixes depending on factory | `store.ts` ≈521-523, `effect.ts` ≈103 |
| 2 | `PromiseValueError` message says "use an async callback to create a Task instead" — `createTask` is internal-only in v2; the advice is unactionable | `errors.ts` ≈148-150 |
| 3 | Omitting the *required* `options.watched` on a seed input throws `[deriveCell] Callback undefined is invalid` — no hint that an option is missing | `cell.ts` ≈149, `list.ts` ≈999, `store.ts` ≈523 |
| 4 | Slot circular delegation throws a bare `Error`, breaking the errors.ts class pattern; `CircularDependencyError` already exists and fits | `slot.ts` ≈134 |
| 5 | A cycle through a `Task` node reports `[Cell]` — misattributed node kind | `graph.ts` ≈552 |
| 6 | A `watched` callback returning a non-function (JS callers) is assigned to `node.stop` unvalidated; it later explodes as a bare `TypeError` deep inside `unlink` | `graph.ts` ≈762, `sensor.ts` ≈101, plus the anchor `subscribe` added by PLAN-store-watched-lifecycle |
| 7 | A throwing user cleanup aborts `unlink`'s cascading cleanup mid-way, leaving the node with `sinks === null` but stale sources (ADR-0011 violation under error conditions) | `graph.ts` ≈403-419 |
| 8 | JSDoc gaps on the error surface: `ReadonlySignalError` and `DuplicateKeyError` lack class docs/`@param`; `DEFAULT_EQUALITY` lacks the `@example` its siblings have; `match`'s `@since 1.1` is malformed (siblings use `1.1.0`); `SKIP_EQUALITY`'s example calls the non-public `createSensor` with a stale options shape | `errors.ts`, `graph.ts` ≈251/258-271, `effect.ts` ≈134 |

## Exact files to touch

`src/errors.ts`, `src/graph.ts`, `src/nodes/effect.ts`, `src/nodes/slot.ts`,
`src/nodes/cell.ts`, `src/nodes/list.ts`, `src/nodes/store.ts`, `src/nodes/sensor.ts`,
`test/{effect,slot,cell,list,store,sensor}.test.ts` (targeted new/updated assertions),
`CHANGELOG.md`, `.agents/skills/shared/references/error-classes.md`.

## Step-by-step implementation

### Step 1 — Provenance consistency (#1)

Rule: **the `where` string names the factory the user called when the throw site is inside
that factory; the shape tag (`'List'`, `'Store'`, `'Cell'`, `'Slot'`, `'Effect'`) stays on
shared paths (mutation methods, `recomputeMemo`, proxy traps) where the originating factory
isn't known.** This matches the existing `cell.ts`/`state.ts` precedent and ADR-0017's
`[Store]` proxy traps — do **not** sweep shared paths to factory names (plans
list/store hardening deliberately kept `TYPE_LIST` there).

- `store.ts` ≈ line 523: `validateCallback(TYPE_STORE, watched, isSyncFunction)` →
  `validateCallback('deriveStore options.watched', watched, isSyncFunction)` (also covers #3).
  Same for `validateSignalValue(TYPE_STORE, input, isRecord)` on the line above →
  `'deriveStore'`.
- `effect.ts` ≈ line 103: the validation `where` `'Effect'` → `'createEffect'`.

### Step 2 — `PromiseValueError` message (#2)

`errors.ts` ≈ line 149, replace the guidance sentence:

```
`Callback returned a Promise — a synchronous derivation cannot hold one; declare the callback async, or use deriveCell(asyncFn, { initial })`
```

### Step 3 — `options.watched`-required clarity (#3)

At the three seed-input validation sites, make the `where` string name the option:
`'deriveCell options.watched'` (`cell.ts` ≈149), `'deriveList options.watched'`
(`list.ts` ≈999), `'deriveStore options.watched'` (done in Step 1). Resulting message:
`[deriveCell options.watched] Callback undefined is invalid` — the missing-option case is
now self-explanatory, and the wrong-type case (passed a non-function) reads correctly too.

### Step 4 — Slot circular delegation (#4)

`slot.ts` ≈134: `throw new Error('[Slot] Circular delegation detected in set()')` →
`throw new CircularDependencyError('Slot')` (import from `../errors`; message becomes
`[Slot] Circular dependency detected`). Update the assertion in `test/slot.test.ts` that
matches the old message (search `circular`).

### Step 5 — Task cycle attribution (#5)

`graph.ts` ≈ line 552:

```ts
throw new CircularDependencyError(
    'recompute' in node ? 'Task' : 'value' in node ? TYPE_CELL : 'Effect',
)
```

`'recompute' in node` is the established TaskNode discriminator (see `refresh`'s dispatch
three lines below and the comment there) and must be checked *before* `'value' in node`,
because a TaskNode has both. A Slot still reports `Cell` — it *is* a MemoNode internally;
acceptable, note it in nothing (it's invisible).

### Step 6 — Cleanup-return validation (#6)

1. Add to `src/errors.ts` (with class-level JSDoc matching its siblings):

```ts
/**
 * Asserts that a `watched` callback's return value is usable as a cleanup.
 * `undefined`/`null` are tolerated (no cleanup); any other non-function is a
 * programming error that would otherwise surface as a bare TypeError inside
 * `unlink` far from its cause.
 */
function validateCleanup(where: string, value: unknown): asserts value is Cleanup {
    if (value != null && !isFunction(value))
        throw new InvalidCallbackError(where, value)
}
```

Import `Cleanup` type; export `validateCleanup` alongside `validateCallback`.

2. `graph.ts` `makeSubscribe` (≈758): add a third parameter `where: string`, and change
   `node.stop = onWatch()` → `node.stop = onWatch(); validateCleanup(where, node.stop)`.
   Order matters: assign first, validate second, so `node.stop` is never a poison value.
3. Update every `makeSubscribe` caller to pass the factory name: `state.ts` (createSensor
   path → `'createSensor watched'`), `list.ts` ≈1142 (`'createList watched'`), `list.ts`
   ≈889 (`'deriveList watched'`), `store.ts` ≈372 (`'createStore watched'`).
4. `sensor.ts` ≈101: it assigns `node.stop = onWatch()` directly — wrap with
   `validateCleanup('createSensor watched', ...)`.
5. If PLAN-store-watched-lifecycle has landed, its anchor `subscribe` in
   `store.ts` does `stop = watched(emit)` — add
   `validateCleanup('deriveStore options.watched cleanup', stop)` after the assignment
   (same assign-then-validate order). If that plan has *not* landed, skip; its own text
   will pick this up.
6. Leniency contract: `undefined`/`null` returns remain legal (JS callers omitting a
   cleanup). Only non-function truthy/non-null values throw
   `InvalidCallbackError` — do not tighten beyond that; existing user callbacks returning
   nothing must keep working.

### Step 7 — `unlink` stop-throw hardening (#7)

`graph.ts` ≈403-419. Extract the cascade and guard the stop call:

```ts
if (!source.sinks) {
    const cascade = (): void => {
        // (current body of the `if ('sources' in source && source.sources)` block,
        //  unchanged: sourcesTail = null; trimSources; flags |= FLAG_DIRTY)
    }
    const stop = source.stop
    source.stop = undefined
    if (stop) {
        // ADR-0011 ordering: stop first, cascade second. The finally guarantees the
        // cascade still runs when a user cleanup throws — otherwise the node keeps
        // stale sources and reconnection reads stale values. The user's error still
        // propagates after the cascade.
        try {
            stop()
        } finally {
            cascade()
        }
    } else {
        cascade()
    }
}
```

Notes: moving `source.stop = undefined` *before* the call changes nothing (the old code
assigned a local first — same observable order); keep `unlink`'s return value and the
`nextSource` handling untouched.

### Step 8 — JSDoc + docs sync (#8)

- `errors.ts`: class-level JSDoc + `@param` for `ReadonlySignalError` and
  `DuplicateKeyError` (follow `InvalidStoreMutationError`'s style).
- `graph.ts` `DEFAULT_EQUALITY` (≈251): add an `@example` showing reference equality
  suppressing propagation for a primitive cell.
- `graph.ts` `SKIP_EQUALITY` (≈255-271): rewrite the example against the public API —
  a `deriveCell(seed, { watched, equals: SKIP_EQUALITY })` MutationObserver cell (seed
  replaces the old `initial` option; `emit(node)` on mutation only; return the disconnect).
  Remove the `createSensor` mention from the doc sentence above it.
- `effect.ts` ≈134: `@since 1.1` → `@since 1.1.0`.
- `.agents/skills/shared/references/error-classes.md`: re-sync the changed messages
  (`PromiseValueError` guidance, `[deriveStore options.watched]`-style prefixes,
  Slot's `CircularDependencyError`) and add `validateCleanup` if the file documents the
  validators.
- `CHANGELOG.md` under 2.0.0: one **Fixed** entry covering #4/#5/#6/#7 (Slot error class,
  Task cycle attribution, cleanup validation, unlink hardening) and one **Changed** entry
  for the message clarifications (#1-#3), noting messages are behavioral strings some
  consumers assert on.

## Edge cases a weaker model would miss

1. **Do not sweep shared-path `where` strings to factory names.** `applyChanges`,
   `recomputeMemo`, proxy traps, and the init loops throw with shape tags by design — the
   factory isn't known there, and plans list/store already standardized those. Only the two
   Step 1 outliers change.
2. **`makeSubscribe`'s new parameter is a breaking internal-API change** — it is
   module-internal (not exported from `index.ts`), but *is* exported from `graph.ts` for
   the node modules; `bunx tsc --noEmit` will list every caller you forgot. Fix the calls,
   don't make the parameter optional with a fallback — an unlabeled error is the bug being
   fixed.
3. **Assign-then-validate order in Step 6** looks backwards but is deliberate: if
   validation throws, `node.stop` must already hold the *validated-later* value or the
   pre-throw state; never leave a poison non-function in `node.stop`, because `unlink`
   calls it unconditionally later. (If `validateCleanup` throws, the subscribe itself is
   aborted mid-effect-run and the error surfaces through the effect — same as a throwing
   `watched` callback today. That is the intended contract.)
4. **`value != null` in `validateCleanup`, not `!value`** — `0`, `''`, and `false` are
   non-function and must throw (they are not cleanups); only `undefined`/`null` mean "no
   cleanup". Mirrors the `DuplicateKeyError` falsy-value fix from 1.3.4.
5. **The `finally` in Step 7 must not swallow the stop error** — no `catch`. The cascade
   runs, then the original exception continues propagating. A `catch {}` would silently
   eat user errors; a missing `finally` is the bug being fixed.
6. **Tests assert exact messages today.** Before editing, inventory them:
   `grep -rn "Callback.*invalid\|Circular dependency\|read-only\|Promise instead\|already exists" test/` —
   every hit whose message changed needs its expectation updated in the same commit, or
   `bun test` fails confusingly later.
7. **`sensor.ts` re-exports** — CE-013 noted `sensor.ts` re-exports callback types; make
   sure the new `validateCleanup` import doesn't collide with its import block ordering
   (Biome re-alphabetizes: run `bunx biome check --write src` if needed).
8. **Bundle**: message strings lengthen slightly; `bun test test/regression-bundle.test.ts`
   must stay green (headroom is large — the full-library diagnostic is ~25 % above
   measurement). Never touch the 3072 B core limit.

## Acceptance criteria

- [ ] New tests: (a) Slot mutual delegation throws `CircularDependencyError` (updated from
      the bare-Error assertion); (b) a `watched` returning `42` throws `InvalidCallbackError`
      naming the factory (`createList watched` etc.) at subscribe time, not a TypeError at
      unlink time; (c) a throwing watched-cleanup during dispose propagates the error **and**
      a subsequently created effect on the same derived signal observes fresh values
      (reconnect works — the Step 7 regression test); (d) `deriveCell(seed, {})` (missing
      `watched`) throws with `options.watched` in the message; (e) a Task cycle message
      contains `[Task]` (build one via `deriveCell(async fn)` whose fn reads itself through
      a `Slot`, or follow the existing cycle test's construction in `test/task.test.ts`).
- [ ] `grep -n "create a Task instead" src/` returns nothing.
- [ ] `grep -rn "new Error(" src/` — every remaining hit is a wrapped-value normalization
      (`new Error(String(err))` in `recomputeMemo`/`runEffect` paths), not a fresh
      ad-hoc error.
- [ ] `bun test`, `bunx tsc --noEmit`, `bunx biome check .`, `bun run build`, and
      `bun test test/regression-bundle.test.ts` all green.
- [ ] `error-classes.md` messages match `src/errors.ts` output byte-for-byte for the
      changed entries; CHANGELOG has the Fixed and Changed entries.
