# V2 Refactoring Analysis — Review of CE-005 through CE-008

**Date:** 2026-08-15 | **Skill:** architect | **Scope:** `v2/shape-exploration` @ `1328b03`,
reviewed against [ADR-0018](adr/0018-shape-indexed-signal-types.md), `REQUIREMENTS.md`,
`CONTEXT.md`, and `NOTES.md`.

## Verdict

The refactoring **meets the stated goal of ADR-0018**. Every decision section of the ADR is
delivered and pinned by tests; both NOTES.md findings are correctly assessed as non-blocking;
the core budget holds with 44 % headroom. The one genuinely sharp edge is the one you flagged:
the `isSignal()` / `isMutableSignal()` meaning flip is real, it is the *only* part of the v2
break that lands with neither a 1.5 bridge nor codemod coverage nor a migration-doc warning,
and one sentence in `MIGRATION-2.0.md` currently steers migrators *into* the trap. My
assessment is that the flip was avoidable only by paying a higher price elsewhere (§2.3), so
the right move is to keep the ADR's assignment and mitigate — but that is decision Q1 below,
made together.

The collapse also leaves behind reduction opportunities that were previously impossible and
have not yet been taken (§3), and there are three naming-consistency defects worth fixing
before the shape is declared final (§4).

---

## 1. Does the refactor meet ADR-0018's goal?

Decision by decision:

| ADR § | Claim | Status | Evidence |
|---|---|---|---|
| 1 | Six value types, shape × mutability | ✅ Delivered | `Signal`/`MutableSignal` (`src/graph.ts:77`), `List`/`MutableList` (`src/nodes/list.ts:78`), `Store`/`MutableStore` (`src/nodes/store.ts:76`); `Symbol.toStringTag` carries shape only; mutability guards check `.set`/`.add` capability |
| 2 | `isPending`/`abort` as graph utilities | ✅ Delivered | WeakMap-based (`src/graph.ts:868`), shape-agnostic, reactive; `Task` methods removed, `createTask` registers itself (`src/nodes/task.ts:136`) |
| 3 | `create*`/`derive*` indexed by origin | ✅ Delivered | `createSignal` delegates to `createState`, `deriveSignal` three-way dispatch (`src/signal.ts:110`); façade tree-shakes (+11 B only, CE-008) |
| 4 | `watched` is an option, never a callback position | ✅ Delivered | `createSensor(options)` / `createCollection(options)` normalized in CE-007; signature split (seed → `(emit)`, function → `(invalidate)`) uniform |
| 5 | Core four survive as narrow entry points | ✅ Holds, with a recorded caveat | 2291 B gzipped for the trio, 44 % under 4096 B. The ADR's *mechanism* claim (no task path in a sync-only bundle) is not literally delivered — `refresh()`'s `'controller' in node` dispatch retains `recomputeTask` — but this predates the branch and the byte promise holds (NOTES.md, CE-008 finding) |
| 6 | Async composites never unset | ✅ Delivered | `deriveList`/`deriveStore` default `initial` to `[]`/`{}`; `isPending()` carries loading state |
| 7 | Derived composites derive their slices | ✅ Delivered | Per-property/per-item Memos reading the source; `byKey` creates no structural edge (ADR-0015 asymmetry preserved); index revalidation inside the slice's recompute (CE-012 fix survived the collapse) |

The REQUIREMENTS.md success criteria that motivated the whole effort are met in the code:
every cell of the shape × origin matrix is reachable through `derive{Signal,List,Store}`, and
nothing derived exposes `.set()`. The derivation-gap closure is not decorative —
`deriveList(asyncFn, { initial })` genuinely replaces the fetch-then-effect-write pipeline
that started the ADR.

**Both NOTES.md findings are correctly non-blocking.** The `MutableStore<T>` ⊄ `Store<T>`
tsc limitation is a type-system artifact of the per-key conditional return, documented with a
workaround, invisible at runtime. The `recomputeTask` retention is a pre-existing structural
fact (~270 B) that CE-008 discovered only because it was the first task to actually measure
the sync-only claim; recording rather than fixing it was right.

**Release-gate observation:** CE-005..CE-008 landed with no unresolved blocker in NOTES.md,
which is the v2-side condition for CE-021. ADR-0018's Status line still reads "Proposed" —
that is the remaining gate input, and it should not move until Q1 below is decided.

