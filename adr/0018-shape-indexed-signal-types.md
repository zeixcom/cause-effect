# ADR 0018: Shape-Indexed Signal Types

## Status

✅ Accepted — 2026-08-19 (for v2.0)

Amends [ADR-0001](0001-reactive-task-stale-detection.md) (scope of `isPending`).

This ADR is binding for v2.0. It also regulates the 1.x bridge — vocabulary backported ahead of
2.0 to teach it only once — but does not itself govern day-to-day 1.x maintenance beyond that
bridge.

## Context

The library ships nine signal types in v1.x, indexed by two axes at once — **shape** (single value, keyed sequence, keyed record) and **origin** (mutable source, sync derivation, async derivation, external push). Nine names cover that matrix only partially, and one cell is restricted:
`deriveCollection` accepts only a `CollectionSource<U>`, so a `Task<U[]>` or `Memo<U[]>` cannot become a keyed sequence. The most common async pipeline — fetch an array, key it, render per item — has no derivation path.

The observed consequence: authors reach for the discouraged pattern of writing an async result into a mutable `Store` by hand in an effect. Documentation cannot fix this; it is the only door.

Two further observations motivate collapsing the type set, not just filling the matrix:

1. `Sensor` is a `State` with a lazy `watched` lifecycle and no setter — it reuses `StateNode`.
2. `Collection` is a `List` without mutators — both are `MemoNode<T[]>` with the same lookup surface.

Both pairs are a mutability distinction wearing the costume of a type distinction.

## Decision

### 1. Types are indexed by shape and mutability only

Three shapes, each with a readonly base and a mutable extension, under one umbrella:

```ts
Signal<T>              get             // umbrella — structural, no tag of its own

Cell<T>                ⊃ Signal<T>     get
MutableCell<T>         ⊃ Cell<T>       + set, update

List<T, S>             ⊃ Signal<T[]>   + length, at, byKey, keyAt, indexOfKey, keys, [Symbol.iterator]
MutableList<T, S>      ⊃ List<T, S>    + set, update, add, remove, replace, sort, splice

Store<T>               ⊃ Signal<T>     + keys, byKey, proxy reads
MutableStore<T>        ⊃ Store<T>      + set, update, add, remove
```

`State`, `Memo`, `Task`, `Sensor`, and `Collection` cease to exist as type names. A consumer programs against the shape it needs and whether it may write; how the value came to exist is not part of the consumption contract.

`Symbol.toStringTag` carries the shape as a literal — `'Cell' | 'List' | 'Store'`, not an optional `string` — so a `List` is never structurally assignable to `Cell<T>` merely by having `get()`.
`Signal` carries no tag; membership is structural (`typeof x?.get === 'function'`), which is also the recipe for "is this any reactive value at all." This mirrors the TC39 Signals proposal, which namespaces `Signal.State`/`Signal.Computed` under `Signal` as an umbrella, not a primitive.

`Effect` and `Slot` are unaffected: `Effect` is a terminal sink with no value, `Slot` an integration-layer abstraction over `{ get, set? }` that ignores every other method.

### 2. `isPending` and `abort` become graph utilities

Keeping them as `Task` methods after the collapse would force `AsyncSignal`/`AsyncList`/`AsyncStore` subtypes and restore a nine-name taxonomy; adding them to base `Signal<T>` costs a closure per node on the synchronous hot path. They become free functions instead:

```ts
isPending(signal): boolean   // reactive; false for a signal with no async origin
abort(signal): void          // no-op for a signal with no async origin
```

The internal `pendingNode: StateNode<boolean>` mechanism of ADR-0001 is unchanged; only the accessor moves and its domain widens to derived `List`/`Store`, which no current API expresses.

### 3. Factories are indexed by origin: `create*` and `derive*`

```
create{Cell,List,Store}(value, options?)   → Mutable{Cell,List,Store}
derive{Cell,List,Store}(input, options?)   → {Cell,List,Store}
```

`create*` takes a value and yields a writable signal.

`derive*` yields a readonly signal and dispatches on `input`:

| `input` | `options` | Origin | Replaces |
|---|---|---|---|
| sync function | — | sync derivation | `createMemo`, `deriveCollection` |
| async function | `initial` required for List/Store | async derivation | `createTask` |
| seed value | `watched` required | external push | `createSensor`, `createCollection` |
| source signal + item function | — | per-item derivation (List/Store only) | `deriveCollection(source, fn)` |

`derive{List,Store}` accept any `Signal<U[]>`/`Signal<U>` as source, not only a `List`/`Collection` — this closes the async-to-composite gap that motivated the ADR.

### 4. `watched` is an option, never a callback position

Sync derivation and external push cannot be distinguished at runtime — both are plain,
arity-≤1, synchronous functions with opposite timing and no way to inspect which is which. Async derivation *is* distinguishable (`isAsyncFunction`, `src/util.ts:11`). `watched` therefore lives entirely in options:

