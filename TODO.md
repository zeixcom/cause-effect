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

**Go decision recorded (2026-08-15):** the v2-side condition is satisfied. `v2/shape-exploration`
landed CE-005..CE-008 with no unresolved blocker in `NOTES.md`, then completed its entire task
list — the vocabulary reductions (CE-022), file consolidation (CE-023), the sync-only-bundle fix
(CE-024), the ADR-0018 amendments (CE-027), the documentation rewrites (CE-009/CE-010/CE-028), and
the 2.0 bundle-ceiling re-baseline (CE-015) — and ADR-0018's Status line moved to ✅ Accepted on
2026-08-15. The v2 shape held up: the bridge names this release ships are the names 2.0 lands on.
Only CE-011 (the Le Truc 2.0/3.0 coordination) remains open there; it gates the 2.0 release, not
this one. On this branch, CE-021 is now gated only on CE-025 and CE-026 landing below.

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

- [x] CE-019: Add CHANGELOG.md entries for the 1.5 bridge work — done ✓
  **Skill:** changelog-keeper
  **Context:** Document CE-001..CE-004, CE-012..CE-014 (derivation-gap closures: `deriveStore`,
  the widened `deriveCollection`, `deriveList`, `isPending`/`abort`) and CE-016..CE-018 (the
  `MutableList`/`DerivedList` bridge names and their guards, `createCollection`/`List`/
  `Collection`/`isList`/`isCollection` marked `@deprecated`, the `codemod-v2` tool,
  `MIGRATION-2.0.md`, and the `index.ts` `@deprecated`-scope fix) under `## [Unreleased]`. Classify
  each entry per the skill's Added/Changed/Deprecated/Fixed categories. Do **not** rename
  `[Unreleased]` to `1.5.0` yet — that is CE-021, gated separately.

- [x] CE-020: Tech-writer pass on `MIGRATION-2.0.md` — done ✓
  **Skill:** tech-writer
  **Context:** Flagged in CE-017's Check note as a dev-written draft. Fold it into the existing
  doc set's tone and structure (compare `GUIDE.md`/`README.md`), verify every named export and
  code sample against the current `index.ts` surface, and cross-link it from `README.md` wherever
  not already done. Do not add v2.0-taxonomy content here — CE-009/CE-010 own that, on
  `v2/shape-exploration`, once the shape is confirmed.

