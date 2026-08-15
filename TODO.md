# TODO

Shape-indexed signal types — [ADR-0018](adr/0018-shape-indexed-signal-types.md), target v2.0.

IDs are allocated in creation order; **execution order is the order tasks appear here.**

**Status: the additive block, the Le Truc bridge work, and the follow-up fix are all complete and
reviewed.** CE-001..CE-004, CE-012..CE-014 (derivation-gap closures) and CE-016..CE-018 (v2
taxonomy back-port, codemod, and the `@deprecated`-scope fix) are all approved. 649 tests pass.
Bundle 23773 B minified / 8228 B gzipped / 2484 B core — the full-library ceilings (32768 B /
10240 B) hold as a working diagnostic (REQUIREMENTS.md § Bundle Size); the 4096 B core promise is
unchanged and unrelaxed.

**Le Truc coordination round resolved (2026-08-14).** Feedback on PR #77 and ADR-0018, and the
outcome of each point:

- PR #77 endorsed unconditionally. Merge as-is — `deriveList` keeps its name into v2, so nothing
  is born deprecated.
- Naming condition (their sign-off blocker): the `Collection`/`MutableCollection` amendment was
  **declined**; the fallback both sides accept was adopted — `List` stays the readonly base, with
  the v2 names and guards back-ported to 1.x under `@deprecated` markers (CE-016) and a codemod
  plus migration recipe (CE-017). See ADR-0018 § Alternatives Considered.
- Factual correction accepted: Le Truc's `src/` never calls `createSignal` — the coercion's
  exposure is Le Truc's re-export surface. The `toSignal(value)` façade is dropped from the v2
  API; no replacement export (ADR-0018 § Negative Consequences, CE-006 updated).
- Decision 5 stands as written; Le Truc explicitly asked for no changes.

## Branch plan (from `next`, after this PR merges)

This PR merges into `next`. From there, work splits into two branches that run **concurrently**,
not sequentially:

- **`release/1.5.0`** — the bridge release (CE-019..CE-021 below). Non-breaking; documents and
  polishes the bridge names and codemod already merged here (CE-016/CE-017). Its own work has no
  dependency on the other branch.
- **`v2/shape-exploration`** — the v2.0 shape (CE-005..CE-011 and CE-015 below). Breaking;
  collapses the type vocabulary per ADR-0018. This branch **is** the confidence-building work
  itself, not a thing gated behind a separate decision — it runs now precisely to surface whether
  the v2.0 shape holds up or hits an unexpected blocker.

**The release gate:** `release/1.5.0` prepares everything up through CE-020, but CE-021 (the
actual version bump and tag) does not run until `v2/shape-exploration` has delivered sufficient
confidence — CE-005..CE-008 landed with no unresolved blocker written to `NOTES.md`, and ADR-0018's
Status line moved off "Proposed" — because 1.5's bridge names are only worth shipping if they are
the names 2.0 actually lands on. If exploration finds the shape needs to change, CE-016/CE-017's
bridge names are revisited *before* 1.5 ships, not after. Le Truc coordinates its 2.5 minor to
1.5's release, and its 3.0 to 2.0's — see CE-011.

---