| Input kind | `watched` signature | Meaning |
|---|---|---|
| seed value | `(emit) => Cleanup` | External source drives the value |
| function | `() => Cleanup` | External event invalidates the derivation |

`emit` is shape-appropriate: `emit(value: T)` for `Cell`, `emit(changes: ListChanges<T>)` for `List`, `emit(patch: Partial<T>)` for `Store`. The two signatures are expressed as overload-narrowed option types keyed on input kind, not a single union — a union breaks contextual typing of inline callbacks (the parameter degrades to implicit `any`).

### 5. Two narrow entry points survive

```
createCell(value, options?)      → MutableCell<T>   (alias: createState)
deriveComputed(fn)               → Cell<T>          (sync derivation only)
deriveCell(input, options?)      → Cell<T>          (sync, async, or external push — general dispatcher)
```

A bundle using only `createState`, a sync derivation, and `createEffect` must not pull in `AbortController`, the task recompute path, or the watched lifecycle. `createTask` and `createSensor` are **dropped as public factories, not renamed**: the tree-shaking rationale doesn't hold for them — async derivation pulls the recompute/`AbortController` machinery regardless of which name constructs it, and `Sensor`'s external-push use case is rare enough not to warrant a dedicated name. Both origins remain reachable through `deriveCell`, which already imports that machinery for
any non-sync input.

No equivalent split is made for `List`/`Store`: a composite already pulls the structural node and per-item children, so the marginal cost of the async/watched paths doesn't justify four more factory names per shape.

Guards realign: `isCell`/`isMutableCell` replace `isSignal`/`isMutableSignal` (same tag-plus-`get()` check, now targeting `'Cell'`). `isList`/`isMutableList`/`isStore`/`isMutableStore` are unchanged in behavior, only in tag literal. The umbrella guards `isSignal`/`isMutableSignal` keep their v1.x meaning. They are structural checks like `typeof x?.get === 'function'`.

`errors.ts`'s `NullishSignalValueError`, `UnsetSignalValueError`, `ReadonlySignalError`, and `validateSignalValue` keep their `Signal`-scoped names, now correctly umbrella-scoped since each can fire for any shape.

### 6. Async composites are never unset

`deriveList`/`deriveStore` with an async input require `options.initial`, so `length`, `at()`, `byKey()`, and iteration never throw and no consumer needs `match()` merely to read a derived collection. `isPending()` distinguishes loading-empty from resolved-empty.

`deriveCell` with an async input keeps the current `Task` behavior —
`UnsetSignalValueError` until first resolution, which `match()`'s `nil` branch depends on — and gains `initial` as an optional escape from it.

### 7. Derived composites derive their slices; they do not write them

Each key of a derived composite gets its own `Cell` that reads the source and selects its own slice. Children are *derived*, not written — same outcome as the discouraged hand-written effect, but with the dependency edge visible to the graph. Per-slice `equals` stops propagation for an unchanged property or item.

**Derived records do not recurse into nested values.** `createStore` nests because a *write* needs a target (`store.address.city.set(…)`); a derived record has no writes, so recursion has no target and would only be an unrequested read optimization. A caller wanting sub-path granularity composes `deriveStore`/`deriveList` on the property directly.

The mechanisms in ADR-0010 (`FLAG_RELINK`), ADR-0014 (two-path access), ADR-0015 (structural lookup edges), and ADR-0017 (proxy write rejection) apply unchanged.

### 8. 1.x bridge: `Cell`/`MutableCell` types and guards

The 1.x bridge backports this ADR's vocabulary ahead of 2.0 so it is taught only once. The factory half of the bridge — `createCell`, `deriveCell`, `DeriveCellOptions` — leaves a gap: `deriveCell` declares its return type as bare `Signal<T>`, wider than necessary, since `deriveCell` can only ever produce a `State`, `Memo`, `Task`, or `Sensor` — never a `List`/`Store`/`Collection` — but nothing in 1.x expresses that narrower guarantee at the type level. The bridge extends to the type-level half to close it:

