# TODO

Shape-indexed signal types — [ADR-0018](adr/0018-shape-indexed-signal-types.md), target v2.0.

Tasks are ordered. CE-001 through CE-004 close the derivation gaps and are **additive** — they can
land on 1.x and be validated before any breaking change is committed. CE-005 onward are breaking
and belong on a `v2` branch. Do not start CE-005 until CE-001..CE-004 are reviewed and the v2.0
decision is confirmed.

---

- [ ] CE-001: Add `deriveStore(input, options?)`
  **Skill:** cause-effect-dev
  **Context:** The keyed-record shape has no derivation at all — see the matrix in ADR-0018 §Context. Add a factory returning the existing readonly view of `Store<T>` (no `set`/`update`/`add`/`remove` on the returned type). Accept a sync function, an async function (with `options.initial` required — ADR-0018 §6), or a seed value with `options.watched`. Dispatch with `isAsyncFunction` (`src/util.ts:11`) → task path, other function → memo path, non-function → external-push path. Implement the recompute by applying the result through the diff already in `createStore`'s `set()` so child-signal identity is preserved by key; do not rebuild children. Reuse `FLAG_RELINK` + two-path access (ADR-0010, ADR-0014) exactly as `createStore` does. `watched` signature per ADR-0018 §4: `(emit: (patch: Partial<T>) => void) => Cleanup` for the seed form, `() => Cleanup` for the function form.

- [ ] CE-002: Widen `deriveCollection` to accept any `Signal<U[]>` source
  **Skill:** cause-effect-dev
  **Context:** `deriveCollection` (`src/nodes/collection.ts:126`) restricts its source to `CollectionSource<U>`, so a `Task<U[]>` or `Memo<U[]>` cannot be turned into a keyed sequence. This single restriction is what forces the write-from-effect pattern in the most common async pipeline. Widen the source parameter to accept any `Signal<U[]>`, keeping the existing per-item `Memo`/`Task` memoization: when the source is not already keyed, derive keys with the same `keyConfig` mechanism `createList` uses (`src/nodes/list.ts:283`). Keep the existing `CollectionSource` fast path — a source that is already a List or Collection must not lose its stable keys or regress in the performance suite.

- [ ] CE-003: Add `deriveList(input, options?)`
  **Skill:** cause-effect-dev
  **Context:** Depends on CE-002. Add the keyed-sequence counterpart to CE-001, with the same three input forms plus a fourth: `deriveList(source, itemFn, options?)` (the widened `deriveCollection` from CE-002, which becomes its implementation). `options.initial` required for the async form. Returns the readonly type — no `set`/`update`/`add`/`remove`/`replace`/`sort`/`splice`. `watched` signature: `(emit: (changes: CollectionChanges<T>) => void) => Cleanup` for the seed form, matching today's `CollectionCallback` (`src/nodes/collection.ts:110`).

- [ ] CE-004: Add `isPending(signal)` and `abort(signal)` graph utilities
  **Skill:** cause-effect-dev
  **Context:** Per ADR-0018 §2, these become shape-agnostic free functions exported from `src/graph.ts` alongside `batch`/`untrack`. `isPending` must stay reactive — subscribe to the `pendingNode` exactly as `Task.isPending()` does today (ADR-0001), returning a non-tracking `false` for a node with no `pendingNode`. `abort` calls `controller.abort()` for a node with an `AsyncFields` mixin and is a no-op otherwise. Async composites from CE-001 and CE-003 must carry a `pendingNode` so both utilities work on them. Keep `Task.isPending()` / `Task.abort()` as methods for 1.x compatibility; they delegate to the new functions.

---

- [ ] CE-005: Collapse the type vocabulary to shape × mutability
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking — `v2` branch only. Per ADR-0018 §1. Define `Signal`/`MutableSignal`, `List`/`MutableList`, `Store`/`MutableStore` as the complete value-type set; delete `State`, `Memo`, `Task`, `Sensor`, and `Collection` as type names. Change `Symbol.toStringTag` to carry the shape (`'Signal' | 'List' | 'Store'`) and update `isSignalOfType` call sites accordingly. Replace the origin guards (`isState`, `isMemo`, `isTask`, `isSensor`, `isCollection`, `isComputed`) with shape guards (`isSignal`, `isList`, `isStore`, `isMutableSignal`, `isMutableList`, `isMutableStore`). `isSlot` is unchanged; `Slot` stays out of scope entirely (it abstracts over `{ get, set? }` and ignores other methods by design). Note the migration hazard called out in ADR-0018 §Consequences: `List<T>` changes meaning from mutable to readonly, so existing code typed `List<T>` and calling `.add()` breaks at the type level.