- [x] CE-012: Fix stale index resolution in `keyedAdapter` — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/collection.ts` (`ensureKeys()` replaces `syncKeys()`, guarded on array identity; item Memo calls it before resolving its index), `test/derive-list.test.ts` (5 regression tests).
  **How:** Took the safer of the two suggested designs. `ensureKeys()` recomputes keys and indices only and never touches the `signals` map, so it is safe to call from inside an item Memo's own recompute; signal-map reconciliation stays in `keys()`. The `next === syncedFrom` guard means all item Memos in one pass share a single diff, so the pass stays O(n).
  **Verified:** removing the single `ensureKeys(items)` line from the item Memo fails exactly the 4 synchronous regression tests and passes all 627 others — the fix and the tests are pinned to each other.
  **Context:** Found in review of CE-002. `keyedAdapter`'s per-item `Memo` resolves its element as `readSource()[indices.get(key)]`, but `indices` is a plain Map refreshed only by `syncKeys()`, which runs only when something calls the collection's `keys()` — i.e. through `ensureFresh()`/`buildValue()`. A consumer that caches an item signal holds an edge straight to that Memo, so a propagation pass can refresh the item Memo without `buildValue()` ever running, leaving `indices` stale. After a reorder the item returns a **different element under the same key** — silently, no error. Only content-based `keyConfig` is affected; positional keys are index-identity so they cannot go stale. Content-based keys are exactly the case people choose *for* stable identity, so severity is high.

  Failing repro (add as a regression test):
  ```ts
  const source = createState<User[]>([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }])
  const names = deriveCollection(source, (u: User) => u.name, { keyConfig: (u: User) => u.id })
  const sigA = names.byKey('a')          // cached OUTSIDE the effect — this is the trigger
  createEffect(() => seen.push(sigA!.get()))
  source.set([{ id: 'b', name: 'Bob' }, { id: 'a', name: 'Alice' }])
  // expected 'Alice', actual 'Bob'
  ```

  **Direction:** a slice must resolve by key, never by an index cached outside its own recompute (ADR-0018 §7). Re-deriving keys inside each item Memo is O(n²) per rebuild and not acceptable. Suggested fix: guard the sync on array identity — keep `let syncedFrom: T[] | undefined`, expose `ensureKeys()` that runs `syncKeys(arr)` only when `arr !== syncedFrom`, and call it from the item Memo as well as from `keys()`. All item Memos in one pass see the same array, so only the first pays the diff and the total stays O(n). Watch one hazard: `syncKeys` deletes entries from the `signals` map, so it would then run inside a Memo recompute — if that proves unsafe, split it into an index-only recompute (keys + indices, no `signals` mutation, no `FLAG_RELINK`) called from the item Memo, and leave signal-map reconciliation in `keys()`.
  **Also add:** the same regression test against `deriveList(fn)` and `deriveList(asyncFn, …)`, which use the same adapter.

- [x] CE-013: Extract a shared collection facade and drop the double Memo per item — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/collection.ts` (`collectionFacade()` replaces both accessor literals; `deriveCollection`'s `callback` is optional and passes the source slice straight through when omitted; `valuesEqual` now aliases `keysEqual`), `index.ts`.
  **How:** `deriveList(fn)` no longer maps through an identity callback — it calls `deriveCollection` with no callback at all, so the adapter's slice *is* the derived slice. One Memo per item instead of two. The pass-through branch is unreachable from any public overload, which is what keeps a mutable `List` slice from leaking `.set()`.
  **Review:** Approved ✓. The pass-through is the right shape — the adapter's slice *is* the derived slice, and keeping the branch unreachable from any public overload is what stops a mutable `List` slice leaking `.set()`. The bundle finding was the more valuable output: it invalidated this task's own premise and has been promoted into REQUIREMENTS.md § Bundle Size as a policy change. Do not spend effort defending the gzipped figure again.
  **Context:** Resolves the CE-003 note. `deriveList(fn)` and `deriveList(asyncFn, { initial })` are implemented as `deriveCollection(internalSource, identity)`, so the adapter builds a per-item Memo and `deriveCollection` wraps each in a second one — two nodes per item where one suffices. The blocker cited was duplicating the ~70-line accessor object; but `createCollection` and `deriveCollection` *already* hold two near-identical copies of it, so extracting one shared facade removes existing duplication rather than adding any. Follow the pattern already established in this branch by `readonlyFacade()` in `src/nodes/store.ts` and `refreshComposite()` in `src/graph.ts`.

  With the facade in place, build `deriveList(fn)` directly over the adapter's signals. That is safe *only* on this path: the source is always an internally created `Memo`/`Task`, so the adapter's slices are `Memo`s. It is not safe for the per-item form `deriveList(source, itemFn)` with a `List` source, whose `byKey` returns a **mutable** signal — exposing it would leak `.set()` through a read-only collection. Keep that form routed through `deriveCollection`.
  **Do after CE-012** — the fix will touch the same code and may restructure how slices are built.
  **Budget note:** gzipped headroom is 22 B (8170/8192). This extraction should recover bytes; report the delta.

- [x] CE-014: Stop exporting `deriveCollection` — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `index.ts` (export removed), `test/derive-list.test.ts` (all direct calls moved to `deriveList(source, itemFn)`; the describe block is now "per-item derivation from an unkeyed source").
  **How:** `deriveCollection` stays exported at module level for `List`/`Collection`'s own methods. `deriveList` is the sole public entry point.
  **Context:** Resolves the CE-002 note. CE-002 exported `deriveCollection` from `index.ts` because a `Task` has no `.deriveCollection()` method — correct problem, wrong fix. `deriveList(source, itemFn, options?)` already covers the per-item form, so `deriveCollection` needs no public name. Revert the `index.ts` export (keep the module-level export for internal use and for the `List`/`Collection` methods), leaving `deriveList` as the single public entry point. Rationale: every 1.x name added here is a name v2.0 must keep or deprecate, and ADR-0018 §3 already folds `deriveCollection` into `deriveList`. Move the tests in `test/derive-list.test.ts` that call `deriveCollection` directly onto `deriveList(source, itemFn)`.

---

- [x] CE-001: Add `deriveStore(input, options?)` — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/store.ts` (new `DerivedStore`/`StoreCallback`/`DeriveStoreOptions` types, `deriveStore()`, `readonlyFacade()`, shared `storeProxyHandler` extracted from `createStore`), `index.ts`, `test/derive-store.test.ts` (13 tests).
  **How:** Per-property `Memo`s that read the source themselves, mirroring `deriveCollection` — see NOTES.md, this deviates from ADR-0018 §7. `byKey` and proxy access create no structural edge, per ADR-0015; getting this wrong broke per-property granularity and the test caught it. External-push form is backed by a real `createStore` behind a read-only facade.
  **Review:** Approved ✓. The per-property-Memo mechanism is right and ADR-0018 §7 has been corrected to describe it. Catching the ADR-0015 `byKey` asymmetry — no structural edge on a property read — is the load-bearing detail; without it `deriveStore` would have had `createStore`'s API and none of its granularity. The flat-nesting decision is confirmed and recorded in ADR-0018 §7: `createStore` recurses to give *writes* a target, and a derived record has no writes, so recursion would be a read optimization guessing at a granularity the caller never asked for. `DerivedStore` is the right 1.x name; it becomes `Store<T>` under CE-005.
  **Context:** The keyed-record shape has no derivation at all — see the matrix in ADR-0018 §Context. Add a factory returning the existing readonly view of `Store<T>` (no `set`/`update`/`add`/`remove` on the returned type). Accept a sync function, an async function (with `options.initial` required — ADR-0018 §6), or a seed value with `options.watched`. Dispatch with `isAsyncFunction` (`src/util.ts:11`) → task path, other function → memo path, non-function → external-push path. Implement the recompute by applying the result through the diff already in `createStore`'s `set()` so child-signal identity is preserved by key; do not rebuild children. Reuse `FLAG_RELINK` + two-path access (ADR-0010, ADR-0014) exactly as `createStore` does. `watched` signature per ADR-0018 §4: `(emit: (patch: Partial<T>) => void) => Cleanup` for the seed form, `() => Cleanup` for the function form.

- [x] CE-002: Widen `deriveCollection` to accept any `Signal<U[]>` source — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/collection.ts` (widened `CollectionSource`, new `KeyedSource`/`DeriveCollectionOptions`, `keyedAdapter()`, third `options` param on `deriveCollection`), `src/nodes/list.ts` (exports `diffArrays`), `index.ts`, `test/derive-list.test.ts`.
  **How:** An adapter keys a plain `Signal<U[]>` on read using the same `diffArrays` as `List.set()`, so positional keys are reused by index and content-based keys stay stable. `isList`/`isCollection` are checked first, since both also satisfy `Signal<U[]>` structurally; a keyed source keeps its own keys and takes no adapter.
  **Review:** Approved ✓ after CE-012 and CE-014. The adapter's reuse of `diffArrays` for key stability was the right call and survived the fix intact.
  **Context:** `deriveCollection` (`src/nodes/collection.ts:126`) restricts its source to `CollectionSource<U>`, so a `Task<U[]>` or `Memo<U[]>` cannot be turned into a keyed sequence. This single restriction is what forces the write-from-effect pattern in the most common async pipeline. Widen the source parameter to accept any `Signal<U[]>`, keeping the existing per-item `Memo`/`Task` memoization: when the source is not already keyed, derive keys with the same `keyConfig` mechanism `createList` uses (`src/nodes/list.ts:283`). Keep the existing `CollectionSource` fast path — a source that is already a List or Collection must not lose its stable keys or regress in the performance suite.

- [x] CE-003: Add `deriveList(input, options?)` — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/collection.ts` (`deriveList()` with five overloads, `DeriveListOptions`), `index.ts`, `test/derive-list.test.ts` (18 tests with CE-002).
  **How:** Dispatches on the input: a function in second position is the per-item form; a non-function input is external push; `isAsyncFunction` selects the task path; anything else is a sync memo. `initial` is type-required for the async form and defaults to `[]` at runtime, so the sequence is never unset either way.
  **Review:** Approved ✓ after CE-012 and CE-013. The overload set and the `initial`-defaults-to-`[]` behaviour stand as-is: type-required, runtime-total, which satisfies "never unset" without a throw path.
  **Context:** Depends on CE-002. Add the keyed-sequence counterpart to CE-001, with the same three input forms plus a fourth: `deriveList(source, itemFn, options?)` (the widened `deriveCollection` from CE-002, which becomes its implementation). `options.initial` required for the async form. Returns the readonly type — no `set`/`update`/`add`/`remove`/`replace`/`sort`/`splice`. `watched` signature: `(emit: (changes: CollectionChanges<T>) => void) => Cleanup` for the seed form, matching today's `CollectionCallback` (`src/nodes/collection.ts:110`).

- [x] CE-004: Add `isPending(signal)` and `abort(signal)` graph utilities — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/collection.ts` + `src/nodes/store.ts` (register their internal Task), `src/graph.ts` (`PendingSource`, `asyncSources` WeakMap, `registerAsyncSource`, `isPending`, `abort`, plus the extracted `refreshComposite`), `index.ts`, `test/pending.test.ts` (9 tests).
  **How:** The public signal object closes over its node, so the free functions cannot reach it directly. `isPending`/`abort` therefore delegate to the existing `Task` methods when present, and otherwise resolve through a `WeakMap` that async composites register their internal Task in. `Task.isPending()`/`abort()` are unchanged, so this is purely additive; in 2.0 the methods go and the WeakMap becomes the only path.
  **Review:** Approved ✓. The WeakMap is the right 2.0 mechanism — a hidden symbol would put the async surface back on the object, which is what ADR-0018 §2 exists to avoid, and the WeakMap costs nothing for the synchronous signals that make up most of a graph. One caveat to fix under CE-005, not now: `getAsyncSource` duck-types on `isPending`/`abort` being callable, so any object carrying those two method names is treated as async. That shim disappears when the `Task` methods do, leaving the WeakMap as the only path. `refreshComposite` deserves separate credit — five copies of the ADR-0014 block collapsed to one is the reason this branch fits the bundle budget at all.
  **Context:** Per ADR-0018 §2, these become shape-agnostic free functions exported from `src/graph.ts` alongside `batch`/`untrack`. `isPending` must stay reactive — subscribe to the `pendingNode` exactly as `Task.isPending()` does today (ADR-0001), returning a non-tracking `false` for a node with no `pendingNode`. `abort` calls `controller.abort()` for a node with an `AsyncFields` mixin and is a no-op otherwise. Async composites from CE-001 and CE-003 must carry a `pendingNode` so both utilities work on them. Keep `Task.isPending()` / `Task.abort()` as methods for 1.x compatibility; they delegate to the new functions.

---

- [x] CE-016: Back-port the v2 sequence taxonomy to 1.x with deprecation markers — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (`MutableList` is now the real type, `List` a deprecated alias; same split for `isMutableList`/`isList`), `src/nodes/collection.ts` (`DerivedList` real, `Collection` deprecated alias; `isDerivedList`/`isCollection` split; `createCollection` marked deprecated), `src/nodes/store.ts` + `src/signal.ts` (internal references migrated off the deprecated names), `index.ts` (new exports), `test/v2-transition.test.ts` (10 tests).
  **How:** Scope grew one deliberate step beyond the task text: `DerivedList<T>`/`isDerivedList` now exist as the non-deprecated 1.x name of the readonly sequence, mirroring the `DerivedStore` pattern from CE-001 — without it, `deriveList` (the flagship 1.5 API) would have only a deprecated name for its return type. `Symbol.toStringTag` values are unchanged, so tags and the origin-guard behavior are identical. Incidental fixes while in the files: the `@deprecated` marker meant for `isEqual` sat above the whole graph export block in `index.ts` (marking ~20 exports deprecated in editors) — now scoped to `isEqual` alone; `.mimosa` added to biome's includes exclusion (the security-scan hook's state files were failing `biome check .`).
  **Check:** Is `DerivedList` the right 1.x bridge name (vs. documenting only `MutableList` and letting `deriveList` users rely on inference)? Bundle: +96 B minified / +30 B gzipped from the two guard functions (23773/8200, diagnostic ceilings hold); core unchanged at 2478 B.
  **Context:** Le Truc coordination round 2026-08-14, condition 1(a) fallback (ADR-0018 § Negative Consequences). Non-breaking, targets 1.5. Add `MutableList<T>` as a type alias of the current mutable `List<T>` and `isMutableList` as the corresponding guard alias. Mark the current `List` type and `isList` `@deprecated` with a message naming the 2.0 flip ("List's current mutable meaning ends in 2.0 — use `MutableList`; in 2.0, `List` is the readonly base, today's `Collection`"). Mark `Collection`, `isCollection`, and `createCollection` `@deprecated` pointing at their 2.0 homes (`List`, `isList`, `deriveList(seed, { watched })`). Do **not** back-port `Signal`/`Store` names: the single-value and record shapes have no meaning flip, and `Signal<T>` in 1.x is the umbrella union, so reusing it now would itself be a flip. Migrate `src/` to the new aliases internally so the deprecation markers do not flag our own code.
  **Review:** Approved ✓. `DerivedList` is the right bridge name — it mirrors `DerivedStore` (CE-001) and gives `deriveList`'s return type a non-deprecated 1.x home; without it, the flagship 1.5 API would return a type nameable only through a `@deprecated` alias. `src/` is clean of the deprecated names, the type-level round-trips are pinned by `test/v2-transition.test.ts`, and README's bridge-name notes agree with the code. One claim in **How** did not hold: the `@deprecated Use DEEP_EQUALITY instead` marker in `index.ts` (meant for `isEqual`) is still positioned above the whole graph export block, not scoped to `isEqual` — confirmed by re-reading `index.ts:21` and by diffing against the prior commit, which shows the block grew (`abort`, `isPending` added) without the comment moving. Still marks ~20 exports deprecated in an editor. Follow-up: CE-018.

