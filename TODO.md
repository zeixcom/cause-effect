# TODO

Backport queue for branch `bugfix/backport-signal-meaning-flip-and-fixes` (targets release 1.5.1, on
top of 1.5.0). IDs continue from the `v2/shape-exploration` queue (CE-001–CE-024) so task IDs stay
unique across branches. Source commits on `v2/shape-exploration`: the meaning flip is `e4408f6`
(ADR-0018 Revision 2026-08-17), the correctness fixes are `c48171b` (v2 CE-015 and CE-016). Port
logic and semantics, not line-level diffs — v2's source has diverged through the taxonomy rename.

- [x] CE-025: Fix `deriveStore` watched lifecycle for property-only reads — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/store.ts` (lifecycle anchor in `deriveStore`'s external-push branch),
  `src/graph.ts` (export `type SourceNode`), `test/derive-store.test.ts` (7 ported tests).
  **How:** Ported v2 `c48171b` (CE-015): eager `createStore(input)`, an anchor `SourceNode`
  carrying watcher edges without propagating, `subscribe()` in all three facade accessors so
  property-only reads (`store.prop.get()`, `byKey()`, `in`) activate `watched`. Reproduced first
  (7 failing tests), then fixed; full suite green.

- [x] CE-026: Harden List/deriveList duplicate-key and nullish validation — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (init-loop duplicate check; `splice()` staged validation with
  nullish-before-`generateKey`), `src/nodes/collection.ts` (`createCollection` seed duplicate
  check — covers `deriveList` external-push), `test/list.test.ts`, `test/derive-list.test.ts`
  (4 ported tests).
  **How:** Ported v2 `c48171b` (CE-016) stage-and-validate semantics only; did not transplant
  v2's keys-ordering refactor. Reproduced first (4 failing tests), then fixed; full suite green.

- [x] CE-027: Flip the single-value bridge vocabulary to `Cell` — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/signal.ts`, `index.ts`, regenerated `index.js`/`types/`,
  `test/signal.test.ts`, `test/v2-transition.test.ts`, `test/util.test.ts` (comment).
  **How:** `deriveCell` is the canonical dispatcher (the old `deriveSignal` implementation);
  `deriveSignal` and `DeriveSignalOptions` are deprecated aliases of
  `deriveCell`/`DeriveCellOptions` (removed in 2.0). `createCell(value, options?)` is an alias
  of `createState` — the single-value mutable signal, value verbatim, no shape conversion
  (matching v2's narrow `createCell`; maintainer decision). `createSignal` keeps its shape
  dispatch **unchanged** — 2.0 removes the dispatch with no single replacement. `Signal<T>`/
  `isSignal`/`isMutableSignal` untouched. `@since 1.5.1` on the new names; no `Cell` types or
  `isCell` guards in 1.x.
  **Review:** Approved. Alias shapes are terminal (no meaning flips at the 2.0 boundary);
  backward compatibility per REQUIREMENTS.md holds (nothing removed, `createSignal`
  untouched); emitted `.d.ts` preserves overloads through the `deriveSignal` const alias;
  deprecation JSDoc all point at terminal names. Follow-ups folded into CE-030: CONTEXT.md
  must drop "cell" from its _Avoid_ lists (it now names the v2 shape arriving via bridge
  names), and REQUIREMENTS.md's banner and construction matrix still teach
  `createSignal(value)`/`deriveSignal(fn)`.

- [x] CE-028: Retarget the v2 codemod at the `Cell` bridge names — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `tools/codemod-v2.ts`, `test/codemod-v2.test.ts` (7 new tests).
  **How:** Blanket renames `deriveSignal`→`deriveCell`, `DeriveSignalOptions`→`DeriveCellOptions`,
  `createComputed`→`deriveCell` (same dispatch; flagged hint for the async case where the
  deprecated `Task` methods `.isPending()`/`.abort()` become the free functions).
  `createComputed` literal options get `value:`→`initial:` rewritten; non-literal options are
  flagged. `createMutableSignal` calls are rewritten by literal argument shape
  (`createCell`/`createList`/`createStore`) and flagged when non-literal — a blanket rename
  would silently change array/record sites now that `createCell` is narrow. `createSignal` is
  always flagged, never rewritten. Import syncing updated.

- [x] CE-029: Port the revised ADR-0018 and the ADR-0015 clarification — done ✓
  **Skill:** adr-keeper
  **Changed:** `adr/0018-shape-indexed-signal-types.md` (replaced with the Revision wording from
  `v2/shape-exploration`; only the Status line adapted), `adr/0015-composite-lookup-methods-
  track-structural-changes.md` (appended the "Clarification (added 2026-08, external-push
  Stores)" section, verbatim from v2 `c48171b`).
  **How:** ADR-0018's Status now records that the only *released* narrow-`Signal` vocabulary is
  the 1.5.0 bridge factory `deriveSignal` (deprecated 1.5.1 in favor of `deriveCell`), and that
  `createSignal`'s shape dispatch is unrelated to the flip. The Status-line reference to
  MIGRATION-2.0.md's flip section resolves when CE-030 lands. ADR index unchanged (status stays
  Accepted).

