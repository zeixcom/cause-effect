# NOTES

No open blockers.The CE-013 bundle finding is resolved as a policy change rather than a code change. The full-library
minified and gzipped figures move in opposite directions under deduplication, so treating the
gzipped number as a hard constant selected against consolidating duplicated code. The two figures
now have separate roles — see REQUIREMENTS.md § Bundle Size and the Key Decisions row in
ARCHITECTURE.md:

- **Core, ≤ 3072 B gzipped** — a hard promise, never relaxed. Tree-shaking means this is what a
  typical consumer actually ships.
- **Full library, ≤ 28672 B / ≤ 10240 B** — a working diagnostic against accidental blowup,
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