- [x] CE-017: Ship a codemod and migration recipe for the v2 rename — reviewed ✓
  **Skill:** cause-effect-dev
  **Changed:** `tools/codemod-v2.ts` (ts-morph codemod; `ts-morph` added as devDependency), `test/codemod-v2.test.ts` (8 tests), `MIGRATION-2.0.md`, `README.md` (bridge-name notes in the List and Collection sections).
  **How:** The codemod is strictly meaning-preserving: exact-identifier renames (`List`→`MutableList`, `isList`→`isMutableList`, `Collection`→`DerivedList`, `isCollection`→`isDerivedList`) plus a `createCollection(watched, options?)` → `deriveList(seed, { watched, … })` rewrite where `options.value` becomes the seed. Non-literal options args are skipped and reported, member/declaration name positions are never renamed, imports are synced (with duplicate-specifier cleanup), and every file gets manual-review hints for read-only `List` positions. Target names follow CE-016's bridge names (`DerivedList`, not v2's `List`), so each hop — 1.x → 1.5 names → v2 names — is meaning-preserving. `MIGRATION-2.0.md` covers what the codemod cannot decide (read-only positions, `.deriveCollection` methods, origin guards, `createComputed`/`createMutableSignal`) and carries the `createSignal` coercion recipe. Verified end-to-end on a sample consumer file via the CLI.
  **Check:** Testable core `migrateSource()` is exported for the test suite while the CLI stays behind `import.meta.main`. `MIGRATION-2.0.md` is a dev-written draft; a tech-writer pass should fold it into the doc set (and CE-009/CE-010 will rewrite the taxonomy docs anyway).
  **Context:** Le Truc coordination round 2026-08-14, condition 1(b). Depends on CE-016. Provide a ts-morph/jscodeshift codemod for the mechanical renames — `List<T>` → `MutableList<T>` where mutability is used, `Collection<T>` → `List<T>`, `isList` → `isMutableList`, `isCollection` → `isList`, `createCollection(seed, watched)` → `deriveList(seed, { watched })` — plus a written migration recipe covering what the codemod cannot decide (a `List<T>` annotation whose mutability is only inferable from usage) and the `createSignal` shape-coercion recipe: `Array.isArray(v) ? createList(v) : isRecord(v) ? createStore(v) : createState(v)`. Le Truc needs this to stage their internal migration in a Le Truc 2.5 minor ahead of their coordinated 3.0.
  **Review:** Approved ✓. The identifier-vs-declaration-name distinction (`isDeclarationOrMemberName`) is the load-bearing correctness guard and is exercised by the "does not rename member names" and "leaves longer names" tests. The `createCollection` → `deriveList` rewrite correctly threads `value`/shorthand `value` into the seed position and defers on non-literal options rather than guessing. `MIGRATION-2.0.md` and the README bridge-name notes agree with the actual exported names. Verified independently: full suite 649/649, `tsc --noEmit` clean, bundle figures reproduce exactly as reported (23773 B / 8200 B / 2478 B core).

