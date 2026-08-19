# TODO

Recreated 2026-08-17 after the previous TODO.md (CE-001–CE-014, all done/reviewed) was
deleted. Triage of ADR-0019 and the five `/plans/*.md` files against the current repo state
on `v2/shape-exploration` (`2.0.0-next.1`, 670/670 tests green, core bundle 2080B/3072B,
full-library 7975B gz / 23225B min). See **Triage Notes** at the bottom for what was verified
and what's flagged as a risk rather than silently assumed.

Run order matters — respect the phases below. Do not start a later phase's tasks before the
earlier phase's are done, unless a task says otherwise.

## Phase 1 — Correctness fixes (source changes, land first)

- [x] CE-015: Fix `deriveStore(seed, { watched })` never activating for property-only reads — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/store.ts` (`deriveStore` external-push branch: lifecycle-anchor
  node, `subscribe`/`stopWatched`), `src/graph.ts` (export `type SourceNode`),
  `test/derive-store.test.ts` (7 new tests), `ARCHITECTURE.md`, `adr/0015-...md`
  (Clarification section), `.agents/skills/shared/references/non-obvious-behaviors.md`
  (`<watched_activation_is_shape_wide>`), `CHANGELOG.md` (Fixed entry).
  **Review:** Approved. Matches `plans/PLAN-store-watched-lifecycle.md` exactly — anchor
  re-arm (`anchor.stop = stopWatched` inside the `!anchor.sinks` branch), `activeSink` guard,
  single-activation via `!anchor.sinks` rather than a boolean, `emit` still routes through
  `inner.update`. All 6 required test scenarios present and passing (property-only, byKey-only,
  stop-on-last-observer, restart-after-stop, single-start-for-mixed-observers, granularity-
  preserved, `in`-operator activation — 7 counting both access forms of the first case).
  `test/store.test.ts:556` (pinned mutable-store behavior) verified unchanged. Full suite
  681/681, `tsc --noEmit` clean, `biome check` clean, core bundle unchanged at 2080B/3072B.

- [x] CE-016: Harden `MutableList` duplicate-key validation and `splice` atomicity — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (`splice` stage-then-validate, `createList`/
  `createExternalList` init-loop duplicate checks, dead-code removal in `applyChanges`/
  `onChanges`), `test/list.test.ts` (3 new tests), `test/derive-list.test.ts` (1 new test),
  `CHANGELOG.md` (Fixed entry).
  **Review:** Approved. Matches `plans/PLAN-list-duplicate-key-hardening.md` exactly —
  validates before `generateKey` (avoids a bare `TypeError` from a content-based `keyConfig`
  on a nullish item), `staged.has(key)` check without touching the remove-then-reinsert
  `change` route, `newOrder.push(key)` stays unconditional, `applyChanges`' dead
  `keys.indexOf`/`keys.splice` pair removed (confirmed only 2 call sites, both already
  reassign `keys` around the call). All 4 required fail-first tests present and passing.
  Full suite 681/681, `tsc --noEmit` clean, `biome check` clean, full-library bundle grew
  61B gz (7975→8036B, still well under the 10240B diagnostic ceiling); core untouched.

## Phase 2 — Release readiness (after Phase 1 lands)

- [x] CE-025: Forward-port 1.5.1's `createComputed` → `deriveCell` codemod mapping — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `tools/codemod-v2.ts` (`RENAMES` map: `createComputed` now targets `deriveCell`,
  not `deriveComputed`; new `rewriteComputedOptions()` rewriting a literal `options.value` to
  `options.initial`, wired into the call-expression dispatch loop alongside
  `rewriteCreateCollection`; new `needsManualReview` hint when `createComputed` was renamed,
  pointing async call sites at the free `isPending(signal)`/`abort(signal)`; top-of-file rename
  table split into separate `createMemo`→`deriveComputed` and `createComputed`→`deriveCell` rows),
  `test/codemod-v2.test.ts` (split the old combined `createMemo`/`createComputed` test; added
  cases for the async-safe rename, the `.isPending()/.abort()` manual-review flag, the
  `options.value`→`options.initial` rewrite incl. shorthand, non-literal options, and the
  both-`value`-and-`initial` conflict).
  **How:** `createComputed` supports async callbacks in 1.x (dispatches to `Task`), but
  `deriveComputed` — this branch's sync-only narrow factory — throws on one
  (`validateCallback(WHERE, fn, isSyncFunction)` in `src/nodes/memo.ts`), so the previous
  `createComputed`→`deriveComputed` mapping silently produced code that throws at runtime for
  any async call site. Ported the `next` branch's independent fix verbatim (mapping,
  `rewriteComputedOptions`, and the manual-review hint) rather than re-deriving it, since `next`
  already validated the approach against 1.x's actual `createComputed` dispatch. `createMemo`
  stays mapped to `deriveComputed` — it only ever accepted sync callbacks in 1.x, so no bug there.
  **Check:** `bun test` 687/687 (was 681/681 before this task's 6 new tests), `tsc --noEmit`
  clean, `biome check` clean. Bundle figures unaffected — `tools/` is not part of the shipped
  bundle.

- [x] CE-026: Merge 1.5.1's CHANGELOG entries into this branch's `[Unreleased]` section — done ✓
  **Skill:** changelog-keeper
  **Changed:** `CHANGELOG.md` (both `[Unreleased]` → Fixed entries for the `deriveStore`
  watched-lifecycle fix and the `List` duplicate-key/atomicity hardening).
  **How:** Appended "Backported to 1.5.1." to each entry, matching `next`'s `CHANGELOG.md`
  `## 1.5.1` section, which cites this branch's `c48171b` by commit for both. No reorganization
  of `[Unreleased]` — that's CE-017 Step 1, done alongside this (see below).

