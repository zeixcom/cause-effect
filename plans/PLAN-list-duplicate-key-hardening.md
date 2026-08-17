# PLAN: List duplicate-key validation and mutation atomicity

**Priority rank:** 2 of 5.
**Suggested TODO ID:** CE-016 (skill: `cause-effect-dev`), plus a `changelog-keeper` entry.
**Size:** ~30 lines of source change, ~100 lines of tests.
**Baseline at time of writing:** `bunx tsc --noEmit` clean, `bun test` 670/670.

## Goal

Close three correctness gaps in `MutableList` mutation paths, all of the same family —
duplicate keys and invalid items are validated inconsistently, and when validation *does*
throw it can leave the list half-mutated:

1. **`splice` accepts duplicate keys within its own inserted batch.**
   `list.splice(1, 0, itemA, itemA)` with a content-based `keyConfig` pushes the same key
   into `keys` twice: corrupted `length`, doubled iteration, the same signal yielded twice.
2. **`splice` validates items *while* mutating.** A nullish inserted item throws from inside
   `applyChanges` after earlier additions already committed to `signals` — a partially
   applied mutation with no propagation, violating the library's own staging discipline
   (the sibling external path fixed exactly this and even *claims* to mirror `splice`).
3. **Initialization never checks duplicates.** `createList([a, a])` and
   `deriveList(seed, { watched })` with content-based keys silently overwrite the first
   item's signal and corrupt `keys`, while `add()`, the external path, and (after this plan)
   `splice()` all throw `DuplicateKeyError`.

Auto-increment keys (the default) can never collide, so all changes are no-ops for default
configurations — only content-based `keyConfig` users get new, loud failures instead of
silent corruption.

## Exact files to touch

| File | Change |
|---|---|
| `src/nodes/list.ts` | `splice` (≈1314-1386): stage inserted items, validate up front. Init loop of `createList` (≈1145-1154): drop dead scaffold, add duplicate check. Init loop of `createExternalList` (≈815-820): same check. `applyChanges` (≈1130-1135): remove dead key-splicing. `onChanges` (≈848): drop redundant `keys.includes` |
| `test/list.test.ts` | New tests for splice atomicity and init validation |
| `test/derive-list.test.ts` | One test: duplicate keys in an external seed throw |
| `CHANGELOG.md` | "Fixed" entries under 2.0.0 |

## Step-by-step implementation

### Step 1 — Reproduce all three (fail-first tests)

Add to `test/list.test.ts` (follow the file's existing content-key setup pattern — search for
`keyConfig` to copy the exact shape used there, e.g. `keyConfig: item => item.id`):

```ts
test('splice rejects duplicate keys within the inserted batch', () => {
  const list = createList([{ id: 1 }], { keyConfig: item => `id-${item.id}` })
  expect(() => list.splice(1, 0, { id: 7 }, { id: 7 })).toThrow(DuplicateKeyError)
  expect(list.length).toBe(1)                    // unchanged — atomic
  expect(list.get()).toEqual([{ id: 1 }])
})

test('splice rejects a nullish inserted item without partial mutation', () => {
  const list = createList([{ id: 1 }], { keyConfig: item => `id-${item.id}` })
  expect(() => list.splice(1, 0, { id: 2 }, undefined as unknown as { id: number }))
    .toThrow(NullishSignalValueError)
  expect(list.length).toBe(1)
  expect(list.get()).toEqual([{ id: 1 }])
})

test('createList rejects duplicate keys in the initial value', () => {
  expect(() =>
    createList([{ id: 1 }, { id: 1 }], { keyConfig: item => `id-${item.id}` }),
  ).toThrow(DuplicateKeyError)
})
```

And in `test/derive-list.test.ts`, external-push describe block:

```ts
test('rejects duplicate keys in the seed', () => {
  expect(() =>
    deriveList([{ id: 1 }, { id: 1 }], {
      keyConfig: item => `id-${item.id}`,
      watched: () => () => {},
    }),
  ).toThrow(DuplicateKeyError)
})
```