- `type Cell<T> = State<T> | Memo<T> | Task<T> | Sensor<T>`, exported alongside the other Cell-specific 1.x code. A genuine structural narrowing, not just a rename: each 1.x origin already carries a distinct `Symbol.toStringTag` literal (`'State'|'Memo'|'Task'|'Sensor'`), so the union excludes `List`/`Store`/`Collection` at the type level with no runtime tag change — 1.x does not yet have the single collapsed `'Cell'` tag decision 1 defines for 2.0; this backport achieves the same *exclusion* property through the union instead. A fresh structural interface `{ get(): T }` was considered and rejected for this role: it is identical to `Signal<T>`'s existing definition, so it would not actually exclude `List<T>`/`Store<T>` at the type level.
- `type MutableCell<T> = State<T>` — an alias, matching decision 5's `createCell(value, options?) → MutableCell<T>` (aliasing `createState`).
- `deriveCell`'s overloads narrow their return type from `Signal<T>` to `Cell<T>`; `createCell` narrows from `State<T>` to `MutableCell<T>`. Both are widening-safe: every `Cell`/`MutableCell` value already satisfies `Signal`/`MutableSignal` structurally, so no existing caller's code breaks.
- `isCell(value): value is Cell<T>` and `isMutableCell(value): value is MutableCell<T>` — the single-value-shape guards, checking `Symbol.toStringTag` membership in `{'State','Memo','Task','Sensor'}`. `isSignal`/`isMutableSignal` stay unchanged as the umbrella guards.

## Alternatives Considered

- **Fill the matrix, keep nine type names.** Closes the derivation gap but leaves `.set()` reachable on things that shouldn't have it. Rejected — the gap and the mutability leak reinforce each other.
- **Document the prohibition harder.** Rejected — a training-set prior isn't answerable by prose; the corrective needs to be a compile error.
- **Three factories, `create{Cell,List,Store}(valueOrFn, options)`.** Rejected — can't distinguish sync derivation from external push at runtime, and pulls async/watched machinery into every plain `create*` call.
- **Twelve factories, `create{Origin}{Shape}`.** Rejected — worse name-to-type ratio than the status quo; tree-shaking benefit only real for the single-value shape, which decision 5 already covers.
- **`isPending`/`abort` on base `Signal<T>`.** Rejected — a closure per node on the hot path, paid by every signal for a capability most don't have.
- **`Collection`/`MutableCollection` in place of the `List` flip.** Rejected on vocabulary grounds — `CONTEXT.md` flags `Collection` as reconstructed by LLMs as a reactive `Map`; a training-set prior isn't fixed by keeping the name.
- **Fresh name `Sequence`/`MutableSequence`.** Rejected — dominant prior (Kotlin/C#/F#/LINQ) reads as lazy/single-pass, contradicting this type's stable per-item identity.
- **Keep `Signal` as umbrella, name the single-value shape `State`.** Rejected — `State` re-imports the mutable-origin connotation the collapse exists to delete, and recruits the same Solid/Preact/Angular `signal()` prior this ADR is trying to avoid for the flagship name.
- **`Atom` for the single-value shape (Jotai).** Rejected — evokes a *definition* consumed via a hook, not a live, immediately usable cell; `Cell` (Cellx and Starbeam precedent, spreadsheet metaphor) has the opposite risk profile — unfamiliarity, fixable with one line of docs, not a wrong mental model.

## Consequences

**Positive**

- Every shape can be derived from every origin; the empty cells in the matrix are gone.
- Nothing derived exposes `.set()` — the discouraged pattern becomes a compile error.
- `Collection` and `Sensor` disappear as concepts.
- `isPending()` extends to composites, currently inexpressible.
- The type surface drops from nine names to six, plus two orthogonal primitives (`Effect`, `Slot`).

**Negative**

- Breaking. Every consumer naming `State`, `Memo`, `Task`, `Sensor`, `Collection`, or calling `task.isPending()` as a method, must migrate.
- `List<T>` and `Store<T>` flip meaning: today mutable, under this ADR the readonly base. Code that types a variable `List<T>`/`Store<T>` and calls `.add()`/`.set()` breaks at the type level in unchanged code. Mitigated by a 1.x back-port of `MutableList`/`MutableStore` and shape guards with `@deprecated` markers, plus a codemod.
- `createSignal`'s current shape-sniffing (array → `List`, record → `Store`) is removed with no replacement export; callers needing that coercion write three lines against `createList`/`createStore`/`createState` and `isRecord`.
- `createComputed`/`createMutableSignal` are subsumed by `deriveCell`/`createCell`.
- The full-library bundle budget must be re-measured: `Collection` merging into `List` and the narrower public factory surface (two entry points instead of four) both push toward smaller, but the ≤3 kB core target is not yet re-verified against the renamed surface. Measured core for the create/derive/effect trio at time of writing: 2072 B gzipped, 48.3% headroom under budget.
- `Slot<T>` stays shape-agnostic — a slotted `List` is consumed as `Signal<T[]>` and loses `at()`/`byKey()`. Deliberately out of scope.

**Neutral**

- Guards become shape-indexed: `isCell`, `isList`, `isStore`, `isMutableCell`, `isMutableList`, `isMutableStore`, targeting `'Cell'`/`'List'`/`'Store'` tags. The origin guards `isState`, `isMemo`, `isTask`, `isSensor`, `isCollection` have no referent after the collapse and are removed. `isSignalOfType` remains the shared primitive.
