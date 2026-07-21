# TODO

- [x] CE-001: `List.get()` never establishes child-signal edges on first read, leaving reads permanently stale — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts:367-370` (comment + removed the `node.flags = 0` reset after init); `test/list.test.ts` (new regression test in the `Reactivity` describe block, `get() reacts to a nested Store field set directly, with no prior List mutation`).
  **How:** Removed the line that overwrote the node's `flags` from `FLAG_DIRTY` (its object-literal default) to `0` right after item initialization. That reset was the actual bug — `git blame` traces it back to the original `MemoNode` refactor (`50fa666`, "Clear dirty flag after initialization - initial value is correct"), which conflated "the cached value is already correct" with "no tracked recompute is needed." Those are different: the value being correct doesn't establish the child→list graph edges that `get()`'s first-access branch depends on `refresh()`/`recomputeMemo()` to create. With the node clean at init, `refresh()` no-ops on the very first `get()`, `buildValue()` is never invoked tracked, and `node.sources` stays `null` forever unless a mutation method (`add`/`remove`/`splice`/etc.) later forces `FLAG_DIRTY | FLAG_RELINK` explicitly. Left `node.value = value` in place (still correct/needed) and did not touch the `FLAG_RELINK` branch inside `get()`'s fast path (`list.ts:405`) — that one already correctly sets `FLAG_DIRTY`, not `0` (the TODO's suggestion that it also needed fixing was based on a stale scratch-copy during triage, not the real source).
  **Verified:** `FLAG_DIRTY` alone (no `FLAG_RELINK`) is sufficient at init — there's no prior edge set to reconcile against on the very first computation, so this is identical to how every other `MemoNode` (plain `createMemo`) initializes. Confirmed by running the full suite: `bun test` → 585 pass / 0 fail across 21 files, including the existing `mutation tracking leak` tests (which cover mutation methods called *before* the first `get()` — the scenario the old "starts clean" comment was trying to protect) and the bundle-size/performance regression tests (no measurable impact from a one-line removal). New regression test reproduces the exact reported repro (nested `Store` item, `list.get()` read inside an effect, then `list.byKey(key).amount.set(...)` with no `List` mutation method ever called) and fails on the pre-fix code, passes after.
  **Context:** Reported by Le Truc team (`BUG-nested-composite-primitives.md`, Bug 1) while building `examples/module/calctable`. Confirmed by direct repro against this repo's source (see below) — root cause identified precisely.

  **Root cause:** `src/nodes/list.ts:369-370`, in `createList()`:
  ```js
  node.value = value
  node.flags = 0   // <-- BUG: should be FLAG_DIRTY
  ```
  The comment above this ("Starts clean... refresh() on first get() is not needed") is wrong for the pure-read case. `List.get()`'s first-access branch relies entirely on `refresh(node)` to run `recomputeMemo()` (which tracked-calls `buildValue()` and thereby links each child item signal as a source of the list's node). But `refresh()` only calls `recomputeMemo()` when `node.flags & FLAG_DIRTY` is set — since the node starts at `flags = 0`, `refresh()` takes the "already clean" branch and does nothing. Result: `buildValue()` is never invoked in a tracked context, `node.sources` stays `null` forever (unless a structural mutation like `add()`/`remove()`/`splice()` explicitly sets `FLAG_DIRTY | FLAG_RELINK`), and `node.value` stays pinned to the original array reference — even a fresh untracked `list.get()` returns stale data. This is why the control case (`createStore` alone, no `List`) works fine: `Store`'s node is not subject to this codepath issue in isolation, but any composite reading a nested mutable-item signal through `List.get()`'s child-linking never converges.

  See **How**/**Verified** above for the applied fix and its verification.

- [ ] CE-002: `Collection`'s `ensureFresh()` "eager re-entrant access" path silently drops changed-cascade to downstream sinks
  **Skill:** cause-effect-dev
  **Context:** Reported by Le Truc team (`BUG-nested-composite-primitives.md`, Bug 2) as a `reconcile()`-triggered issue involving per-item reader disposal. Investigated further — disposal is not actually the trigger; root cause is a two-step recompute pattern in `ensureFresh()` that can be reached via any eager out-of-band `.byKey()`/`.get()`/`.keys()` call on a `Collection`, independent of `List`/`Store`/disposal. Minimal 20-line repro (no `Store`, no `reconcile()`, no scope disposal at all):
  ```js
  const list = createList([{ id: 'item1', amount: 3, pricePerUnit: 12.5 }], { keyConfig: item => item.id })
  const rowPrices = list.deriveCollection(item => item.amount * item.pricePerUnit)
  const priceTotal = createMemo(() => rowPrices.get().reduce((s, v) => s + v, 0))

  // An effect that eagerly touches rowPrices.byKey() for every key, registered
  // BEFORE the effect that consumes priceTotal (mirrors reconcile()'s driving
  // effect running before/alongside the aggregate consumer):
  createEffect(() => { for (const key of list.keys()) rowPrices.byKey(key) })
  const seen = []
  createEffect(() => seen.push(priceTotal.get()))

  list.add({ id: 'item2', amount: 5, pricePerUnit: 8 })
  console.log(seen) // stuck at [37.5] forever — expected [37.5, 77.5]
  ```

  **Root cause:** `src/nodes/collection.ts`, `ensureFresh()`:
  ```js
  function ensureFresh(): void {
      if (node.sources) {
          if (node.flags) {
              node.value = untrack(buildValue)        // (1) untracked pre-update
              if (node.flags & FLAG_RELINK) {
                  node.flags = FLAG_DIRTY
                  refresh(node as unknown as SinkNode)  // (2) tracked recompute
                  ...
  ```
  When this function is invoked via a direct API call (`.byKey()`, `.get()`, `.keys()` — NOT via the graph's own `refresh()` cascade from an already-queued effect) while the node is `DIRTY | RELINK` and has a downstream sink still sitting at `FLAG_CHECK` (queued earlier in the same top-level `propagate()` pass but not yet processed), the two-step shape breaks the change-detection cascade: step (1) mutates `node.value` to the new result *before* any tracked comparison happens; step (2)'s `recomputeMemo()` then compares the freshly-built `next` against the *already-updated* `node.value` — always structurally equal — so `changed` is `false`, and `recomputeMemo`'s `if (changed) { promote CHECK sinks to DIRTY }` cascade never fires. The downstream sink (here `priceTotal`) is left at `FLAG_CHECK` forever; the generic `refresh()` machinery only recomputes on `FLAG_DIRTY`, so it's silently skipped and never catches up, even on later reads.

  This is why the bug "disappears" with a no-op `bindItem` (per the original report) — without an eager out-of-band `.byKey()` call racing ahead of the normal effect-queue-driven `refresh()` cascade, `ensureFresh()`'s buggy branch is never actually reached before the node is already clean.

  **Scope note:** the identical two-step `untrack(buildValue)` **then** `if (relink) { flags = DIRTY; refresh(node) }` shape also exists in `List.get()`'s fast path (`src/nodes/list.ts:394-407`), `Store.get()`'s fast path (`src/nodes/store.ts:297-310`), and `createCollection`'s `get()` (`src/nodes/collection.ts:503-516`) — all four structural-tracking nodes share this pattern. Audit whether the same "eager re-entrant access races ahead of the effect queue" scenario can trigger the same silent-drop in the other three, or whether it's specific to `Collection`'s additional `ensureFresh()` no-subscriber/first-access branching; fix the shared root cause once rather than patching each site separately if they turn out to share one.