Run `bun test test/list.test.ts test/derive-list.test.ts` and confirm all four fail today.
(For the duplicate-key ones, note *how* they fail today: the first two probably don't throw
at all — assert on the corrupted state too if you want to see it: `list.length === 3` and
`list.keyAt(1) === list.keyAt(2)`.)

### Step 2 — Fix `splice` (src/nodes/list.ts ≈1352-1366)

Replace the item loop:

```ts
// Stage the whole inserted batch — including duplicates within the batch and
// nullish items — before touching signals/keys, so an invalid splice leaves
// the list unchanged. Matches createExternalList's onChanges staging.
const staged = new Set<string>()
let index = 0
for (const item of items) {
    validateSignalValue(`${TYPE_LIST} item ${actualStart + index}`, item)
    index++
    const key = generateKey(item)
    if (key in remove) {
        // Same key removed and re-inserted: route to change, not add+remove
        delete remove[key]
        change[key] = item
        hasChange = true
    } else if (signals.has(key) || staged.has(key)) {
        throw new DuplicateKeyError(TYPE_LIST, key, item)
    } else {
        add[key] = item
        hasAdd = true
        staged.add(key)
    }
    newOrder.push(key)
}
```

Key points:

- Validate the item **before** `generateKey(item)` — a content-based `keyConfig` reading a
  property of `null`/`undefined` would otherwise throw a bare `TypeError` from user code
  instead of the library's `NullishSignalValueError`.
- `staged.has(key)` is the new check (bug 1). A key that routes to `change` (the
  remove-and-reinsert case) does not need `staged`: a second occurrence of the same key
  after `delete remove[key]` hits `signals.has(key)` (still present — removal hasn't been
  applied yet) and throws, which is correct. Do not "simplify" this by adding change-keys to
  `staged` — it would break the legitimate remove-one-insert-one flow.
- All throws happen while `signals`, `keys`, and `node.flags` are untouched: `add`, `change`,
  `remove`, `newOrder`, and `staged` are locals. That is the atomicity guarantee; keep it
  that way — do not move `applyChanges` into the loop.

### Step 3 — Init-loop duplicate validation

In `createList` (≈1145-1154), replace the init loop. The existing `let key = keys[i]` /
`if (!key)` scaffold is dead code — `keys` was created empty 80 lines above and nothing
writes to it in between. New loop:

```ts
for (let i = 0; i < value.length; i++) {
    const val = value[i]
    if (val == null) throw new NullishSignalValueError(`${TYPE_LIST} item ${i}`)
    const key = generateKey(val)
    if (signals.has(key)) throw new DuplicateKeyError(TYPE_LIST, key, val)
    keys[i] = key
    signals.set(key, itemFactory(val))
}
```

In `createExternalList`'s init loop (≈815-820), add the same `signals.has(key)` check between
`generateKey(item)` and `signals.set(...)`.

### Step 4 — Dead-code removal (verified safe)

1. **`applyChanges` removals branch (≈1130-1135):** delete the `keys.indexOf` / `keys.splice`
   pair, keep `signals.delete(key)` and `structural = true`. Justification (verify before
   deleting, then record in the commit message): `applyChanges` has exactly two callers —
   `set()` reassigns `keys = changes.newKeys` *before* calling it (removed keys already
   absent → `indexOf` returns -1), and `splice()` overwrites `keys = newOrder` *after* the
   call (splice already handled its own key ordering). Grep to confirm:
   `grep -n 'applyChanges(' src/nodes/list.ts` — the only call sites are ≈1204 and ≈1373.
2. **`onChanges` additions (≈848):** `if (!keys.includes(key)) keys.push(key)` →
   `keys.push(key)`. The staged `Map` above it (≈836-844) already rejects
   `signals.has(key) || staged.has(key)`, and `keys`/`signals` are only mutated together in
   this file — an O(n) `includes` scan per added item (O(n²) per batch) buys nothing. While
   there, fix the comment at ≈830-834 that says this staging "Mirrors List.splice()" —
   before this plan that was aspirational; reword to state that both paths stage.

