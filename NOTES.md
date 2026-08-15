# NOTES

No open blockers.

The CE-013 bundle finding is resolved as a policy change rather than a code change. The full-library
minified and gzipped figures move in opposite directions under deduplication, so treating the
gzipped number as a hard constant selected against consolidating duplicated code. The two figures
now have separate roles — see REQUIREMENTS.md § Bundle Size and the Key Decisions row in
ARCHITECTURE.md:

- **Core, ≤ 4096 B gzipped** — a hard promise, never relaxed. Tree-shaking means this is what a
  typical consumer actually ships.
- **Full library, ≤ 32768 B / ≤ 10240 B** — a working diagnostic against accidental blowup,
  re-baselined from measurement at release by **CE-015**, and explicitly not defended during a
  refactor.

## CE-005 finding: `MutableStore<T>` is not a checkable structural subtype of `Store<T>`

Not a blocker — worked around, did not stop the branch. Recorded because ADR-0018 §1's table
states `MutableStore<T> ⊃ Store<T>`, and this is only true in the loose, "assignable value at a
concrete key" sense, not as a TypeScript-checkable generic subtype.

`Store<T>.byKey<K>()` returns a uniform `Signal<T[K] & {}> | undefined` (deriveStore does not
recurse into nested shapes — ADR-0018 §7). `MutableStore<T>.byKey<K>()` must return the granular
`MutableList<U> | MutableStore<T[K]> | MutableSignal<T[K] & {}>` conditional type, because
`createStore` *does* recurse and a nested array needs `.add()` to work. Assigning a concrete
`MutableStore<{ a: number }>` to a `Store<{ a: number }>`-typed variable makes `tsc` try to verify
the generic method signature `byKey<K>()` abstractly over all `K`, expands the conditional over
its full domain (including the `MutableList` branch), and fails — even though every concrete `K`
resolves to a compatible, covariant branch. `List`/`MutableList` do not hit this because
`MutableList<T,S> = List<T,S> & {...}` shares one generic item-signal parameter `S` instead of a
per-key conditional return.

Consequence for CE-006/CE-007: do not write code (or tests) that assigns a `MutableStore<T>`
value to a `Store<T>`-typed binding for a generic `T`. Read the mutable store and pass its
snapshot, or narrow to a concrete `T` first. `isStore`/`isMutableStore` and `.get()` still work
correctly at runtime — this is a `tsc`-only limitation.

## CE-008 finding: the sync-only core bundle retains `recomputeTask` through `refresh()`'s dispatch

Not a blocker — the ≤ 4096 B core budget holds at 2291 B gzipped (trio entry), 44 % headroom.
Recorded because ADR-0018 §5 makes a stronger mechanism claim than the bundler delivers: "a
bundle that uses only `createState`, a synchronous derivation, and `createEffect` must not pull
in `AbortController` [or] the task recompute path". It does. `refresh()` in `src/graph.ts`
dispatches on `'controller' in node → recomputeTask(node)`, so `recomputeTask` and its
`new AbortController` are reachable from any `refresh` user and survive tree-shaking.

This predates the v2 branch — CE-005 touched only `refresh()`'s error message, not the dispatch.
It was invisible before CE-008 because the core regression entry imported `createTask`
explicitly, so the check never exercised the sync-only claim. The retained bytes are small: the
Task-inclusive composition measures 2565 B against the trio's 2291 B, so the leaked recompute
path plus the Task factory together cost ~270 B gzipped.

If the strict no-async-bytes property is ever wanted, the task recompute path must move out of
`graph.ts`'s `refresh` dispatch — for example a node-stored recompute closure set by
`createTask`, keeping `refresh` shape-agnostic. That is a structural change outside CE-008's
scope; the byte promise it would serve already holds.

One positive verification worth keeping: CE-006's façade tree-shakes correctly. A
`createSignal` + `createMemo` + `createEffect` entry measures 2302 B gzipped (+11 B over
`createState`) with `deriveSignal` — and with it the async and watched machinery it legitimately
pulls — fully eliminated. The façade does not weaken the core budget; only `deriveSignal` pays
for the three-way dispatch, exactly as ADR-0018 §5 intends.