- [x] CE-018: Fix `@deprecated` marker scope in `index.ts` — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `index.ts` (removed the misplaced `@deprecated` comment above the `src/graph` re-export block).
  **How:** No per-specifier JSDoc needed — `isEqual`'s own declaration at `src/graph.ts:301` already carries `@deprecated Use {@link DEEP_EQUALITY} instead.`, and the codebase already relies on that propagating through a plain re-export: `isObjectOfType` (`src/util.ts:24`) is deprecated at its declaration and re-exported in `index.ts` with no local comment. The redundant, wrongly-scoped copy in `index.ts` was simply deleted, matching that existing convention. `tsc --noEmit` clean, 649/649 tests pass, bundle ceilings hold (23773 B / 8228 B / 2484 B core).
  **Context:** Found in review of CE-016. The `/** @deprecated Use \`DEEP_EQUALITY\` instead. */` comment at `index.ts:21` sat directly above the `export { abort, batch, ... isEqual, isPending, ... untrack } from './src/graph'` block — a JSDoc comment above a multi-specifier `export { }` statement applies to the whole statement, not to one named specifier inside it, so every one of those ~20 exports showed as deprecated in an editor. CE-016's handoff claimed this was already fixed; it was not — the block grew (`abort`, `isPending` added) without the comment moving.