### Step 5 — Changelog

Under the 2.0.0 section (create the section first if PLAN-v2-release-readiness has not run —
coordination note: whichever plan runs first creates it):

```markdown
- **`List` mutations now validate duplicate keys and nullish items atomically** (`src/nodes/list.ts`):
  `splice()` silently accepted the same content-based key twice in one inserted batch,
  corrupting `length` and iteration; it also validated items mid-mutation, so an invalid
  item could leave earlier insertions committed with no propagation. Insertions are now
  staged and validated up front — an invalid `splice` throws (`DuplicateKeyError` /
  `NullishSignalValueError`) with the list untouched. `createList()` and the external-push
  form of `deriveList()` now also reject duplicate keys in their initial value/seed instead
  of silently overwriting the first item's signal. Auto-increment keys (the default) are
  unaffected.
```

## Edge cases a weaker model would miss

1. **Do not touch the remove-then-reinsert (`change`) route.** `splice(0, 1, sameItem)` must
   keep working as a change, not throw — there are existing tests for it
   (`test/list.test.ts`, search `splice` for the "same key" case). Only *additional*
   duplicates beyond the first re-insert throw.
2. **`newOrder.push(key)` must stay unconditional.** Every inserted item — whether routed to
   `add` or `change` — contributes its key to the order exactly once. Moving it inside the
   branches breaks reinsertion.
3. **The error provenance strings differ deliberately.** `splice` passes `TYPE_LIST`
   (`'List'`); the external path passes `'deriveList'`. Keep them as they are — changing
   provenance strings is PLAN-error-surface-hardening's scope, and tests assert messages.
4. **Content-based vs auto-increment.** With the default auto-increment `keyConfig`,
   `generateKey` never returns the same key twice, so the new checks are unreachable — do
   not "optimize" them away with a `contentBased` flag check; the guard is cheap (one
   `Map.has`/`Set.has`) and protects custom key configs that don't set `contentBased`
   correctly.
5. **`validateSignalValue` with no guard argument throws `NullishSignalValueError` only for
   null/undefined** — that is exactly the contract needed here. Do not pass `isRecord` or
   any shape guard; `List<T>` accepts primitives.
6. **The `remove` collection holds *values*, keyed by key.** `Object.values(remove)` is the
   splice return value. Staging must not reorder or re-key `remove` — only `delete
   remove[key]` for the reinsert case, as before.
7. **`itemToKey` in the external path.** The external init loop doesn't populate
   `itemToKey`... check before assuming: if the loop you're editing sets
   `itemToKey.set(item, key)`, keep the duplicate check *before* that line so a throw
   leaves the map untouched.
8. **Existing duplicate-against-existing tests** (`test/list.test.ts` ≈454 and ≈462 per the
   audit) must keep passing unchanged — they cover `add`/`splice` against *existing* keys,
   which this plan does not alter.

## Acceptance criteria

- [ ] The four Step 1 tests fail on unmodified source (fail-first verified) and pass after.
- [ ] `bun test` full suite green (expect ≥ 674; existing duplicate-key tests unchanged).
- [ ] `grep -n 'keys.indexOf' src/nodes/list.ts` returns no hits inside `applyChanges`
      (the `indexOfKey` method and `remove` legitimately use `keys.indexOf` — check hits by
      context, or temporarily rename nothing and just eyeball the two lines you deleted).
- [ ] `bunx tsc --noEmit` and `bunx biome check .` clean; `bun run build` succeeds.
- [ ] `bun test test/regression-bundle.test.ts` passes (no bundle growth expected — the
      `Set` only allocates on the splice path).
- [ ] `CHANGELOG.md` carries the Fixed entry.