---

## 2. The `isSignal()` / `isMutableSignal()` meaning flip

### 2.1 What exactly flips

| Guard | 1.x meaning (CONTEXT.md) | v2 meaning | Failure mode for unchanged code |
|---|---|---|---|
| `isSignal(x)` | True for all nine types **plus `Slot`** — the umbrella | True only for the single-value shape (`toStringTag === 'Signal'`) | `isSignal(list)` / `isSignal(store)` / `isSignal(slot)` silently become `false` |
| `isMutableSignal(x)` | True for `State` ∪ `Store` ∪ `List` — every mutable signal | True only for mutable **single-value** | `isMutableSignal(store)` / `isMutableSignal(list)` silently become `false` |

The flip is pinned by `test/v2-transition.test.ts:97` and `test/signal.test.ts:194`, so it is
intentional, not accidental. Note the *type* `Signal<T>` is structurally `{ get(): T }` and
remains assignable-from `List`/`Store`/`Slot` — only the runtime guard narrowed. That makes
the break invisible to `tsc` in the common `isSignal(x: unknown)` pattern: no compile error,
no deprecation marker, just a different boolean at runtime.

### 2.2 Why this is the sharpest edge of the whole migration

Compare the treatment the `List` flip got with the treatment this one got:

- The `List` meaning flip was deemed "the most error-prone part of the migration" (ADR §
  Negative Consequences) and received a three-part containment: a 1.5 back-port of
  `MutableList` under `@deprecated` markers (CE-016), a codemod (CE-017), and a migration
  recipe.