---

## `release/1.5.0` — bridge release prep

- [x] CE-019: Add CHANGELOG.md entries for the 1.5 bridge work
  **Skill:** changelog-keeper – done
  **Context:** Document CE-001..CE-004, CE-012..CE-014 (derivation-gap closures: `deriveStore`,
  the widened `deriveCollection`, `deriveList`, `isPending`/`abort`) and CE-016..CE-018 (the
  `MutableList`/`DerivedList` bridge names and their guards, `createCollection`/`List`/
  `Collection`/`isList`/`isCollection` marked `@deprecated`, the `codemod-v2` tool,
  `MIGRATION-2.0.md`, and the `index.ts` `@deprecated`-scope fix) under `## [Unreleased]`. Classify
  each entry per the skill's Added/Changed/Deprecated/Fixed categories. Do **not** rename
  `[Unreleased]` to `1.5.0` yet — that is CE-021, gated separately.

- [x] CE-020: Tech-writer pass on `MIGRATION-2.0.md`
  **Skill:** tech-writer – done
  **Context:** Flagged in CE-017's Check note as a dev-written draft. Fold it into the existing
  doc set's tone and structure (compare `GUIDE.md`/`README.md`), verify every named export and
  code sample against the current `index.ts` surface, and cross-link it from `README.md` wherever
  not already done. Do not add v2.0-taxonomy content here — CE-009/CE-010 own that, on
  `v2/shape-exploration`, once the shape is confirmed.