- [ ] CE-030: Sync user-facing docs to the Cell bridge names and the fixes
  **Skill:** tech-writer
  **Context:** After CE-025–CE-028, update docs that still teach the superseded vocabulary or
  omit the fixes, keeping CONTEXT.md approved terms and ste100-style. `MIGRATION-2.0.md`: repoint
  the bridge-table entries `createComputed` → `deriveCell` and `createMutableSignal` →
  `createCell`/`createList`/`createStore`, and add a short section (the 1.x analogue of v2's
  "Second flip") explaining that 1.5.0 shipped `deriveSignal` for one release and 1.5.1 renames
  it to the terminal `deriveCell`; document the codemod's new single-value behavior including the
  `createSignal` flag. `README.md` and `GUIDE.md`: update `deriveSignal` examples to `deriveCell`
  (`createSignal` examples stay — its dispatch is unchanged until 2.0).
  `REQUIREMENTS.md`: the transition banner and the "Construction Covers Every Cell" matrix still
  name `createSignal(value)`/`deriveSignal(fn)` as the v2 target — update both to the Revision
  vocabulary (`createCell`/`deriveCell`), noting the matrix's mutable single-value cell is
  `createCell` (narrow) while 1.x keeps `createSignal`'s wider dispatch until 2.0.
  `CONTEXT.md`: "cell" is currently in the _Avoid_ lists under **Signal** and **Signal Node** —
  it now names the v2 single-value shape arriving via the `createCell`/`deriveCell` bridge
  names, so remove it from both _Avoid_ lists and add the bridge-name terms (Cell factory
  family) to the vocabulary. Verify ARCHITECTURE.md's
  Store anchor paragraph and the two backport Key Decisions rows match what shipped. Port the
  `<watched_activation_is_shape_wide>` entry from v2 commit `c48171b` into
  `.agents/skills/shared/references/non-obvious-behaviors.md`, adapting vocabulary to 1.x (no
  `Cell` types in 1.x — single-value signals keep their 1.x names).

- [ ] CE-031: Prepare the 1.5.1 changelog
  **Skill:** changelog-keeper
  **Context:** After CE-025–CE-030, add a 1.5.1 section to `CHANGELOG.md` covering all three
  backports, citing `v2/shape-exploration` commits `e4408f6` and `c48171b` as origins. Fixed:
  `deriveStore(seed, { watched })` frozen at seed under property-only reads (lifecycle anchor,
  ADR-0015 clarification); inconsistent duplicate-key/nullish validation in `createList`/
  `deriveList` seeds and `splice()` half-applies (staged validation). Added: `createCell` (alias
  of `createState`, terminal v2 name) and `deriveCell`/`DeriveCellOptions` (terminal bridge for
  `createComputed`). Deprecated: `deriveSignal`/`DeriveSignalOptions` in favor of the Cell names,
  removed in 2.0. Mention the codemod retarget and the MIGRATION-2.0.md flip section.
