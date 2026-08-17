# PLAN: Sync agent-facing documentation to the shipped v2 API

**Priority rank:** 4 of 5.
**Suggested TODO ID:** CE-018 (skill: `tech-writer` for nearly everything; this completes
the CE-014 sweep, which updated the skills' main references but missed the files below).
**Size:** one full-file rewrite (`.github/copilot-instructions.md`, ~280 lines), ~15 small
edits across `.agents/skills/`.
**Baseline at time of writing:** `bun test` 670/670; AGENTS.md and the three shared
references are already v2-clean — this plan fixes what CE-014 missed.

## Goal

Two layers of agent-facing documentation still teach the **pre-ADR-0018 API**:

1. **`.github/copilot-instructions.md` is wrong wholesale.** It presents `createSignal`,
   `deriveSignal`, `createMemo`, `createTask`, `createSensor` as public factories (none are
   exported from `index.ts`), lists a `src/nodes/signal.ts` file that does not exist, claims
   "`isSignal` matches the single-value shape only" (it is the umbrella guard), and lists 6
   of the 11 error classes. Per the project's own tone guide, "code patterns must compile
   against the current `index.ts` — Copilot generates from these literally": every code
   block in that file would fail to compile today. This file is served to every consumer's
   GitHub Copilot.
2. **Scattered stale spots in `.agents/skills/`** survived CE-014: retired `DerivedList`/
   `Collection` vocabulary asserted as fact, workflow anchors pointing at section tags that
   don't exist, a missing error class in `error-classes.md`, one wrong API fact in
   `api-facts.md`, and `tech-writer`'s own model of `AGENTS.md` describing sections that
   were removed.

These files are the instruction layer for every future AI-assisted change to this repo
(and, for Copilot, to consumers' repos) — wrong facts here multiply into wrong code.

## Exact files to touch

| File | Change |
|---|---|
| `.github/copilot-instructions.md` | Full rewrite, modeled on `AGENTS.md` + shared references |
| `.agents/skills/cause-effect-dev/references/internal-types.md` | Fix the `DerivedList`/`Collection` line (≈ line 16) |
| `.agents/skills/shared/references/non-obvious-behaviors.md` | Remove "or DerivedList" phrasing (≈ lines 102, 268) |
| `.agents/skills/shared/references/error-classes.md` | Add `InvalidStoreMutationError`; fix "List/DerivedList" wording (≈ lines 35, 76-77) |
| `.agents/skills/shared/references/api-facts.md` | Fix `itemEquals` claim — List-only, not "lists and stores" (≈ line 78) |
| `.agents/skills/cause-effect/workflows/debug.md` | Fix 5 wrong section anchors (≈ lines 14, 16, 17, 19, 23) |
| `.agents/skills/cause-effect/workflows/use-api.md` | Fix anchors (≈ lines 26, 31) |
| `.agents/skills/cause-effect/SKILL.md` | Fix `deriving_vs_writing` reference (≈ line 24) |
| `.agents/skills/tech-writer/references/ste100-style.md` | Remove `Collection`/`Computed` from the CONTEXT.md-terms list (≈ line 54) |
| `.agents/skills/tech-writer/references/document-map.md` | Fix `src/signal.ts`, `deriveCollection()`, "9 signal types" rows; add RECIPES.md / REACT_INTEGRATION.md coverage (≈ lines 102, 165-166, 212, and the change matrix) |
| `.agents/skills/tech-writer/workflows/update-agent-docs.md`, `consistency-review.md` | Update to current AGENTS.md structure (they reference removed sections "Mental model", "Internal Node Shapes", "Non-Obvious Behaviors") |
| `.agents/skills/adr-keeper/references/adr-index.md` | Verify only (18 ADRs, 0005 superseded — currently accurate) |

## Step-by-step implementation

### Step 1 — Rewrite `.github/copilot-instructions.md`

Model it on `AGENTS.md` (current, 66 lines) and import structure from the shared references.
Required content:

1. **Vocabulary pointer** to `CONTEXT.md` (approved terms + avoid lists).
2. **Construction routing table** — copy verbatim from `AGENTS.md` § Construction Routing
   (`createCell`/`createList`/`createStore`, `deriveCell`/`deriveList`/`deriveStore`,
   sync/async/external-push rows, source-array + item-transform row).
3. **Guards**: `isCell`/`isMutableCell` (single-value shape), `isList`/`isMutableList`,
   `isStore`/`isMutableStore`, `isSlot`, and `isSignal`/`isMutableSignal` as the **umbrella**
   (structural, Cell/List/Store alike). "Anything reactive" → `typeof x?.get === 'function'`.
4. **Key files**: `src/graph.ts` (engine), `src/nodes/cell.ts` (Cell family — **not**
   `signal.ts`), `src/nodes/{state,memo,task,sensor}.ts` (internal single-origin
   factories), `src/nodes/{list,store,effect,slot}.ts`, `src/errors.ts`, `tools/codemod-v2.ts`.
5. **Error classes — all 11**: `CircularDependencyError`, `DuplicateKeyError`,
   `EffectConvergenceError`, `InvalidCallbackError`, `InvalidSignalValueError`,
   `InvalidStoreMutationError`, `NullishSignalValueError`, `PromiseValueError`,
   `ReadonlySignalError`, `RequiredOwnerError`, `UnsetSignalValueError`.
6. **Non-obvious behaviors**: copy the section-tag list from
   `.agents/skills/shared/references/non-obvious-behaviors.md` `<overview>` (12 behaviors)
   rather than restating them.
7. **Tree-shaking constraint**: core trio is `createState` + `deriveComputed` +
   `createEffect`, < 3 kB gzipped; `createTask`/`createSensor` are internal-only, reached
   via `deriveCell`'s dispatch — never import them from consumer code.
8. Any code example must compile against today's `index.ts` export list. Before finishing,
   paste each code block into a scratch `.ts` file and run `bunx tsc --noEmit scratch.ts`
   (with the package self-import), or verify against the exports in `index.ts` line by line.

### Step 2 — Fix the shared-reference stragglers

- `internal-types.md` ≈ line 16 asserts a `DerivedList` (alias `Collection`) internal type
  built on `MemoNode`. Neither name exists anywhere in `src/` (the readonly form is just
  `List`). Replace the line with the `List`/`MutableList` facts.
- `non-obvious-behaviors.md` ≈ lines 102 and 268 say "List or DerivedList source" /
  "`List`/`DerivedList` accessor methods" — drop the `DerivedList` alternative in both.
- `error-classes.md`: add `InvalidStoreMutationError` to the import block (≈ lines 12-23)
  and the table (≈ lines 30-42) — it is the 11th exported class, thrown by the Store proxy
  traps (document the three trigger forms: assign / delete / defineProperty, per ADR-0017).
  Fix the `DuplicateKeyError` rows' "List/DerivedList" wording → "List".
- `api-facts.md` ≈ line 78: `equals`/`itemEquals` — `itemEquals` is a **List** option only;
  `StoreOptions` is `{ watched }` (see `src/nodes/store.ts:52`). Correct the sentence.

### Step 3 — Fix workflow anchors (the files use XML-style `<snake_case_tag>` sections)

Verify every claimed target exists before repointing
(`grep -n '^<' <file>` lists real tags):

| Wrong reference (file:line) | Correct target |
|---|---|
| `debug.md:14` `conditional-reads-delay-watched` | `conditional_reads_delay_watched` in non-obvious-behaviors.md |
| `debug.md:14` `direct-lookups-do-not-track` | `bykey_set_does_not_propagate_to_structural_subscribers` |
| `debug.md:16` `task-abort-on-dependency-change` | `task_abort_on_dependency_change` |
| `debug.md:17` `direct-lookups-do-not-track` | `bykey_set_does_not_propagate_to_structural_subscribers` |
| `debug.md:19` `sensor-unset-before-first-value` | `async_cell_unset_before_first_value` |
| `debug.md:23` `equals-suppresses-subtrees` | `equals_suppresses_subtrees` |
| `use-api.md:26` `direct-lookups-do-not-track` | `bykey_set_does_not_propagate_to_structural_subscribers` |
| `use-api.md:31`, `cause-effect/SKILL.md:24` `deriving_vs_writing` | no such section in signal-types.md — repoint to `construction_matrix` |

### Step 4 — Fix tech-writer's stale self-model

- `update-agent-docs.md` (≈ lines 19-40) and `consistency-review.md` (≈ lines 32-37)
  instruct maintaining/checking AGENTS.md sections "Mental model", "Internal Node Shapes",
  "Non-Obvious Behaviors". The current AGENTS.md has "Construction Routing", "Available
  Skills", "Where the Facts Live" and delegates behaviors to the shared references. Rewrite
  both workflows against the current structure.
- `document-map.md`: ≈ line 102 `deriveCollection()` → `deriveList(source, itemFn)`;
  ≈ lines 165-166 "Spreadsheet-cell mental model for all 9 signal types" → the v2 taxonomy
  (3 shapes × mutability + `Effect` + `Slot`, umbrella `Signal`); ≈ line 212 `src/signal.ts`
  → `src/graph.ts` + `src/nodes/cell.ts`; add `RECIPES.md` and `REACT_INTEGRATION.md`
  rows/columns to the change→document matrix (tech-writer's SKILL.md already owns both
  files; the matrix silently omits them, so a recipe-breaking change has no routing).
- `ste100-style.md` ≈ line 54: `Collection` and `Computed` are not defined in `CONTEXT.md`
  anymore — remove them from that terms list.

### Step 5 — Hygiene

Delete stray `.DS_Store` files under `.agents/skills/` if present on disk (they are not
git-tracked — verified). Do not touch `.mimosa/` (live tool state). Verify
`adr-index.md` still matches `ls adr/*.md | wc -l` = 18 and 0005's superseded status.

### Step 6 — Verification sweep

Run and require zero *unjustified* hits (historical mentions inside MIGRATION-2.0.md,
CHANGELOG.md, and adr/ are fine; so are the codemod's own rename tables in `tools/`):

```sh
grep -rn "DerivedList\|deriveCollection\|createCollection" .agents/skills/ .github/
grep -rn "createSignal\|deriveSignal\|createMemo" .agents/skills/ .github/ | grep -v "MIGRATION\|CHANGELOG\|rename\|→\|->"
grep -rn "signal\.ts" .agents/skills/ .github/
```

Then run tech-writer's own `consistency-review.md` workflow over the changed files and
resolve what it flags.

## Edge cases a weaker model would miss

1. **Guardrail from CE-014, still binding**: `isSignal`/`isMutableSignal` keep their
   umbrella meaning — never "fix" them into narrow guards. `createState`/`deriveComputed`
   still exist publicly. `createTask`/`createSensor` are internal-but-real (describe them
   as internal dispatch targets, not as removed).
2. **`ItemSignalOptions` in `list.ts` is correctly umbrella-named** (an item signal may be
   Cell-, Store-, or List-shaped per CE-011). Don't flag it as stale.
3. **The section tags are XML-style with underscores** (`<conditional_reads_delay_watched>`),
   and several wrong references use hyphens — the fix is repointing, not renaming the
   target sections. Never edit `non-obvious-behaviors.md`'s tag names: other files and
   AGENTS.md reference them.
4. **error-classes.md documents exact error messages.** If PLAN-error-surface-hardening has
   already run (it changes several messages), sync the new messages here; if it hasn't,
   note in the PR that its Step list includes re-syncing this file. Run this plan *before*
   that one to minimize churn.
5. **copilot-instructions.md is for consumers' repos, not just this repo** — keep it
   self-contained (no references into `.agents/skills/`, which don't ship) while
   `AGENTS.md` may reference them.
6. **Don't "fix" historical sections.** MIGRATION-2.0.md's stale passages are
   PLAN-v2-release-readiness's scope (with different rules about what stays historical);
   CHANGELOG.md and `adr/` are immutable records.
7. **`document-map.md`'s change matrix omitting RECIPES/REACT_INTEGRATION is a real routing
   bug** (a change that breaks a recipe currently has no documented path), not just a
   formatting gap — add both columns and a row example.

## Acceptance criteria

- [ ] Every code block in `.github/copilot-instructions.md` compiles against `index.ts`
      (self-verified via a scratch file or line-by-line export check); the file names all
      11 error classes, lists `src/nodes/cell.ts` (not `signal.ts`), and its construction
      matrix matches `AGENTS.md`'s exactly.
- [ ] The three Step 6 greps return only enumerated historical/codemod hits; enumerate them
      in the PR description.
- [ ] `grep -rn '^<' .agents/skills/shared/references/non-obvious-behaviors.md` still lists
      the same 12 section tags as before your changes (only prose inside changed).
- [ ] `error-classes.md` lists 11 classes; `InvalidStoreMutationError` row names the three
      proxy traps and `ADR-0017`.
- [ ] tech-writer's `consistency-review.md` workflow, run over the repo, reports no stale
      sections in AGENTS.md-related workflows.
- [ ] `bun run check` still green (this plan must not touch `src/`; if you find yourself
      editing source files, stop — that's another plan's scope).