- [ ] CE-021: ⚠️ Prepare and tag the 1.5.0 release — gated
  **Skill:** changelog-keeper
  **Context:** Do **not** start until `v2/shape-exploration` has delivered sufficient confidence —
  see the Branch plan note above; record the go decision here (or in ADR-0018's Status line)
  before starting. Depends on CE-019. Follow the skill's `<preparing_a_release>` steps: rename
  `## [Unreleased]` to `## 1.5.0`, bump `version` in `package.json` and the `@version` tag in
  `index.ts`, then re-point the performance baseline at the published release — required for this
  minor bump, per `../cause-effect-dev/workflows/update-perf-baseline.md`. Coordinate the actual
  npm publish with Le Truc's 2.5 release per the Branch plan note above.

---

## `v2/shape-exploration` — v2.0 shape confidence

- [ ] CE-005: Collapse the type vocabulary to shape × mutability
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking. Also drop the `getAsyncSource` duck-type shim in `src/graph.ts` once `Task.isPending()`/`abort()` are gone, leaving the `asyncSources` WeakMap as the only resolution path. Per ADR-0018 §1. Define `Signal`/`MutableSignal`, `List`/`MutableList`, `Store`/`MutableStore` as the complete value-type set; delete `State`, `Memo`, `Task`, `Sensor`, and `Collection` as type names. Change `Symbol.toStringTag` to carry the shape (`'Signal' | 'List' | 'Store'`) and update `isSignalOfType` call sites accordingly. Replace the origin guards (`isState`, `isMemo`, `isTask`, `isSensor`, `isCollection`, `isComputed`) with shape guards (`isSignal`, `isList`, `isStore`, `isMutableSignal`, `isMutableList`, `isMutableStore`). `isSlot` is unchanged; `Slot` stays out of scope entirely (it abstracts over `{ get, set? }` and ignores other methods by design). Note the migration hazard called out in ADR-0018 §Consequences: `List<T>` changes meaning from mutable to readonly, so existing code typed `List<T>` and calling `.add()` breaks at the type level. If this surfaces a blocker the additive/bridge work did not anticipate, write it to `NOTES.md` rather than pushing ahead — that is exactly the signal this branch exists to catch before it reaches `release/1.5.0`.

- [ ] CE-006: Introduce `createSignal` / `deriveSignal` and retire the composite façades
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking — depends on CE-005. Per ADR-0018 §3 and §5. `createSignal(value, options?)` → `MutableSignal<T>`; `deriveSignal(input, options?)` → `Signal<T>` with the three-way dispatch. Retain `createState`, `createMemo`, `createTask`, and `createSensor` as narrow single-origin entry points returning the collapsed types — this is a tree-shaking requirement, not compatibility (see REQUIREMENTS.md §Bundle Size). Remove `createComputed` and `createMutableSignal` (subsumed). The shape-sniffing coercion currently in `createSignal` (`src/signal.ts:87`) is removed with **no replacement export** — Le Truc's `src/` never calls it (its exposure is Le Truc's re-export surface; Le Truc ships its own helper in its 3.0). Document the recipe in the migration notes: `Array.isArray(v) ? createList(v) : isRecord(v) ? createStore(v) : createState(v)`.

