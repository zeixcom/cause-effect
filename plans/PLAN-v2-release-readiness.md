# PLAN: Make the v2 branch releasable as 2.0.0

**Priority rank:** 3 of 5 — run after PLAN-store-watched-lifecycle and
PLAN-list-duplicate-key-hardening so their changelog entries are included.
**Suggested TODO ID:** CE-017 (skills: `changelog-keeper` for Step 1, `tech-writer` for
Steps 3-5, `cause-effect-dev`/`adr-keeper` for Step 2). Closes the open TODO item CE-010.
**Baseline at time of writing:** `bunx tsc --noEmit` clean, `bun test` 670/670; TODO.md
CE-001..CE-009, CE-011..CE-014 all done and reviewed; **CE-010 (CHANGELOG) is the only open
task.** Latest published release is 1.5.0 (git tags and npm agree).

## Goal

The v2 implementation is finished and reviewed, but five release gates are still open. This
plan closes all of them:

1. `CHANGELOG.md` has **no 2.0.0 section at all** (the file starts at `## 1.5.0`). Note:
   CE-010's task text says "the existing `2.0.0-next` entries describe the original ADR-0018
   decision" — that premise is stale; there are no such entries. The section must be written
   from TODO.md's task records and `git log`.
2. ADR-0018 still reads "🔄 Proposed" although 13 of its 14 implementation tasks are done and
   reviewed; ADR-0001's Status line was never annotated with the amendment its own body
   announces.
3. `MIGRATION-2.0.md` contains pre-Revision statements that contradict its own newer
   "Second flip" section and the shipped code.
4. The bundle-budget re-measurement ADR-0018 declares as a release gate has never been run;
   the full-library ceilings in `REQUIREMENTS.md`/`test/regression-bundle.test.ts` are
   stale constants, and `README.md`'s "around 8 kB" full-library claim is unverified.
5. The decided 1.5.1 back-port (CE-012, user decision 2026-08-17: the corrected umbrella
   `isSignal`/`isMutableSignal` meaning "ships backported in v1.5.1") has neither a tag nor
   a CHANGELOG section — decide and record its fate before 2.0 overshadows it.

## Exact files to touch

| File | Change |
|---|---|
| `CHANGELOG.md` | New `## 2.0.0` section; possibly a `## 1.5.1` section (Step 0 decision) |
| `adr/0018-shape-indexed-signal-types.md` | Status: Proposed → Accepted |
| `adr/0001-reactive-task-stale-detection.md` | Status line: append "Amended by ADR-0018" |
| `MIGRATION-2.0.md` | Fix five stale passages + status banner (exact list in Step 3) |
| `REQUIREMENTS.md` | Transition banner (≈ lines 5-14) → shipped-state wording; bundle table numbers if re-baselined |
| `README.md` | Verify/refresh ≈ line 49 bundle claim |
| `test/regression-bundle.test.ts` | Re-baseline full-library ceilings from measurement (core figures untouched) |
| `TODO.md` | Mark CE-010 done; add this plan's follow-ups if any |

## Step-by-step implementation

### Step 0 — Decide the 1.5.1 back-port (user decision point, record it and move on)

Verify state: `git tag -l` (latest v1.5.0) and `git log origin/main --oneline -5` (main sits
at the 1.5.0-era deep-equal fix; no 1.5.1 back-port commit). Per CE-012 the correction
(umbrella `isSignal`/`isMutableSignal`) is *decided* to ship as 1.5.1. **Recommendation:
release 1.5.1 from main before 2.0** — the 1.5.0 narrow guards are, per the user's own
ruling, "a bug, not a version boundary", and 1.x consumers deserve the fix regardless of
when 2.0 lands. If the user declines, add one sentence to `MIGRATION-2.0.md`'s status banner
stating the correction ships only in 2.0. Either way, write the `## 1.5.1` CHANGELOG section
if it ships, and do not block the rest of this plan on it.

### Step 1 — Write the 2.0.0 CHANGELOG section (`changelog-keeper` skill)

Sources of truth, in order: `TODO.md` entries CE-001..CE-014 (each records what changed and
why), `git log --oneline v1.5.0..HEAD`, and `MIGRATION-2.0.md`'s rename tables. Structure
under `## 2.0.0`:

- **Changed** (the headline): shape-indexed taxonomy per ADR-0018 Revision — `Cell`/
  `MutableCell` narrow single-value shape; `Signal`/`MutableSignal` umbrella again;
  `List`/`MutableList`, `Store`/`MutableStore` readonly-base/mutable split; `isPending`/
  `abort` as graph utilities; `watched` always an option; construction matrix
  (`create*`/`derive*`); async composites require `options.initial`.