- [x] CE-025: Back-port `MutableStore`/`isMutableStore` bridge names to 1.x — reviewed ✓
  **Skill:** cause-effect-dev
  **Context:** Le Truc round 2 §3 (PR #78) — a real gap CE-016 missed: the **Store flip** (1.x `Store` = the mutable type, 2.0 `Store` = the readonly base) has exactly the structure of the `List` flip the ADR calls its most error-prone part, but got no bridge, no codemod rule, and no ADR mention. On `release/1.5.0`: make `MutableStore<T>` the real name of today's mutable Store and add the `isMutableStore` guard (v2's CE-005 already defines both — port the definitions so the two branches converge); mark `Store`/`isStore` `@deprecated` with the v2-flip message mirroring the `List` wording ("Store's current mutable meaning ends in 2.0 — use `MutableStore`; in 2.0, `Store` is the readonly base, today's `DerivedStore`"); extend `tools/codemod-v2.ts` with the meaning-preserving renames `Store`→`MutableStore`, `isStore`→`isMutableStore`, using the same identifier-vs-declaration guards as the List rules; update the bridge table in `MIGRATION-2.0.md`. Le Truc holds their `createList<TodoItem, Store<TodoItem>>` annotations pending this. Also verify and document `--module`: it is a substring match on the module specifier (`tools/codemod-v2.ts:149`), so `--module @zeix/le-truc` works as Le Truc intends — document the invocation with the substring semantics called out. Append the `CHANGELOG.md` `[Unreleased]` entries for this task in changelog-keeper format (CE-019 runs separately and must not be blocked on ordering).
  **Changed:** `src/nodes/store.ts` (`BaseMutableStore`/`MutableStore` are the real names — was `BaseStore`/`Store`; nested `byKey`/iterator references migrated; `createStore` returns `MutableStore<T>`; `Store<T> = MutableStore<T>` deprecated alias with the mirrored flip message; new `isMutableStore` guard — tag check plus the `.add` write capability, ported from v2's CE-005; `isStore` deprecated but **kept tag-based**; internal `signalCategory` uses `isMutableStore`), `src/signal.ts` (`createSignal`/`createMutableSignal` record overloads retyped to `MutableStore<T>`; `isMutableSignal` inlines the `'Store'` tag check with a comment instead of calling the deprecated `isStore` — behavior identical), `index.ts` (+`isMutableStore`, +`MutableStore`), `tools/codemod-v2.ts` (`Store`/`isStore` rename rules, header-table rows, import-sync list, own-name message now "List/Collection/Store", new manual-review hint for `isStore` renames), `test/v2-transition.test.ts` (4 tests), `test/codemod-v2.test.ts` (3 tests), `MIGRATION-2.0.md` (bridge-table rows, Store-flip hazard sentence, terminal-vocabulary paragraph, `--module` substring semantics), `README.md` (Store "Naming ahead of 2.0" note), `CHANGELOG.md` `[Unreleased]`, `types/` regenerated.
  **How:** One deliberate deviation from the `List` pattern, forced by the tag layout: `isStore` **cannot** delegate to `isMutableStore` the way `isList` delegates to `isMutableList`, because the mutable Store and the `DerivedStore` share the `'Store'` tag (unlike `List` vs `Collection`) — delegation would silently stop matching derived stores in a minor release, and `test/derive-store.test.ts:30` pins that they match today. The deprecated `isStore` therefore keeps its tag check (which is also exactly what v2's `isStore` does — the branches converge on behavior; only the 1.x narrowing is mutable), and the deprecation message says so. For the same reason the codemod's `isStore`→`isMutableStore` rename is *not* behavior-identical on derived stores, so it fires a report-only manual-review hint mirroring the read-only-`List` one. `isMutableStore` ports v2's definition verbatim except the tag check is inlined (v2 calls its non-deprecated `isStore`; ours is deprecated and must not flag our own source).
  **Verified:** `bun run check` green end to end — 644/644 tests (7 new), perf regression 9/9, bundle 23851 B min / 8245 B gz / 2484 B core (+78/+17/0 over the branch base, from the one new guard function; diagnostic ceilings hold, core unchanged). Codemod CLI smoke-tested on a sample file: renames apply in place, imports sync, the `isStore` hint fires. `types/` regenerated from a clean cache — the committed declarations were stale in six files before this task (JSDoc-wording drift, same pattern CE-006 found on v2), so that diff carries those fixes alongside the real changes.
  **Review:** Approved ✓. Independently re-ran `bun run check`: 644/644 tests, `tsc --noEmit` clean, bundle 23851 B / 8245 B / 2484 B core — reproduces exactly. The `isStore` non-delegation is the right call: the mutable Store and `DerivedStore` share the `'Store'` tag (confirmed in `store.ts`), so a delegating `isStore` would silently stop matching `deriveStore` results in a minor release — `test/v2-transition.test.ts`'s "isStore stays the tag-based guard" case pins this. `isMutableSignal` correctly switches to `isSignalOfType(value, TYPE_STORE)` rather than calling the now-deprecated `isStore`, preserving the exact prior tag-based behavior (including matching a `DerivedStore`, a pre-existing trait, not a new bug — already tracked for v2 under CE-022(i)'s guard-flip warning). Codemod's `--module` substring semantics verified directly against `syncImports()` (`tools/codemod-v2.ts:153`, `.includes(module)`), matching the new MIGRATION-2.0.md wording. `types/` diff spot-checked across the six flagged files — wording-only plus the CE-004 exports `graph.d.ts` was missing; nothing unexplained.

- [x] CE-026: Deprecate `.deriveCollection()` in 1.x and state the 2.0 intents in `MIGRATION-2.0.md` — reviewed ✓
  **Skill:** cause-effect-dev
  **Context:** Le Truc round 2 §2 and §4 (PR #78). In 1.5, `deriveList` subsumes every `deriveCollection` use, yet neither form carries a deprecation marker — the "born deprecated" hazard in mirror image (promoting a name in the 1.5 release notes that 2.0 removes). The top-level `deriveCollection` is already unexported (CE-014), so the marker matters on the **method**: mark `List.deriveCollection()`/`MutableList.deriveCollection()` `@deprecated` pointing at `deriveList(source, itemFn)`; the rewrite `users.deriveCollection(f)` → `deriveList(users, f)` is mechanical even though the codemod deliberately leaves methods alone. In `MIGRATION-2.0.md`, state plainly: (a) both `deriveCollection` forms are removed in 2.0 (CE-022c); (b) `CollectionSource` renames to `ListSource` in 2.0 — the codemod's exact-identifier rules will **not** catch it (a longer name), so it is a manual rename; this answers Le Truc's reconcile-signature question; (c) adopters of the 1.5 bridge names face one more mechanical rename at 2.0 (`DerivedList`→`List`, `DerivedStore`→`Store`); only `MutableList` is terminal vocabulary; (d) the `--module @zeix/le-truc` invocation from CE-025. Append the `CHANGELOG.md` `[Unreleased]` entries likewise.
  **Changed:** `src/nodes/list.ts` (`@deprecated` JSDoc on the `MutableList.deriveCollection()` overloads — covers `List` too, since `List` is its alias), `src/nodes/collection.ts` (same marker on the `DerivedList.deriveCollection()` overloads), `MIGRATION-2.0.md` (the `.deriveCollection` section now states both forms are **removed in 2.0**, folded into `deriveList(source, itemFn)`; new `CollectionSource<T>` → `ListSource<T>` manual-rename entry answering the reconcile-signature question; (c) landed as the terminal-vocabulary paragraph after the bridge table — updated to name **both** `MutableList` and `MutableStore` as terminal, since CE-025 landed in the same change and the task text predated it), `CHANGELOG.md` `[Unreleased]` Deprecated.
  **How:** Two in-spirit extensions of the task text, both flagged for review: the marker also went on `DerivedList`'s own `deriveCollection()` (the task names `List`/`MutableList`, but `DerivedList` carries the same method and CE-022c removes it in 2.0 just the same — leaving it unmarked would keep the born-deprecated hazard alive on exactly the type `deriveList` returns), and the terminal-vocabulary statement gained `MutableStore` alongside `MutableList` because CE-025 makes it 2.0-stable vocabulary. One JSDoc block sits above the first overload of each pair — deprecation is symbol-level, so it flags both call shapes.
  **Verified:** `bun run check` green end to end — 644/644 tests, perf 9/9, bundle 3/3 (figures under CE-025; this task is markers and docs only, no runtime change).
  **Review:** Approved ✓. Extending the `@deprecated` marker to `DerivedList.deriveCollection()` alongside `MutableList`'s was the right call, not scope creep — `deriveList` is the flagship 1.5 API and its return type is exactly `DerivedList`, so leaving that copy unmarked would have kept the born-deprecated hazard alive on the one type consumers actually get back. `MIGRATION-2.0.md`'s new `CollectionSource<T>` → `ListSource<T>` entry correctly identifies why the codemod can't help (distinct symbol, not a deprecated alias) and lines up with CE-022's landed rename on `v2/shape-exploration`. No runtime change, both markers confirmed present in the diff, docs consistent with CE-025.

- [x] CE-029: Tech-writer sweep for the Store-flip and `.deriveCollection()` deprecation — done ✓
  **Skill:** tech-writer
  **Context:** Found in review of CE-025/CE-026 (2026-08-15). Those tasks updated `MIGRATION-2.0.md`
  and `README.md` only, per their own task text — the wider doc set still showed the pre-deprecation
  names with no bridge-name or `@deprecated` mention. Same pattern as CE-020 (tech-writer pass
  following CE-016/CE-017's bridge-name landing).
  **Changed:** `GUIDE.md` (Store/List/Collection sections gained "Naming ahead of 2.0" callouts
  matching README's convention; `createSignal`/`createMutableSignal`/`isMutableSignal` examples
  corrected to the actual `MutableStore`/`MutableList` return types), `.github/copilot-instructions.md`
  (Signal Types, Key Files, Naming Conventions, and code-pattern sections updated with bridge
  names and `@deprecated` notes), `RECIPES.md` (`.deriveCollection()`/`createCollection()` examples
  annotated as deprecated), `REACT_INTEGRATION.md` (`<Each>`'s `list: List<T>` changed to
  `MutableList<T>` with a note — a read-only-position case per `MIGRATION-2.0.md`),
  `.agents/skills/cause-effect-dev/references/source-map.md` and
  `.agents/skills/shared/references/api-facts.md` (Store row split to match the List row's
  bridge-name pattern; `deriveStore` rows added, which were missing entirely).
  **Reviewed by architect ✓** — consistency review confirmed against `index.ts`; no code changes,
  docs only. Unblocks CE-021.

- [ ] CE-030: Mark the origin-specific types and guards `@deprecated` ahead of their v2.0 removal
  **Skill:** cause-effect-dev
  **Context:** Found in a v1.5 ↔ v2.0 public-API cross-check (2026-08-16), run before the 1.5.0
  publish. `v2/shape-exploration`'s `index.ts` exports none of `State`, `isState`, `Memo`, `isMemo`,
  `Task`, `isTask`, `Sensor`, `isSensor`, `SensorCallback`, `SensorOptions`, `isComputed`, or
  `ComputedOptions` — MIGRATION-2.0.md's "Origin guards" section already documents the removal
  ("no mechanical replacement... usually the shape guards (`isSignal`, `isMutableSignal`) or a
  plain property check"), but none of these twelve symbols carry an `@deprecated` JSDoc marker in
  `release/1.5.0` today (`grep -rn '@deprecated' src/` finds none). This is the same silent-break
  hazard CE-016/CE-025 exist to prevent for `List`/`Store`, just for full removal instead of a
  meaning flip — a consumer using `isState`/`Task` etc. today gets no warning before 2.0 deletes
  them. Add `@deprecated` JSDoc to each (`src/nodes/state.ts`: `State`, `isState`;
  `src/nodes/memo.ts`: `Memo`, `isMemo`; `src/nodes/task.ts`: `Task`, `isTask`;
  `src/nodes/sensor.ts`: `Sensor`, `isSensor`, `SensorCallback`, `SensorOptions`; `src/signal.ts`:
  `isComputed`; `src/graph.ts`: `ComputedOptions`), pointing at `isSignal`/`isMutableSignal` or a
  plain property check per MIGRATION-2.0.md's own guidance, and linking `MIGRATION-2.0.md`'s
  "Origin guards" section. **Also decide:** MIGRATION-2.0.md says `createComputed` and
  `createMutableSignal` need "no action until 2.0" because they're "subsumed... no action needed
  until 2.0" — but `createSignal`/`deriveSignal` already exist in 1.x today (CE-006 landed them on
  `v2/shape-exploration`, not yet back-ported to 1.5), so the same born-deprecated-hazard argument
  applies once a 1.x replacement exists. If `createSignal`'s dispatch semantics are considered a
  1.5-compatible bridge, deprecate `createComputed`/`createMutableSignal` here too; otherwise leave
  the MIGRATION-2.0.md text as the documented decision and note why in this task's handoff. No
  runtime behavior changes — JSDoc only. Blocks npm publish of 1.5.0.

- [ ] CE-031: Mark `Collection`'s auxiliary callback/options types `@deprecated`
  **Skill:** cause-effect-dev
  **Context:** Found in the same cross-check as CE-030 (2026-08-16). `Collection`, `isCollection`,
  `createCollection`, and `.deriveCollection()` are already `@deprecated` (CE-016/CE-026), but six
  supporting types in `src/nodes/collection.ts` are not: `CollectionCallback`, `CollectionChanges`,
  `CollectionOptions`, `CollectionSource`, `DeriveCollectionCallback`, `DeriveCollectionOptions`.
  None of the six exist in `v2/shape-exploration`'s `index.ts` — `list.ts` there exports
  `ListCallback`, `ListChanges`, and `ListSource` instead (per CE-022's landed renames), and
  `DeriveListOptions` alone covers what `DeriveCollectionOptions`/`DeriveListOptions` split between
  them in 1.5. `CollectionSource` → `ListSource` is already flagged in MIGRATION-2.0.md's "What the
  codemod cannot decide" section as a manual rename, but the type itself carries no `@deprecated`
  marker pointing there. Add `@deprecated` JSDoc to all six, naming the 2.0 successor where one
  exists (`CollectionSource` → `ListSource`) and noting "removed in v2.0, folded into `deriveList`'s
  own options/callback shape" for the rest. No runtime behavior changes — JSDoc only. Blocks npm
  publish of 1.5.0.

- [x] CE-021: Prepare and tag the 1.5.0 release — done, pending publish ⏳
  **Skill:** changelog-keeper
  **Context:** The v2-side gate is satisfied — see the Go decision note above (ADR-0018 ✅
  Accepted 2026-08-15). CE-025, CE-026, and CE-029 all landed and reviewed.
  **Changed:** `CHANGELOG.md` (`## [Unreleased]` renamed to `## 1.5.0`), `package.json` (`version`
  1.4.1 → 1.5.0), `index.ts` (`@version` tag 1.4.1 → 1.5.0).
  **Verified:** `bun run check` green — 644/644 tests, `tsc --noEmit` clean, bundle 23851 B min /
  8220 B gz / 2478 B core, all under ceiling.
  **Remaining, not automated:** npm publish (coordinate with Le Truc's 2.5 release per the Branch
  plan note above); the performance-baseline re-point against the published release, required for
  this minor bump per `../cause-effect-dev/workflows/update-perf-baseline.md` step 1, which needs
  the version live on npm first.
  **Blocked on CE-030 and CE-031** (found 2026-08-16, after this task closed): a v1.5 ↔ v2.0
  public-API cross-check found twelve origin-specific types/guards and six `Collection` auxiliary
  types that v2.0 removes without any `@deprecated` marker in 1.5 today. Both are JSDoc-only,
  non-breaking, and belong in the 1.5.0 release that ships before the removal — do not publish
  until they land.

---

## `v2/shape-exploration` — v2.0 shape confidence

**Synced from `v2/shape-exploration` (2026-08-15): the shape held up — every task below is
complete and reviewed except CE-011, which gates the 2.0 release, not this one.** Full task
records (Changed/How/Verified/Review) live on that branch's TODO.md; recorded here are the
outcomes that bear on this branch's remaining work. ADR-0018 is ✅ Accepted there (2026-08-15),
amended with the Store-flip and guard-flip consequences that Le Truc round 2 and the review
surfaced.

- [x] CE-005: Collapse the type vocabulary to shape × mutability — reviewed ✓
  **Outcome:** `Symbol.toStringTag` carries shape only (`Signal`/`List`/`Store`/`Slot`); the
  origin types and guards are gone. `Store<T>` is now the readonly base (was `DerivedStore`),
  `MutableStore<T>` the mutable extension (was `Store`), with `isMutableStore` added — the
  mutability guards check for a `.set`/`.add` capability at runtime, not the tag. **CE-025 ports
  these `MutableStore`/`isMutableStore` definitions so the two branches converge.** One recorded
  wrinkle, irrelevant to 1.x (where `MutableStore` names today's `Store` whole): `MutableStore<T>`
  is not a tsc-checkable structural subtype of `Store<T>` for a generic `T`, because `byKey`'s
  return type is a per-key conditional.

- [x] CE-006: Introduce `createSignal` / `deriveSignal` and retire the composite façades — reviewed ✓
  **Outcome:** `createSignal(value)` → `MutableSignal<T>`, `deriveSignal` with the three-way
  dispatch; `createComputed`/`createMutableSignal` removed. The shape-sniffing coercion is gone
  with no replacement export — the recipe (`Array.isArray(v) ? createList(v) : isRecord(v) ?
  createStore(v) : createState(v)`) stays in MIGRATION-2.0.md, which this branch's CE-020 pass
  verified against the 1.x surface.

- [x] CE-007: Move `watched` fully into options — reviewed ✓
  **Outcome:** `createSensor`/`createCollection` take `watched` as a required options member —
  the positional-`watched` signature is 1.x-only vocabulary, documented as such in v2's
  MIGRATION-2.0.md.

- [x] CE-008: Verify the core budget after the collapse — reviewed ✓
  **Outcome:** holds — 2291 B gzipped for the `createState`+`createMemo`+`createEffect` trio,
  44 % headroom under 4096 B. The `refresh()`-dispatch finding it raised became CE-024.

- [x] CE-022: Take the v2 vocabulary reductions and naming unification — reviewed ✓
  **Outcome:** confirms CE-026's stated 2.0 intents as landed facts — the `.deriveCollection()`
  methods are removed (c), `CollectionSource` is now `ListSource` (b), and the callback/option
  renames landed (`ListCallback`/`ListChanges`, `initial`, `emit`, `abortSignal`). The codemod
  flags `isSignal`/`isMutableSignal` call sites for manual review (j): those guards flip
  silently in 2.0, which v2's MIGRATION-2.0.md warns about.

- [x] CE-023: Consolidate the source-file structure to the shape taxonomy — reviewed ✓
  **Outcome:** `src/nodes/collection.ts` folded into `src/nodes/list.ts`, the signal types into
  `src/nodes/signal.ts`; no public-surface change. Relevant only when diffing the branches.

- [x] CE-024: Remove the task recompute path from sync-only bundles — reviewed ✓
  **Outcome:** core dropped to 2072 B gzipped; a built sync-only bundle contains no
  `AbortController` (content grep). ADR-0018 §5's mechanism claim is now literally true.

- [x] CE-027: Amend ADR-0018 with the review outcomes; move Status off "Proposed" — done ✓
  **Outcome:** ADR-0018 ✅ Accepted 2026-08-15, with the Store-flip and guard-flip entries in
  Negative Consequences — the v2-side gate input CE-021 was waiting on.

- [x] CE-009: Rewrite the derivation guidance as a routing table — done ✓
  **Outcome:** GUIDE/AGENTS/copilot-instructions/CONTEXT on v2 carry the shape × origin
  construction matrix ("you have Y, you want X → call Z") and the no-umbrella-noun rule.

- [x] CE-010: Update the embedded skill references — done ✓
  **Outcome:** the skill references and CONTEXT.md vocabulary on v2 are shape-indexed;
  `Collection`/`Sensor`/`Computed`/`State`/`Memo`/`Task` moved to avoid-lists.

- [x] CE-028: Sync `README.md`, `RECIPES.md`, and `REACT_INTEGRATION.md` to the v2 surface — done ✓
  **Outcome:** all three verified against the v2 `index.ts`; no stale 1.x name remains.

- [x] CE-015: Re-baseline the full-library bundle ceiling before release — done ✓
  **Outcome:** the 2.0 ceilings are 28672 B min / 10240 B gz, and the core promise is tightened
  to 3072 B. This branch's own 32768 B / 10240 B ceilings are untouched — 1.x code, 1.x budget.

- [ ] CE-011: Coordinate the Le Truc migration
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Blocking for the v2.0 release, not for the branch. Per Le Truc's own audit (2026-08-14): internally it uses `createMemo` (→ `deriveSignal`), the `isMemo`/`isState` guards, and `Memo`/`State` type annotations across ~10 files — a mechanical migration they estimate at 1–2 dev-days. It does **not** call `createSignal`, `createList`, `createCollection`, `deriveCollection`, or the origin guards in `src/`; those names are exposed only through its `index.ts` re-export surface (~40 names), which is what forces a coordinated Le Truc 3.0. Audit that surface against CE-005..CE-007 and CE-022, write the migration notes (including the `createSignal`-coercion recipe, which Le Truc ships as its own helper, and the `isSignal`/`isMutableSignal` flip warnings from CE-022(i)), and confirm the `Slot` integration layer is genuinely unaffected — ADR-0018 assumes it is because `Slot` abstracts over `{ get, set? }` only. If that assumption fails, raise it in `NOTES.md` rather than widening `Slot`'s scope unilaterally. Also coordinate the 2.0 npm publish with Le Truc's 3.0, mirroring how CE-021 coordinates 1.5.0 with Le Truc's 2.5.
  **Le Truc round 2 (2026-08-15, PR #78 §5) — their commitments to factor in:** Le Truc 2.5.0 depends on `^1.5.0`, re-exports every bridge name with mirrored deprecations, migrates their examples to the bridge names, and widens `reconcile` to unkeyed `Signal<E[]>` sources. One correction their plan implies: the widening must go through `deriveList(source, itemFn)` — the top-level `deriveCollection` has been unexported since CE-014, and the keyedAdapter machinery is reachable only through `deriveList`. Their `Store<T>` item-type annotations (e.g. `createList<TodoItem, Store<TodoItem>>`) are held pending the CE-025 bridge decision.