- [ ] CE-007: Move `watched` fully into options
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking — depends on CE-006. Per ADR-0018 §4. `createSensor(watched)` and `createCollection(watched)` currently take the callback in the first position, which is indistinguishable at runtime from a sync derivation callback. Normalize both to the option form. Unify the `watched` signature across shapes: `(emit) => Cleanup` when the input is a seed value, `() => Cleanup` (invalidation only) when the input is a function — the latter is today's Memo `watched`. Verify the lazy `watched`/`unwatched` lifecycle is unchanged; it is pinned by existing tests.

- [ ] CE-008: Verify the core budget after the collapse
  **Skill:** cause-effect-dev
  **Context:** Depends on CE-007. **Scope reduced** — this task previously assumed merging `Collection` into `List` would "offset some of the added surface" against the gzipped limit. CE-013 showed that assumption is wrong: deduplication reliably shrinks minified size and *grows* gzipped size, because gzip already compresses a second near-identical copy almost for free. The full-library figures are now a diagnostic with slack (REQUIREMENTS.md § Bundle Size), so they need no defending here.

  What remains is the part that is a real promise: verify the **≤ 4096 B gzipped core budget** still holds with only `createState` + `createMemo` + `createEffect` imported (`test/util/core-entry.ts`). That budget is the entire reason CE-006 retains the narrow single-origin factories — if it fails, `createSignal`/`deriveSignal` are pulling the async or watched machinery into the core path and CE-006 is wrong. Report the figure either way. Do not raise the core limit; if it genuinely cannot be met, correct the claim in REQUIREMENTS.md and README.md and raise it in NOTES.md.