- [x] CE-017: Make the v2 branch releasable as 2.0.0 — done ✓
  **Skill:** changelog-keeper (Step 1), adr-keeper (Step 2), tech-writer (Steps 3, 5), cause-effect-dev (Step 4)
  **Context:** Follow `plans/PLAN-v2-release-readiness.md`, with two corrections found during
  triage that the plan's author didn't have current information for:
  1. **CHANGELOG.md premise is stale.** The plan says "no 2.0.0 section at all, file starts
     at `## 1.5.0`" — false today: there's already a `## [Unreleased]` section (verified,
     `CHANGELOG.md:3`) containing the Cell/Signal-umbrella rename and other 2.0 entries.
     Standard Keep-a-Changelog practice keeps material under `[Unreleased]` until the actual
     version is cut, not at `2.0.0-next.1`. **Do not rename `[Unreleased]` to `## 2.0.0` as
     part of this task** — instead, audit `[Unreleased]` for completeness against
     `git log v1.5.0..HEAD` and this TODO's Phase 1/3 entries, and leave the rename to the
     maintainer's actual release-cut step. Flag this correction in the PR description so the
     plan file itself can be fixed.
  2. **ARCHITECTURE.md is also stale and outside the plan's file list.** `ARCHITECTURE.md:199`
     still says "List and Collection" (pre-collapse vocabulary) in the Composite Lookup
     Methods section, and the Key Decisions table (`ARCHITECTURE.md:211-212`) tags the
     taxonomy and `isPending`/`abort` decisions "(v2.0, proposed)". Update both to the shipped
     ADR-0018 vocabulary and drop "proposed" once ADR-0018's status flips to Accepted in Step 2.
  Otherwise follow the plan's steps as written, including the Step 0 decision to record (ask
  the user whether 1.5.1 back-ports the `isSignal`/`isMutableSignal` umbrella-guard
  correction to `main` before 2.0 ships, per CE-012) and the bundle re-baseline in Step 4
  (current measurement: core 2080B — well under the untouchable 3072B hard limit; full-library
  7975B gz / 23225B min — re-baseline the diagnostic ceilings from this run, don't hand-edit
  the numbers in the plan text since they'll be stale by the time this runs after CE-015/CE-016).

  **Step 1 (changelog-keeper) — done:** Audited `[Unreleased]` against
  `git log v1.5.0..HEAD` and the current `index.ts` export diff against `v1.5.0`. Found three
  gaps beyond the four this correction note already flagged (those were added in `c6637e7`,
  confirmed present): (a) `List<T>`/`isList(x)` and `Store<T>`/`isStore(x)` being recycled from
  the 1.5.0 mutable meaning to the 2.0 readonly-base meaning — the same class of silent-flip
  hazard as the `Signal`→`Cell` entry already documents, but for List/Store it had no `[Unreleased]`
  entry at all (only `MIGRATION-2.0.md` covered it); (b) `ComputedOptions`/`SensorOptions`/
  `SensorCallback` folding into `DeriveCellOptions`/`CellCallback` — folded into the existing
  `SignalOptions`/… rename entry rather than a new bullet; (c) CE-025's codemod fix
  (`createComputed` → `deriveCell`, not `deriveComputed`) had no entry — added one under Fixed.
  All three now in `CHANGELOG.md` `[Unreleased]`. Did **not** touch `[Unreleased]`'s heading or
  reorganize sections, per the plan correction above.

  **2026-08-17 architect re-audit of the remaining steps** (`git log`, `sed`/`grep` against
  each named file, `bun run check`, `bun run build` + `bun test test/regression-bundle.test.ts`
  for a fresh measurement):
  - **Step 0 (back-port decision) — resolved, no action needed.** `main`'s 1.5.0 `isSignal`
    (`git show v1.5.0:src/signal.ts`) was already the umbrella match (`SIGNAL_TYPES.has(tag)`)
    — it was never narrowed. Only this branch's *intermediate* (pre-Revision) state had the
    narrow meaning, and the same-day Revision reverted it before anything shipped. There is no
    `isSignal`/`isMutableSignal` bug on `main` to back-port. Separately, `1.5.1` (the real
    correctness back-port, CE-015/CE-016-equivalent + Cell bridge names + the CE-025 codemod
    fix) is already prepared on `next` (`package.json` version bumped, `CHANGELOG.md` has a
    `## 1.5.1` section) — not yet tagged or `npm publish`ed, which is out of this plan's scope
    per its own last paragraph. `REQUIREMENTS.md`'s banner sentence framing this as a pending
    "corrected umbrella `isSignal`/`isMutableSignal` meaning" back-port is therefore imprecise
    (describes a fix that was never needed on `main`) — flagged in CE-028 below rather than
    hand-edited here, since precise rewording is tech-writer's call.
  - **Step 1 acceptance criterion ("`CHANGELOG.md` starts with `## 2.0.0`") — superseded, not
    unmet.** The Step 1 correction above already established `[Unreleased]` stays as-is until
    the maintainer's real release-cut; this criterion in the plan predates that correction.
  - **Step 2 (ADR status hygiene) — half done.** `adr/0018-...md` Status is
    `✅ Accepted — 2026-08-17 …` (confirmed, matches the plan's exact wording). `adr/0001-...md`
    Status is still bare `✅ Accepted` — the required `Amended by [ADR-0018](...)` line was
    never appended. **Gap → CE-027.**
  - **Step 3 (MIGRATION-2.0.md) — not done.** `grep -n "createMemo\|deriveSignal\|createTask\|
    createSensor\|createSignal" MIGRATION-2.0.md` still returns hits asserting current-v2 names
    outside the two protected historical sections (confirmed lines ≈30-33, 48, 88-92, 159-161,
    202-203, 224, plus the status banner at line 3 still says "ADR-0018 is Proposed"). One
    addition beyond the plan's original 6-item list: line 159 ("codemod rewrites
    `createMemo`/`createComputed` to `deriveComputed`") is now doubly wrong post-CE-025 —
    `createComputed` rewrites to `deriveCell`, not `deriveComputed`. **Gap → CE-028.**
  - **Step 4 (bundle re-baseline) — not done.** Fresh measurement this pass: core
    **2080 B gz** (well under the untouchable 3072 B hard limit), full-library **23447 B min /
    8036 B gz**. `test/regression-bundle.test.ts` ceilings are still the old 28672 B / 10240 B
    (unchanged since before Phase 1), and `README.md:49`/`:140` still say "around 8 kB" instead
    of a measured figure. **Gap → CE-029.**
  - **Step 5 (REQUIREMENTS.md banner) — done.** No longer says "in transition"; already
    rewritten in `8e26ce7`. Minor imprecision noted under Step 0 above, folded into CE-028.
  - **Step 6 (final gates) — `bun run check` green** (tsc, biome, full suite, bundle
    regression all pass as of this pass). CE-010 doesn't exist in the current `TODO.md` (it
    belonged to the deleted pre-2026-08-17 file, recreated as this one) — nothing to check off.

  **Closed 2026-08-17.** All three gaps landed: CE-027 (ADR-0001 amendment note), CE-028
  (MIGRATION-2.0.md's 7 stale passages + the REQUIREMENTS.md `isSignal` framing), CE-029
  (bundle ceilings re-baselined to 29309 B / 10045 B, README figure updated to the measured
  8036 B). `bun run check` and `bun run regression` both green. The v2 branch is releasable
  as 2.0.0 in every respect this plan gates; version bump, tagging, and `npm publish` remain
  the maintainer's mechanics, out of scope per the plan. Phase 2 done — Phase 4 (CE-018,
  CE-019) may start after Phase 3's forward-ports (CE-030, CE-031) land.

- [x] CE-027: Add the ADR-0018 amendment note to ADR-0001's Status line — done ✓
  **Skill:** adr-keeper
  **Changed:** `adr/0001-reactive-task-stale-detection.md` (Status section, one line added).
  **How:** Added `Amended by [ADR-0018](0018-shape-indexed-signal-types.md) (2026-08-17).`
  directly below the existing `✅ Accepted` line, matching ADR-0018's own back-reference style
  (`Amends [ADR-0001](0001-...)`). Context/Decision/Alternatives/Consequences/Related sections
  untouched — ADRs are immutable once Accepted; this is a status-line cross-reference only, the
  same class of edit the supersede workflow already permits on an Accepted ADR's status line.
  No `adr-index.md` exists in this repo to update in parallel.

- [x] CE-028: Fix the stale passages in MIGRATION-2.0.md — done ✓
  **Skill:** tech-writer
  **Changed:** `MIGRATION-2.0.md` (7 passages: status banner; "keep their names" paragraph;
  smaller-renames table rows for `SensorCallback`/`ComputedOptions`/`SensorOptions`; the
  Second-flip section's codemod-behavior sentence; the "Running the codemod"
  `isSignal`/`isMutableSignal`-flagging sentence; the origin-guards `isSignal`→`isCell` swap;
  the `createComputed`/`createMutableSignal` subsumption note and the file's final sentence),
  `REQUIREMENTS.md` (transition banner, one sentence).
  **How:** All six of the plan's Step 3 passages retargeted to the final (Revision) names —
  `createMemo`→`deriveComputed`, `createComputed`/`createMutableSignal`→`deriveCell`/
  `createCell`, `SensorCallback`→`CellCallback`, `ComputedOptions`/`SensorOptions`→
  `DeriveCellOptions`, `createTask`/`createSensor` framed as removed-from-public-API (route
  through `deriveCell`), status banner reflects ADR-0018 Accepted. Plus the CE-017-re-audit
  addition: the Second-flip section's codemod sentence now says `createComputed` rewrites to
  `deriveCell` (not `deriveComputed`, which is sync-only) — verified against
  `tools/codemod-v2.ts`'s `RENAMES` map, the source of truth, not the plan text. The
  `isSignal`-flagging sentence in "Running the codemod" was deleted (that flagging doesn't
  exist — the codemod leaves `isSignal`/`isMutableSignal` untouched), which now agrees with
  the Second-flip section's own description of the same behavior. `REQUIREMENTS.md`'s banner
  no longer frames 1.5.1 as correcting an `isSignal` bug on `main` (verified `main` never had
  one) — reworded to describe what 1.5.1 actually adds (the `Cell` bridge names).
  **Check:** `git diff -U0 MIGRATION-2.0.md` — no hunk touches original lines 53-111 (the two
  protected historical `isSignal` sections, CE-008/CE-009). Verification grep
  (`createMemo\|deriveSignal\|createTask\|createSensor\|createSignal`) — every remaining hit
  is either inside a protected historical section, a rename-table's left (old-name) column, or
  a "before" code example; none assert a current v2 name. `bun run check` green (tsc, biome,
  675 tests, bundle regression).

- [x] CE-029: Re-baseline the full-library bundle ceilings and README figure — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `test/regression-bundle.test.ts` (two ceilings + log strings + comments),
  `REQUIREMENTS.md` § Bundle Size (table), `README.md:49` (full-library figure; `:140` only
  has the core claim, unaffected — no second full-library mention existed).
  **How:** Fresh measurement confirmed no drift from the 2026-08-17 figures quoted in this
  task (CE-027/CE-028 were docs-only, as expected): core **2080 B gz** (well under the
  untouchable 3072 B hard limit — no STOP condition), full-library **23447 B minified /
  8036 B gzipped**. Set the two full-library ceilings to `ceil(measured × 1.25)`: minified
  28672→**29309 B**, gzipped 10240→**10045 B** (the gzipped ceiling tightens even though the
  minified one loosens — both are just `measured × 1.25`, and REQUIREMENTS.md is explicit
  that they move independently, not in lockstep). Mirrored both into `REQUIREMENTS.md`'s
  Bundle Size table (rounded kB display unchanged: 29 kB / 10 kB, since 29309 B ≈ 28.6 kB and
  10045 B ≈ 9.8 kB both still round to the existing labels). `README.md:49`'s "around 8 kB"
  replaced with the precise measured figure, "8036 B (~7.9 kB) gzipped".
  **Check:** `bun run regression` green (9 performance scenarios + 3 bundle assertions).
  `bun run check` green (tsc, biome, 675 tests, bundle regression).

  **CE-017 closed — all three gap tasks (CE-027, CE-028, CE-029) landed.** Step 0 (resolved,
  no back-port needed), Step 1 (changelog audit), Step 2 (ADR status hygiene, CE-027), Step 3
  (MIGRATION-2.0.md, CE-028), Step 4 (this task), Step 5 (REQUIREMENTS.md banner), and Step 6
  (`bun run check` green) are all satisfied. Phase 2 is done; Phase 3 (CE-030, CE-031,
  forward-ported bugfixes) starts next, then Phase 4 (CE-018, CE-019).

## Phase 3 — Forward-port 1.5.x bugfixes (after Phase 2, before docs)

Two fixes landed on `next` (PR #83, PR #84 — now released as 1.5.2) after `v2/shape-exploration`
diverged. Both bugs reproduce as-is in this branch's `src/nodes/list.ts` — the file was carried
forward with the pre-fix logic. Land these before CE-018/CE-019 so the agent-docs sync and
error-surface pass document the corrected behavior, not the bug.

- [x] CE-030: Fix `deriveList` per-item overload order (async must precede sync) — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (swapped the two public per-item `deriveList` overloads,
  async now declared before sync), `test/derive-list.test.ts` (new type-level regression test
  + `List` import).
  **Review:** Approved. Verified the swap against the actual TS resolution rule (order matters
  because the sync overload's parameter type is a supertype-compatible match for an async
  callback, not the reverse) — the fix is correctly targeted, not cargo-culted from `next`.
  `derivePerItem` left untouched is the right call: it's module-private, reached only through
  explicit casts in `deriveList`'s implementation body, so its declaration order never
  participates in a public call site's overload resolution — swapping it would be pure noise.
  The compile-time assertion (`List<number>` assignment that fails to compile on regression)
  is the correct test shape for a type-inference bug; no runtime assertion could exercise this.
  `tsc --noEmit` and `bun test` (692/692) both clean.

- [x] CE-031: Retire stale keys on content change; reject unresolvable `change`/`remove` entries — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (`getKeyGenerator` now returns a third `positional` flag;
  threaded through `diffArrays`/`diffPositional`; `diffPositional` retires the old key and
  mints a fresh one on content mismatch at a shared index when `!positional`; `onChanges()`
  now stages `change`/`remove` key resolution before mutating, throwing `UnresolvableKeyError`
  for the whole batch if any entry can't resolve), `src/errors.ts` (new `UnresolvableKeyError`
  class + export, message text matches `next`'s), `index.ts` (export `UnresolvableKeyError`),
  `test/derive-list.test.ts` (stale-key retirement test + 3 `UnresolvableKeyError` tests under
  `external push`), `CHANGELOG.md` (`[Unreleased]`: one Added entry for the new error class,
  three Fixed entries for the overload-order and two key-handling bugs).
  **Review:** Approved. Confirmed the fix is correctly scoped to the non-content-based
  (`diffPositional`) path only — the content-based branch of `diffArrays` (hash-map diff)
  already resolved identity by content and was never in scope; the existing "keeps item
  identity across recomputes with a content-based keyConfig" test still passes unchanged,
  confirming no regression there. `positional = keyConfig === undefined` correctly separates
  "no keyConfig at all → position is identity" from "any keyConfig (string or function) →
  identity distinct from position," matching the ADR-0018-era `List` contract. The
  `UnresolvableKeyError` provenance string (`'deriveList'`) matches the existing local
  convention in `createExternalList` (same string already used for its `DuplicateKeyError`/
  `validateCallback` calls) rather than `TYPE_LIST` — consistent, not a deviation. Message
  wording copied from `next` is fine as-is: it's generic library-behavior text with no 1.x
  vocabulary baked in, needs no v2-specific rewrite. One minor nit, not blocking: the 1.x fix
  had an explanatory comment above `resolveKey` (~`src/nodes/list.ts:816`) noting that a
  content-based `keyConfig` never falls through to `undefined`, so the throw path is
  identity-only-config's concern; that comment didn't get ported. Low value to chase alone —
  fold it in opportunistically if `resolveKey` is touched again, no standalone task needed.
  `bun run check` (tsc, biome, 692/692 tests, bundle regression) clean.

## Phase 4 — Agent docs and error surface (after Phase 3)

- [ ] CE-018: Sync agent-facing documentation to the shipped v2 API
  **Skill:** tech-writer
  **Context:** Follow `plans/PLAN-agent-docs-sync.md` exactly — full rewrite of
  `.github/copilot-instructions.md`, plus ~15 targeted fixes across `.agents/skills/`
  (stale `DerivedList`/`Collection` vocabulary, broken workflow section anchors, a missing
  error class in `error-classes.md`, a wrong `itemEquals` fact). Run after CE-017 so ADR-0018's
  status (Accepted) and the final CHANGELOG state are settled before this pass documents them.
  Must run *before* CE-019 (see that task's dependency note — the plan file itself says so).

- [ ] CE-019: Error-surface hardening — provenance, message accuracy, boundary validation
  **Skill:** cause-effect-dev, with changelog-keeper and tech-writer touch-ups
  **Context:** Follow `plans/PLAN-error-surface-hardening.md` exactly — 8 defects: inconsistent
  error provenance strings, an unactionable `PromiseValueError` message (still says "use a
  Task", but `createTask` is internal-only in v2), unlabeled `options.watched`-required
  errors, a bare `Error` in `slot.ts:134` instead of `CircularDependencyError`, a task-cycle
  misattributed as `[Cell]` in `graph.ts:552` (verified: `'value' in node ? TYPE_CELL :
  'Effect'` — never checks `'recompute' in node` first, so a `Task` cycle really does report
  `[Cell]` today), an unvalidated `watched`-cleanup return that later explodes as a bare
  `TypeError` deep inside `unlink`, a throwing user cleanup that can abort `unlink`'s cascade
  mid-way, and JSDoc gaps. Must run after CE-018 (that plan syncs `error-classes.md` to
  today's messages; this plan then changes several messages and re-syncs the file itself in
  its own Step 8 — running it first would mean CE-018 immediately goes stale).

## Phase 5 — ADR-0019: `get(key)` value shortcut (new, not covered by the 5 plans)

ADR-0019 is 🔄 Proposed, depends on ADR-0018 (accepted in code as of Phase 1/2, not yet
flagged Accepted in the ADR file until CE-017 Step 2 runs), and has **not** been implemented —
verified: no `get(key: string)`/`get(key: K)` overload exists in `src/nodes/list.ts` or
`src/nodes/store.ts` today. The ADR itself flags two unresolved risks in its Consequences
section; do not treat "Proposed" as "ready to implement" — CE-020 resolves both before any
code is written.

- [ ] CE-020: Spike ADR-0019's TypeScript overload-resolution risk
  **Skill:** cause-effect-dev
  **Context:** ADR-0019's Consequences section flags, unverified: "overloaded methods do not
  collapse cleanly to a single callable type" — a consumer passing `list.get` or `store.get`
  by reference (e.g. `items.map(list.get)` expecting the arity-0 `() => T[]` signature) may
  see the overload resolve unexpectedly or fail to type-check. Write a scratch `.ts` file
  declaring the proposed overload shapes from the ADR's Decision section
  (`get(key: string): T | undefined` for List; `get<K extends keyof T & string>(key: K): T[K]`
  for Store) alongside the existing `get(): T[]` / `get(): T`, and test at least: (a) calling
  `list.get('k')` and `list.get()` positionally — must both resolve correctly; (b) passing
  `list.get` by reference to `Array.prototype.map` and to `effect()`/a bare function-typed
  parameter — record what TypeScript actually infers; (c) same two checks for `Store`. Run
  `bunx tsc --noEmit` against the scratch file. Report the findings in `NOTES.md` under a
  `CE-020` entry if the by-reference case resolves ambiguously or wrongly (this blocks
  CE-021/CE-022 until the Architect picks a mitigation — e.g. a differently-named shortcut,
  which the ADR's Alternatives section already sketches as a fallback). If resolution is
  clean, delete the scratch file and proceed directly to CE-021/CE-022 without waiting for
  Architect review.

- [ ] CE-021: Implement `List.get(key)` value-shortcut overload
  **Skill:** cause-effect-dev
  **Context:** Depends on CE-020 (spike clean or mitigation chosen) and CE-016 (list.ts
  duplicate-key hardening — implement against the post-hardening `splice`/init code, not the
  current version, to avoid a rebase). Add `get(key: string): T | undefined` to `List<T, S>`
  per ADR-0019's Decision section, implemented as a thin wrapper over the existing
  `byKey(key)?.get()` path — not a separate lookup — so both the ADR-0015 structural edge and
  the value edge are established identically to what it replaces syntactically. `MutableList`
  inherits the overload from the readonly base; no separate declaration needed. Add tests
  proving both edges fire (a structural change re-runs an effect reading `list.get(key)` just
  as one reading `byKey(key)?.get()` would; a value-only change does too) and that a
  present-vs-absent key returns `T | undefined` correctly.

- [ ] CE-022: Implement `Store.get(key)` value-shortcut overload
  **Skill:** cause-effect-dev
  **Context:** Depends on CE-020 and CE-015 (store.ts watched-lifecycle fix — the external-push
  facade's `byKey` gains a `subscribe()` call in that task; `get(key)` must wrap the
  *post-fix* `byKey`, or it inherits the same never-activates bug for external-push stores
  read only via `get(key)`). Add `get<K extends keyof T & string>(key: K): T[K]` to `Store<T>`
  per ADR-0019's Decision section — no `| undefined`, since `T`'s keys are statically known
  and every key is initialized at construction (unlike `byKey`/the proxy, which keep their
  existing `| undefined` unchanged). Implement as a thin wrapper over `byKey(key)!.get()` (the
  non-null assertion is sound here specifically because Store keys are exhaustive over `T`,
  which `byKey`'s own `| undefined` does not currently express — do not weaken this to
  `byKey(key)?.get()` and silently return `undefined`, that reintroduces the nullability
  ADR-0019 exists to remove). `MutableStore` inherits the overload from the readonly base.
  Add tests proving the same double-edge equivalence as CE-021, and that a derived Store's
  `get(key)` on a per-key `Cell` (ADR-0018 §7 — derived Stores derive their slices) still
  correctly reads through equality suppression.

- [ ] CE-023: Update ARCHITECTURE.md and flip ADR-0019 status
  **Skill:** architect
  **Context:** After CE-021/CE-022 land: add a `get(key)` row/paragraph to ARCHITECTURE.md's
  Composite Lookup Methods section (the one CE-017 already touched for vocabulary — extend
  it, don't duplicate it) describing the value-vs-signal split (`byKey` → signal, `get(key)`
  → value) and the List/Store nullability asymmetry. Add a Key Decisions table row for
  ADR-0019. This is a review gate, not a rubber stamp — confirm during review that the
  Minimal Surface tradeoff the ADR argues for itself (a second path to the same value) is
  still judged worth it after seeing the real diff, and that CE-020's spike findings (clean
  or mitigated) are recorded in the ADR's Consequences section before flipping Status from
  🔄 Proposed to ✅ Accepted.

- [ ] CE-024: Document `get(key)` in user-facing docs and CHANGELOG
  **Skill:** tech-writer, changelog-keeper
  **Context:** Depends on CE-023 (ADR Accepted). Add `get(key)` to GUIDE.md/RECIPES.md
  wherever `byKey(key)?.get()` is currently shown as the pattern for reading a keyed value
  (search both files for `byKey(` — every hit that immediately calls `.get()` is a candidate
  to show the shortcut alongside, not replace, since `byKey` remains the signal-handle path).
  Add one CHANGELOG entry under the section CE-017 left open (`[Unreleased]` unless the
  maintainer has since cut `## 2.0.0` — check the current heading, don't assume).

## Triage Notes

**Verified against the repo (not taken on the plans' word):**
- `bun test`: 670/670 pass, matching every plan's stated baseline.
- TODO.md was indeed absent (confirms the user's account); highest CE-ID referenced anywhere
  in the repo (including inside the plan files themselves) is CE-019 — new work starts at
  CE-020.
- `src/nodes/store.ts:401`'s `byKey` genuinely never calls `subscribe()` — PLAN-store-watched-
  lifecycle's root cause is real, not a stale claim.
- `src/graph.ts:552`'s `CircularDependencyError` really does check `'value' in node` without
  first checking `'recompute' in node` — PLAN-error-surface-hardening defect #5 is real.
- `src/errors.ts` exports exactly 11 error classes — matches both plans' counts.
- No `get(key)` overload exists anywhere in `list.ts`/`store.ts` today — ADR-0019 is
  unimplemented, confirming it needs its own tasks (Phase 5 above), since none of the 5 plans
  touch it.
- Bundle figures at time of triage: core 2080B gz (limit 3072B, hard), full library 7975B gz
  / 23225B min (ceilings 10240B / 28672B) — comfortably under, but CE-017 still must re-run
  the measurement itself since these numbers will shift after Phase 1's changes.

**Risks flagged, not silently resolved:**
- CHANGELOG.md heading strategy (CE-017) — the release-readiness plan's premise that no 2.0.0
  section exists is wrong; corrected above rather than followed literally.
- ARCHITECTURE.md staleness (CE-017) — found during triage, outside every plan's file list;
  added so it doesn't fall through the cracks between plans.
- ADR-0019's own unresolved risks (TS overload resolution, structural-edge duplication) are
  real open items the ADR itself calls out — CE-020 gates CE-021/CE-022 on resolving the
  first; the second is addressed by CE-021/CE-022's explicit "thin wrapper, not a separate
  lookup" instruction.
- Sequencing across Phase 5 and Phases 1-2: CE-021/CE-022 touch the same files CE-015/CE-016
  modify. Implementing ADR-0019 before those land would mean rebasing through two
  independently-designed changes to the same lookup paths — Phase 5 is ordered last for
  this reason, not because it's lower priority in an absolute sense.