- **Removed**: origin names (`State`, `Memo`, `Task`, `Sensor`, `Collection` types and
  `isState`/`isMemo`/`isTask`/`isSensor`/`isComputed` guards), `createSignal` shape
  sniffing, `createMemo` (→ `deriveComputed`), public `createTask`/`createSensor`
  (internal, reached via `deriveCell`), `isObjectOfType`, `isEqual` alias.
- **Renamed** (breaking, tabular like the 1.5.0 tables): `createMutableSignal`→`createCell`,
  `deriveSignal`→`deriveCell`, `createMemo`/`createComputed`→`deriveComputed`,
  `SignalOptions`→`CellOptions`, `DeriveSignalOptions`→`DeriveCellOptions`,
  `SignalCallback`→`CellCallback`, `ComputedOptions`/`SensorOptions`→`DeriveCellOptions`,
  `SensorCallback`→`CellCallback`, `CollectionSource`→`ListSource`,
  `CollectionCallback`→`ListCallback`, `CollectionChanges`→`ListChanges`.
- **Fixed**: entries from PLAN-store-watched-lifecycle and PLAN-list-duplicate-key-hardening
  if those landed (plus anything else in `git log v1.5.0..HEAD` marked `fix:`).
- **Migration**: point at `MIGRATION-2.0.md` and the codemod.

Leave the `## 1.5.0` section and everything below untouched.

### Step 2 — ADR status hygiene

- `adr/0018-...md`: change the Status section to
  `✅ Accepted — 2026-08-17 (implementation CE-001…CE-014 on branch v2/shape-exploration; revision of the same date renamed the narrow shape to Cell and restored the umbrella Signal — see MIGRATION-2.0.md "Second flip").`
  Keep the existing "Amends ADR-0001" line.
- `adr/0001-...md`: its body already says isPending's scope moved; append to its Status
  line: `Amended by [ADR-0018](0018-shape-indexed-signal-types.md) (2026-08-17).`

### Step 3 — Fix the stale passages in `MIGRATION-2.0.md`

Only these — the two `isSignal` sections (≈ lines 53-111) are a historical record per the
CE-008/CE-009 user decisions and must stay byte-identical:

1. **≈ lines 30-35** ("`createList`, `deriveList`, `deriveStore`, `createState`,
   `createMemo`, `createTask`, `Slot`, `Effect`, and `match` keep their names..."):
   rewrite — `createState` keeps its name; `createMemo` becomes `deriveComputed`;
   `createTask`/`createSensor` are removed from the public API (route through `deriveCell`,
   worked examples already exist in the "Second flip" section); delete the
   `createSensor({ watched, ... })` options-shape sentence (that internal form is not
   public in 2.0).
2. **≈ lines 46-47** (smaller-renames table rows `SensorCallback<T>` → `SignalCallback<T>`
   and `ComputedOptions<T>` / `SensorOptions<T>` → `DeriveSignalOptions<T>`): retarget the
   final names — `SensorCallback` → `CellCallback`, `ComputedOptions`/`SensorOptions` →
   `DeriveCellOptions` (per CE-013).
3. **≈ lines 176-177** ("Running the codemod": "It also **flags** every
   `isSignal`/`isMutableSignal` call site"): delete the sentence — CE-004 removed that
   flagging because the umbrella meaning survives into 2.0. The "Second flip" section
   (≈ lines 159-164) already describes the codemod's real behavior; after this edit the two
   sections must agree.
4. **≈ lines 195-199** ("Origin guards": "the shape guards (`isSignal`, `isList`,
   `isStore`)"): replace `isSignal` with `isCell` in that parenthetical and adjust the
   follow-up sentence accordingly (the warning that follows — don't mechanically rewrite
   `isState || isMemo` to `isSignal` — stays valuable).
5. **≈ lines 202-203** ("`createComputed` and `createMutableSignal`. Subsumed in 2.0 by
   `deriveSignal` and `createSignal`"): correct to `deriveCell` and `createCell`. Same for
   the final sentence of the file (≈ line 224, "map to `deriveSignal(input, options?)`").
6. **Status banner (≈ lines 3-5)**: update to reflect ADR-0018 Accepted and that the guide
   now describes the final (Revision) names.

### Step 4 — Bundle re-measurement and re-baseline (the ADR-0018 release gate)

1. `bun run build && bun test test/regression-bundle.test.ts` — record the printed measured
   figures for (a) the tree-shaken core (`createState` + `deriveComputed` + `createEffect`)
   and (b) the full library, minified and gzipped.
2. **Core figure**: must stay ≤ 3072 B gzipped. It is the hard promise (REQUIREMENTS.md,
   ARCHITECTURE.md Key Decisions). CE-011's verification recorded 2080 B — if it regressed
   above 3072 B, STOP: do not raise the limit; fix the regression or escalate to the user.
3. **Full-library figures**: per REQUIREMENTS.md these are a diagnostic re-baselined at
   release with ~25 % headroom. Set the new ceilings in
   `test/regression-bundle.test.ts` to `ceil(measured × 1.25)` and update the two
   diagnostic numbers in `REQUIREMENTS.md` § Bundle Size (currently 29 kB / 10 kB) to the
   new ceilings. Lowering is expected and good; only the core figure is untouchable.
4. `README.md` ≈ line 49 ("the full library is around 8 kB") — replace with the measured
   gzipped full-library figure from this run.
5. Run `bun run regression` — both regression files green.

### Step 5 — REQUIREMENTS.md transition banner

Rewrite the blockquote at ≈ lines 5-14 from "Signal taxonomy is in transition" to a
settled statement: v2.0 implements the ADR-0018 Revision taxonomy; the 1.5.0 bridge names
and 1.5.1 correction are described in MIGRATION-2.0.md. Keep it short (≤ 6 lines). The rest
of REQUIREMENTS.md already describes the target state and needs no other edits.

### Step 6 — Final gates

- `bun run check` (tsc + biome + tests + bundle regression) green.
- `grep -rn "createMemo\|deriveSignal\|createTask\|createSensor\|createSignal" MIGRATION-2.0.md`
  — every remaining hit must be inside a historical section (describing 1.x or the
  intermediate state) or a rename-table left column. No hit may assert a *current* v2 name.
- `grep -n "Proposed" adr/0018-shape-indexed-signal-types.md` — only hits inside the
  historical Context narrative, none in the Status section.
- Mark CE-010 done in `TODO.md` with a `**Changed:**` summary.

Version bump (`2.0.0-next.1` → `2.0.0` in `package.json`), tagging, and `npm publish`
are **out of scope** — this plan ends at "releasable state" and hands the release
mechanics to the maintainer.

## Edge cases a weaker model would miss

1. **CE-010's premise is stale.** Do not go looking for "existing `2.0.0-next` entries" to
   amend — they do not exist; write the section fresh. (`grep -n "2.0.0" CHANGELOG.md`
   currently returns nothing outside `index.ts`-style headers.)
2. **The two `isSignal` sections in MIGRATION-2.0.md are historical records by explicit user
   decision** (CE-008: "left as a historical record"; CE-009: "do not edit the existing
   section"). Their apparently-wrong claims ("in 2.0 it matches only the single-value
   shape") are correct *for the intermediate state they describe*. Fixing them is a
   regression of a decided policy.
3. **`V2_REFACTORING_ANALYSIS.md` is untouchable** — user decision 2026-08-17, recorded in
   CE-008: historical record, left alone despite its 50 stale references.
4. **The core bundle limit is a promise, not a budget.** REQUIREMENTS.md is explicit: if it
   regresses, correct the code or escalate — never the number. The full-library ceilings
   move *down* toward measurement at release; raising either mid-branch is what the document
   calls "what makes it meaningless".
5. **`@since` tags already follow the CE-012 rule** (renames/breaking → `2.0.0`; the four
   1.5.1-exempt guards keep original dates). The CHANGELOG must not contradict them —
   don't write "new in 2.0.0" for `isSignal`/`isMutableSignal`/`Signal`/`MutableSignal`,
   which are corrected continuations, not new APIs.
6. **Don't renumber or rewrite history below `## 1.5.0`** — released sections are immutable.
7. **The 1.5.0 CHANGELOG's Deprecated table says the v2 names for `Collection`-family types
   are "Terminal 2.0 vocabulary — no further rename at the 2.0 boundary"** — the 2.0.0
   section's rename table must stay consistent with that promise (`ListSource`,
   `ListCallback`, `ListChanges`, `PerItemCallback` keep those names in 2.0).
8. **ADR-0018's body contains both the original and the Revision decision.** When flipping
   Status to Accepted, do not "clean up" the body — the Revision trail (Problem 1 et al.)
   is the documented rationale chain reviewers approved.

## Acceptance criteria

- [ ] `CHANGELOG.md` starts with `## 2.0.0` (or `## 1.5.1` above `## 2.0.0` if Step 0
      shipped it), covering Changed/Removed/Renamed/Fixed/Migration; `git diff` shows no
      changes below the former `## 1.5.0` heading.
- [ ] `sed -n '3,7p' adr/0018-shape-indexed-signal-types.md` shows Accepted; ADR-0001's
      Status line names ADR-0018.
- [ ] The five MIGRATION-2.0.md fixes land; the two `isSignal` sections diff-clean
      (`git diff MIGRATION-2.0.md` touches none of ≈ lines 53-111).
- [ ] `bun run regression` green with re-baselined full-library ceilings; measured core
      gzip ≤ 3072 B recorded in the PR/commit message.
- [ ] README's full-library figure matches the measurement output.
- [ ] REQUIREMENTS.md banner no longer says "in transition".
- [ ] `bun run check` green end to end; TODO.md CE-010 checked off.