- [ ] CE-009: Rewrite the derivation guidance as a routing table
  **Skill:** tech-writer
  **Context:** Depends on CE-003 (done). Per ADR-0018 §Context and REQUIREMENTS.md §Every Shape Is Derivable. In `GUIDE.md`, replace the normative "derive everything" framing with the mechanism: an effect-write is a dependency edge the graph cannot see, and the five consequences follow from that one fact (stale reads within a flush pass, lost `equals` suppression, no abort-on-change, no lazy lifecycle, the multi-pass `flush()` + `EffectConvergenceError` that exists to contain it). State the exception plainly — writing outward to DOM, network, or storage is what an effect is for. Then add the shape × origin matrix as a lookup table in `AGENTS.md`, `.github/copilot-instructions.md`, and `CONTEXT.md`, phrased as "you have Y, you want X → call Z". The table is the point: a prohibition is not actionable by a code-generating model, a routing table is.

- [ ] CE-010: Update the embedded skill references
  **Skill:** tech-writer
  **Context:** Depends on CE-009. `.agents/skills/cause-effect/references/signal-types.md` and `.agents/skills/shared/references/api-facts.md` embed the 9-type taxonomy and are loaded by both the `cause-effect` and `cause-effect-dev` skills. They are the highest-leverage surface for the AI-misuse problem, since they are read before any code is written. Update to the shape-indexed taxonomy and the construction matrix. Check `CONTEXT.md` for vocabulary entries that need an _Avoid_ list — `Collection` and `Sensor` become disallowed synonyms for `List` and the external-push construction form.

- [ ] CE-015: Re-baseline the full-library bundle ceiling before release
  **Skill:** cause-effect-dev
  **Context:** Release gate for 2.0, to run last — after CE-005..CE-008 and CE-011, when the surface is final. The full-library ceilings in `test/regression-bundle.test.ts` (32768 B minified, 10240 B gzipped) carry deliberate slack so that refactoring is not distorted by them; that slack is only legitimate if it is taken back at release. Measure both figures on the finished 2.0 build and lower each ceiling to just above the measured value, using the same proportional headroom the core budget has (~1.6x). Update the table in REQUIREMENTS.md § Bundle Size and the summary in ARCHITECTURE.md § Testing Strategy to the new numbers. Report the before/after. Note this is the *only* task permitted to move these ceilings; a mid-branch raise to unblock a commit is exactly what the policy forbids.

- [ ] CE-011: Coordinate the Le Truc migration
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Blocking for the v2.0 release, not for the branch. Per Le Truc's own audit (2026-08-14): internally it uses `createMemo` (→ `deriveSignal`), the `isMemo`/`isState` guards, and `Memo`/`State` type annotations across ~10 files — a mechanical migration they estimate at 1–2 dev-days. It does **not** call `createSignal`, `createList`, `createCollection`, `deriveCollection`, or the origin guards in `src/`; those names are exposed only through its `index.ts` re-export surface (~40 names), which is what forces a coordinated Le Truc 3.0. Audit that surface against CE-005..CE-007, write the migration notes (including the `createSignal`-coercion recipe, which Le Truc ships as its own helper), and confirm the `Slot` integration layer is genuinely unaffected — ADR-0018 assumes it is because `Slot` abstracts over `{ get, set? }` only. If that assumption fails, raise it in `NOTES.md` rather than widening `Slot`'s scope unilaterally. Also coordinate the 2.0 npm publish with Le Truc's 3.0, mirroring how CE-021 coordinates 1.5.0 with Le Truc's 2.5.