- [ ] CE-006: Introduce `createSignal` / `deriveSignal` and retire the composite façades
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking — depends on CE-005. Per ADR-0018 §3 and §5. `createSignal(value, options?)` → `MutableSignal<T>`; `deriveSignal(input, options?)` → `Signal<T>` with the three-way dispatch. Retain `createState`, `createMemo`, `createTask`, and `createSensor` as narrow single-origin entry points returning the collapsed types — this is a tree-shaking requirement, not compatibility (see REQUIREMENTS.md §Bundle Size). Remove `createComputed` and `createMutableSignal` (subsumed). The shape-sniffing coercion currently in `createSignal` (`src/signal.ts:87`) moves to a new `toSignal(value)`; Le Truc depends on that behaviour, so it must not simply disappear.

- [ ] CE-007: Move `watched` fully into options
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Breaking — depends on CE-006. Per ADR-0018 §4. `createSensor(watched)` and `createCollection(watched)` currently take the callback in the first position, which is indistinguishable at runtime from a sync derivation callback. Normalize both to the option form. Unify the `watched` signature across shapes: `(emit) => Cleanup` when the input is a seed value, `() => Cleanup` (invalidation only) when the input is a function — the latter is today's Memo `watched`. Verify the lazy `watched`/`unwatched` lifecycle is unchanged; it is pinned by existing tests.

- [ ] CE-008: Re-measure bundle budgets and update the regression thresholds
  **Skill:** cause-effect-dev
  **Context:** Depends on CE-007. ADR-0018 §Consequences flags the full-library budget (24 kB min / 8 kB gz, REQUIREMENTS.md §Bundle Size) as not guaranteed to hold. Merging `Collection` into `List` should offset some of the added surface. Verify the ≤4 kB core budget still holds with only `createState` + `createMemo` + `createEffect` imported — that is the specific reason the narrow factories were retained, so if it fails, CE-006 is wrong. Update `test/regression-bundle.test.ts` and report actual figures; do not raise a limit without saying so.

- [ ] CE-009: Rewrite the derivation guidance as a routing table
  **Skill:** tech-writer
  **Context:** Depends on CE-003. Per ADR-0018 §Context and REQUIREMENTS.md §Every Shape Is Derivable. In `GUIDE.md`, replace the normative "derive everything" framing with the mechanism: an effect-write is a dependency edge the graph cannot see, and the five consequences follow from that one fact (stale reads within a flush pass, lost `equals` suppression, no abort-on-change, no lazy lifecycle, the multi-pass `flush()` + `EffectConvergenceError` that exists to contain it). State the exception plainly — writing outward to DOM, network, or storage is what an effect is for. Then add the shape × origin matrix as a lookup table in `AGENTS.md`, `.github/copilot-instructions.md`, and `CONTEXT.md`, phrased as "you have Y, you want X → call Z". The table is the point: a prohibition is not actionable by a code-generating model, a routing table is.

- [ ] CE-010: Update the embedded skill references
  **Skill:** tech-writer
  **Context:** Depends on CE-009. `.agents/skills/cause-effect/references/signal-types.md` and `.agents/skills/shared/references/api-facts.md` embed the 9-type taxonomy and are loaded by both the `cause-effect` and `cause-effect-dev` skills. They are the highest-leverage surface for the AI-misuse problem, since they are read before any code is written. Update to the shape-indexed taxonomy and the construction matrix. Check `CONTEXT.md` for vocabulary entries that need an _Avoid_ list — `Collection` and `Sensor` become disallowed synonyms for `List` and the external-push construction form.

- [ ] CE-011: Coordinate the Le Truc migration
  **Skill:** cause-effect-dev
  **Context:** ⚠️ Blocking for the v2.0 release, not for the branch. Le Truc consumes `isState`/`isMemo`/`isTask`/`isCollection`, the `createSignal` shape coercion, and `Slot`. Audit its usage against CE-005..CE-007, write the migration notes, and confirm the `Slot` integration layer is genuinely unaffected — ADR-0018 assumes it is because `Slot` abstracts over `{ get, set? }` only. If that assumption fails, raise it in `NOTES.md` rather than widening `Slot`'s scope unilaterally.