- The `Signal` flip got **none of the three, and cannot get the first**: CE-016 explicitly
  declined to back-port it ("`Signal<T>` in 1.x is the umbrella union, so reusing it now
  would itself be a flip"). The codemod renames `isList`→`isMutableList` etc. but leaves
  `isSignal` untouched — same identifier, different predicate, nothing to rename. And
  `MIGRATION-2.0.md:66` actively recommends the trap: origin-guard users are told to reach
  for "the shape guards (`isSignal`, `isMutableSignal`)" — advice that is silently wrong the
  moment the guarded value is a composite.

So a consumer doing the most natural thing — migrating `isState(x) || isMemo(x)` to
`isSignal(x)` where `x` might be a `Store` — gets code that compiles, passes review, and
misroutes at runtime. That is a worse failure mode than any type-level break in the ADR.

### 2.3 Was it unavoidable?

**Within ADR-0018's type table: yes.** The guard must follow the type name; the ADR assigns
`Signal<T>` to the single-value shape; therefore `isSignal` narrows to that shape. The only
way to avoid the flip is a different type table. So the real question is whether the
alternative table — your suggestion of `State`/`MutableState` for the single-value shape,
`Signal` kept as the umbrella — is better. Taking it seriously:

**What the alternative gets right.** `isSignal` never flips — the umbrella predicate keeps
its exact meaning, and the most-used guard in ecosystem code is safe. The migration also
becomes *bridgeable*: `MutableState` is an additive alias in 1.5 (like `MutableList`), the
codemod gains a mechanical `State`→`MutableState` rewrite, and `createState` already exists
as the narrow factory name. On migration mechanics alone, the alternative is strictly
gentler.

**Where it breaks down.** Three costs, in ascending order of weight:

1. *Vocabulary strain.* `State` must denote the single-value **shape** — writable or
   derived, direct or async or externally pushed. But "state" carries exactly the
   connotation the collapse exists to remove: CONTEXT.md's own definition is "a mutable
   **Source** that holds a value directly". A `State<T>` returned by `deriveSignal(async …)`
   is a contradiction in that vocabulary — it is neither mutable nor holds its value
   directly. We would spend the v2 rename replacing one origin-flavored name (`Memo`) with
   another (`State`), while `Signal` is the one name in the candidate set that is genuinely
   origin-neutral.

2. *The flip doesn't disappear — it moves to `isState`.* Under the alternative, `isState`
   survives as the shape guard for the single-value shape. Old `isState(x)` meant "x is a
   `createState` output"; new `isState(x)` is additionally true for every derived and
   externally-pushed single-value signal. That is the same silent runtime flip, applied to
   the one guard **Le Truc actually uses today** (their audit: `isMemo`/`isState` across
   ~10 files). Under the ADR as implemented, `isState` is *removed* — a compile error that
   forces the hand audit CE-011 already plans. A removal is auditable; a widened predicate
   is not.

3. *Training-set prior.* The ADR's thesis is that priors are not answerable by prose, so
   the names must recruit the prior instead of fighting it. The dominant modern prior —
   Solid `createSignal`, Preact `signal()`, Angular `signal()`, the TC39 Signals proposal's
   `Signal` namespace — ties "signal" to the single-value reactive cell. `deriveSignal` as
   the flagship name for "derive anything, get a readonly value" is worth a lot precisely
   for the misuse problem this ADR exists to solve. `deriveState` reads as "derive
   application state", which is both vaguer and more mutable-sounding than the concept.

**Conclusion: the flip was avoidable in principle but not cheaply — every alternative
either flips a different, more-exposed guard or re-imports the origin connotation the
collapse deletes.** I recommend keeping the ADR's assignment. What is *not* defensible is
the current absence of mitigation; the flip as shipped is an unmarked trap.

### 2.4 The genuine hole: no umbrella guard

You are right that v2 loses the ability to ask "is this any reactive value with a `.get()`?"
— and CONTEXT.md's Signal entry, Relationships section, and Example Dialogue all still
depend on that concept existing. But the evidence says the hole is smaller than it looks:

- **No internal need survives.** The last internal umbrella use, `isSignalOrDescriptor` in
  `src/nodes/slot.ts:71`, already falls back to a structural `'get' in value` check, so
  Slots still accept `List`/`Store` backings. `match()`, `isPending()`, and `abort()` take
  structurally-typed or `unknown` inputs. Nothing in `src/` needs a tag-based umbrella.
- **The consumer need is thin.** The umbrella question arises in "signal-or-plain-value"
  parameter handling, where a structural check is the *correct* answer anyway (it accepts
  `Slot` and Le Truc's descriptor-like objects, which a tag check never did).

Options: (a) bless the structural recipe (`typeof x?.get === 'function'`) in CONTEXT.md and
the migration notes; (b) export an explicit umbrella guard. I recommend (a). A new export
(`isReactive`? `isAnySignal`?) adds a seventh concept to a taxonomy whose entire point is
that six plus two orthogonal primitives is complete — and any name for the umbrella competes
with `Signal` the type. If a real consumer need surfaces later (CE-011's Le Truc audit is
the place it would), an additive guard can ship in 2.1 without ceremony.

### 2.5 Recommended mitigations (if Q1 = keep the ADR)

1. **`MIGRATION-2.0.md` must warn about both flips explicitly** — `isSignal` no longer
   matches `List`/`Store`/`Slot`, `isMutableSignal` no longer matches `Store`/`List` — and
   the origin-guard advice at line 66 must stop unconditionally recommending `isSignal` as
   the replacement. This is the highest-priority item in this document regardless of any
   other decision: it is a documentation fix that removes a documented trap from the
   coordination artifact Le Truc will migrate against.
2. **CONTEXT.md's rewrite (CE-010)** must define what the umbrella is called now. Suggested
   framing: *signal* (lowercase, the family adjective) for "any of the six value types plus
   `Slot` and `Effect`"; **`Signal<T>`** (the type) strictly for the single-value shape.
   The "signal-or-plain-value" recipe gets a vocabulary entry. The Signal entry's current
   text ("the umbrella term for the nine public reactive types") is the largest single
   stale-vocabulary block in the repo.
3. **Consider having the codemod flag `isSignal`/`isMutableSignal` call sites** (not rewrite
   them — flag, like it does read-only `List` positions) so the audit is at least
   mechanical to enumerate.

---

## 3. API reductions and simplifications now possible

The collapse deleted the `Collection` concept and several 1.x compat shims, but the export
surface has not yet caught up. These were impossible before CE-005 and are now available;

roughly in priority order:

1. **Unexport `createCollection` and retire the `Collection*` type vocabulary.** v2 deleted
   the *type* `Collection`, yet `index.ts` still exports a `@deprecated`
   `createCollection` factory plus **seven** public type names carrying the word:
   `CollectionCallback`, `CollectionChanges`, `CollectionOptions`, `CollectionSource`,
   `DeriveCollectionCallback`, `DeriveCollectionOptions` (and `SensorCallback`/
   `SensorOptions`, see item 4). ADR-0018 rejected `Collection` as a flagged-weak,
   LLM-misleading name — shipping a v2 where a third of the composite API's public nouns
   are that word undercuts the rename's entire justification. The factory is now only an
   internal implementation detail of `deriveList`'s external-push branch
   (`src/nodes/collection.ts:763`); it needs no public name. Rename the types to their
   shape-indexed homes (`ListCallback`, `ListChanges`, `ListSource`, …) and fold
   `DeriveCollection*` into module-private scope.
2. **Remove the `.deriveCollection()` methods from `List`.** `deriveList(source, itemFn)`
   is public, strictly more general (accepts any `Signal<U[]>`), and already documented as
   the replacement in `MIGRATION-2.0.md`. Keeping the method means keeping
   `DeriveCollectionCallback` public (see item 1) and teaching both forms forever.
3. **Execute the two scheduled deprecation removals.** `isObjectOfType` ("will be removed
   in v2.0" — REQUIREMENTS.md § Utility Function Exports) and `isEqual` are still exported
   from `index.ts`. v2 is the moment REQUIREMENTS already promised.
4. **Unify the seed-option name across narrow factories and façades** — see §4.2; as a
   bonus, `DeriveSignalOptions.watched`'s type currently *references*
   `SensorCallback<T>`, so the deleted `Sensor` concept leaks into the flagship façade's
   public type. A shape-indexed name (e.g. `SignalCallback<T>`) or an inline union closes
   that leak.
5. *(Minor)* `DeriveSignalOptions.watched` is a union of two unrelated signatures. Splitting
   it across the two overloads (seed form gets `(emit) => Cleanup` only, function form gets
   `(invalidate) => Cleanup` only) would give better completions and better errors. Not
   urgent; the union is honest about the runtime dispatch.

None of these change runtime behavior; all are name-surface work. Items 1–3 are the ones I
would gate the "shape is final" call on, because they are exactly the vocabulary debt CE-009/
CE-010 will otherwise have to document around.

---

## 4. Parameter-name consistency audit

### 4.1 The `AbortSignal` parameter: `abort` vs `signal`

The public callback surface is split down the middle:

- **`signal`**: `TaskCallback` (`src/graph.ts:176`), both `createTask` overloads, the
  `createTask` JSDoc example (`fetch(url, { signal })`).
- **`abort`**: `DeriveCollectionCallback` (`src/nodes/collection.ts:103`), all
  `deriveList`/`deriveStore` overloads and examples, `List.deriveCollection` methods, the
  `deriveSignal` JSDoc example, and the internal `TaskNode.fn` type (`src/graph.ts:52` —
  inconsistent with `TaskCallback` eight lines above it in the same file).

Your instinct is right on both counts: the name collides with the free-standing
`abort(signal)` utility (a reader of `deriveList(async (prev, abort) => …)` near an
`abort(users)` call gets two meanings of the same identifier), and it is a misnomer besides
— the parameter *is* the signal, not the abort action.

**Recommendation: rename to `signal`.** It matches the `TaskCallback` precedent (the
majority of call sites after renaming the façade overloads), reads naturally in the
dominant usage (`fetch(url, { signal })`), and matches the DOM/TypeScript convention. The
collision with the library's own `Signal` concept is tolerable in a position whose type is
spelled `AbortSignal`; if you find it too ambiguous in prose, `abortSignal` is the
acceptable alternative — but pick one. Callback parameter names are non-breaking to rename.

### 4.2 The seed family: `value` / `initial` / `seed` / `input`

Current state of the same conceptual slot — "the value the signal holds before its first
computation":

| Position | Name | Where |
|---|---|---|
| `create*` first positional param | `value` | `createSignal`, `createState`, `createStore`, `createList` |
| `derive*` first positional param | `input` | `deriveSignal`, `deriveList`, `deriveStore` |
| Seed option, narrow factories | `value` | `ComputedOptions.value` (memo/task), `SensorOptions.value`, `CollectionOptions.value` |
| Seed option, façades | `initial` | `DeriveSignalOptions.initial`, `DeriveListOptions.initial`, `DeriveStoreOptions.initial` |
| Prose | "seed" | ADR-0018 §3/§4, `deriveList`/`deriveStore` JSDoc ("a seed array", "a seed record") |

The code itself admits the wart — `src/signal.ts:123`: "The narrow factories name the seed
`value`; the façade family says `initial`" — and `deriveSignal` literally translates one to
the other at runtime (`options.initial` → `{ …options, value: seed }`). A consumer using
`createTask(fn, { value })` today and `deriveSignal(asyncFn, { initial })` tomorrow is
learning two names for one concept inside one release.

**Recommendation: adopt one rule and enforce it in CONTEXT.md.** Positional first
parameters stay `value` (create*) and `input` (derive*); the before-first-computation
option is `initial` *everywhere* — rename `ComputedOptions.value`,
`SensorOptions.value`, and `CollectionOptions.value` to `initial`. Drop "seed" from prose
(or keep it strictly as informal shorthand); it is a fifth wheel that never appears as an
identifier. The renames are option-name breaks inside an already-breaking major, and they
cost one mechanical test migration.

### 4.3 The push callback's argument: `set` / `apply` / `emit`

ADR-0018 §4 specifies "`emit`" for all three shapes: `emit(value)`, `emit(changes)`,
`emit(patch)`. The implementations agree only on `Store`:

- `SensorCallback`: parameter named `set` (`src/nodes/sensor.ts:42`)
- `CollectionCallback`: parameter named `apply` / `applyChanges`
- `StoreCallback`: parameter named `emit` (`src/nodes/store.ts:135`)

**Recommendation: unify on `emit`**, per the ADR, in all three type declarations and their
JSDoc. Purely cosmetic (positional parameters), zero runtime cost, and it removes one more
place where the three shapes' otherwise-parallel external-push forms diverge by accident
rather than intent.

---

## 5. NOTES.md findings — assessed

Both entries are correctly scoped as non-blockers, and both carry the right follow-up
framing:

- **`MutableStore<T>` not a checkable structural subtype of `Store<T>`**: a `tsc`-only
  limitation of the per-key conditional return, with a documented workaround (narrow to a
  concrete `T` or pass a snapshot). The ADR §1 table's `⊃` should be read as assignment-
  at-a-concrete-key, not generic subtyping; CE-010's CONTEXT.md rewrite is the place to say
  so in public docs.
- **`recomputeTask` retained in sync-only bundles via `refresh()`'s dispatch**: pre-existing,
  ~270 B, invisible until CE-008 measured the claim. The suggested fix (node-stored
  recompute closure) is sound if the strict no-async-bytes property is ever wanted; agreed
  that it is out of scope while the byte promise holds with 44 % headroom.

---

## 6. Open decisions

| # | Question | My recommendation |
|---|---|---|
| Q1 | Accept the `Signal`-as-single-value assignment (with §2.5 mitigations), or revisit `State`/`MutableState` with `Signal` as umbrella? | **Accept and mitigate.** The alternative's gentler migration is outweighed by the `isState` silent-flip risk (Le Truc's actual guard), the origin connotation of "State", and the loss of `deriveSignal`'s prior-alignment. Re-opening also re-opens Le Truc coordination. |
| Q2 | Umbrella guard: bless the structural recipe, or export a new guard? | **Bless the recipe** in CONTEXT.md + migration notes; revisit additively if CE-011's audit surfaces a real need. |
| Q3 | Take the §3 reductions (unexport `createCollection` + rename `Collection*` types, remove `.deriveCollection()` methods, drop `isEqual`/`isObjectOfType`)? | **Yes to all**, as one cause-effect-dev task before CE-009/CE-010 — the doc rewrites should not have to document the discarded vocabulary. |
| Q4 | Unify the seed option on `initial` (rename `value` in `ComputedOptions`/`SensorOptions`/`CollectionOptions`)? | **Yes** — same task or a companion; one rule, documented in CONTEXT.md. |
| Q5 | AbortSignal parameter name: `signal` or `abortSignal`? | **`signal`** (§4.1); rename the `abort`-named overload/JSDoc sites and the internal `TaskNode.fn` type. |
| Q6 | Unify the push-callback argument on `emit`? | **Yes** — trivial, do with Q4/Q5. |

**CE-005..CE-008 implementation status:** as *implementations of ADR-0018* they are
approved — mechanisms verified against the changed files in full, tests pinned to the
behaviors (including the deliberate overload ordering in `deriveSignal` and the per-side
perf setups), budgets re-measured rather than asserted. I have left their TODO.md statuses
untouched pending Q1, since a "reviewed ✓" on CE-005 would implicitly endorse the vocabulary
decision you have not yet made. ADR-0018's Status line likewise stays "Proposed" until Q1
is settled — that is the release gate for CE-021, and it is doing its job.

---

## 7. Decisions recorded — 2026-08-15

| # | Decision | Deviation from / beyond the recommendation |
|---|---|---|
| Q1 | **Accept and mitigate** — `Signal` stays the single-value type | The umbrella is **not** lowercase "signal". Rejected framing: a three-way collision (the `Signal` type, the umbrella noun, `AbortSignal`) is exactly the confusion the vocabulary work exists to remove. Docs use **"value types"** for the six, name `Effect` and `Slot` separately, and express "anything readable" only via the structural `.get()` recipe — no umbrella noun is coined. Structural consequence: `Signal`/`MutableSignal` are value types like `List`/`Store` and move out of `src/graph.ts` into `src/nodes/signal.ts` (consolidated with the façades from `src/signal.ts`), and `src/nodes/collection.ts` disappears (folded into `src/nodes/list.ts`) → CE-023. |
| Q2 | **Bless the structural recipe** for the umbrella guard | As recommended. |
| Q3 | **Yes to all reductions** | As recommended → CE-022. |
| Q4 | **Yes — `initial` everywhere** | As recommended → CE-022. |
| Q5 | **`abortSignal`** — not `signal` | Deliberate deviation, for the same reason as the umbrella rejection: `signal` as an identifier would collide with `Signal` the type and muddy the AbortSignal reads. Every `AbortSignal` callback parameter — the `signal`-named and the `abort`-named ones alike — becomes `abortSignal`. |
| Q6 | **Yes — `emit` everywhere** | As recommended. |

Additional directions given with the decisions: a `*Options` structure/naming unification
review (folded into CE-022: no deleted-concept word — Computed, Sensor, Collection — may
survive in a public options type; `DeriveSignalOptions` becomes the single options type of
the single-value derive family), and a task to chase the `recomputeTask` retention despite
the headroom — minimal bundle size is never left on the table (CE-024).

**Le Truc round 2 (PR #78, 2026-08-15) — disposition of each point:**

- **§2 `deriveCollection` not deprecated in 1.5:** agreed, it is the "born deprecated"
  hazard in mirror image. The top-level function is already unexported (CE-014), so the
  marker matters on the `.deriveCollection()` **method** → CE-026 marks it `@deprecated`
  in 1.5 with the mechanical `deriveList(source, fn)` rewrite; CE-022 removes it in v2.
- **§3 the Store flip has no bridge:** agreed, and it is a gap CE-016 itself missed — its
  "no meaning flip" reasoning was wrong for `Store` (1.x mutable → 2.0 readonly base, the
  same structure as the `List` flip it flagged as most error-prone). → CE-025 back-ports
  `MutableStore`/`isMutableStore` with `@deprecated` markers and codemod rules, mirroring
  the List treatment; CE-027 adds the Store flip (and the guard flips) to ADR-0018's
  Negative Consequences, which omits them today.
- **§4a `CollectionSource` intent:** v2 renames it to `ListSource` (CE-022);
  `MIGRATION-2.0.md` must say so explicitly, including that the codemod's exact-identifier
  rules will *not* catch the rename (longer name) → CE-026.
- **§4b codemod `--module`:** verified — it is a substring match on the module specifier
  (`tools/codemod-v2.ts:149`), so `--module @zeix/le-truc` behaves as Le Truc intends.
  Documented with substring semantics called out → CE-025.
- **§4c single-major bridge names:** agreed; `MIGRATION-2.0.md` must state plainly that
  `DerivedList`/`DerivedStore` rename once more at 2.0 and only `MutableList` is terminal
  vocabulary → CE-026.
- **§5 Le Truc 2.5/3.0 commitments:** noted in CE-011. One correction their plan implies:
  the reconcile widening should go through `deriveList(source, itemFn)` — the top-level
  `deriveCollection` has been unexported since CE-014 and the keyedAdapter machinery is
  reachable only through `deriveList`.

CE-005..CE-008 are now marked `— reviewed ✓` in TODO.md; ADR-0018's Status line stays
"Proposed" until CE-022/CE-023 land (CE-027 moves it — that is the CE-021 gate input).
