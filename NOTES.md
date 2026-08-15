# NOTES

---

## CE-031 — Five of the six named types are load-bearing for `deriveList`, not safe to deprecate
**Date:** 2026-08-16 | **Skill:** cause-effect-dev

**Issue:** CE-031 asked to mark six `Collection` auxiliary types `@deprecated`:
`CollectionCallback`, `CollectionChanges`, `CollectionOptions`, `CollectionSource`,
`DeriveCollectionCallback`, `DeriveCollectionOptions`. The task's premise — "none of the six
exist in `v2/shape-exploration`'s `index.ts`" — is correct, but doesn't establish that they're
safe to deprecate today. I checked every call site (`grep -n` across `src/nodes/collection.ts`)
before writing any markers, per this skill's "read before writing" rule, and found:

- **`CollectionOptions`** — used only by the already-deprecated `createCollection` (its `options`
  parameter). Safe. Deprecated it (done, see below).
- **`CollectionSource`**, **`DeriveCollectionOptions`**, **`DeriveCollectionCallback`**,
  **`CollectionCallback`** (and transitively `CollectionChanges`, which only appears inside
  `CollectionCallback`'s own signature) — all four/five are used directly in `deriveList`'s
  **current, non-deprecated, flagship** public overloads: the per-item form's `source` and
  `options` parameters (`CollectionSource`, `DeriveCollectionOptions`,
  `DeriveCollectionCallback` — `src/nodes/collection.ts:767-788`) and the external-push form's
  `watched` option (`CollectionCallback`, hence `CollectionChanges` — line 764). Marking any of
  these `@deprecated` would flag `deriveList`'s own current parameters as deprecated in every
  editor — the exact bug CE-018 already fixed once for `isEqual`'s export block, reintroduced at
  the type level instead of the export level.

I did not apply markers to these five. Doing so would violate CE-031's own "no runtime changes,
safe, JSDoc only" premise — it isn't safe.

**What's actually true:** this is a fourth instance of the meaning-preserving-rename pattern
`List`/`Store` already got bridge names for (CE-016/CE-025), not a total removal like the
origin guards (CE-030). `v2/shape-exploration` renames `CollectionSource`→`ListSource`,
`CollectionCallback`→`ListCallback`, `CollectionChanges`→`ListChanges`, and folds
`DeriveCollectionOptions`/`DeriveCollectionCallback` into `deriveList`'s own option/callback
shape (per CE-022's landed outcome). 1.5 never introduced bridge names for this layer — only for
the outer `List`/`Collection`/`Store` names. `MIGRATION-2.0.md` already documents the
`CollectionSource`→`ListSource` rename as a "manual rename, no codemod rule," which is the
symptom of the same gap.

**Options:**
(a) Introduce `ListSource`/`ListCallback`/`ListChanges` (and a folded `DeriveListCallback`/
    equivalent) as new, non-deprecated 1.5 bridge names — type aliases of the existing shapes —
    migrate `deriveList`'s own signature onto them internally (mirroring exactly how CE-016
    handled `List`→`MutableList`), and *then* deprecate the five `Collection*`-prefixed names
    pointing at the new ones. This is real design/implementation work (new task), not a
    JSDoc-only change.
(b) Leave the five as first-class, non-deprecated 1.x names for this release. Consumers hit one
    more mechanical rename at the 2.0 boundary when they adopt `deriveList`'s new parameter
    types, same as `DerivedList`/`DerivedStore` already do (an accepted, documented tradeoff per
    ADR-0018 — see the architect's 2026-08-16 cross-check reply, which found that asymmetry
    intentional). Cheaper: no new task, `MIGRATION-2.0.md`'s existing manual-rename note already
    covers `CollectionSource`; extend the same note to cover the other four.

**Question:** Which option — (a) bridge names now, or (b) accept the same "one more rename at
2.0" treatment already given to `DerivedList`/`DerivedStore`? I lean toward (b): CE-016/CE-025's
bridge names exist for names with a **meaning flip** (silent behavior change if left alone);
these five have no flip risk — deriveList's `source`/`options`/`watched` shapes don't change
meaning, only their type name changes at 2.0, which is a compile-time rename a consumer's
type-checker will simply catch. But this is a judgment call about how far the born-deprecated
policy should reach, not a fact I can resolve unilaterally.
