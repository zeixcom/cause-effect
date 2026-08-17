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

- [ ] CE-017: Make the v2 branch releasable as 2.0.0
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

## Phase 3 — Agent docs and error surface (after Phase 2)

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

## Phase 4 — ADR-0019: `get(key)` value shortcut (new, not covered by the 5 plans)

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
  unimplemented, confirming it needs its own tasks (Phase 4 above), since none of the 5 plans
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
- Sequencing across Phase 4 and Phases 1-2: CE-021/CE-022 touch the same files CE-015/CE-016
  modify. Implementing ADR-0019 before those land would mean rebasing through two
  independently-designed changes to the same lookup paths — Phase 4 is ordered last for
  this reason, not because it's lower priority in an absolute sense.
