# ADR 0018: Shape-Indexed Signal Types

## Status

📝 Proposed — target v2.0. No commitment to ship.

Amends [ADR-0001](0001-reactive-task-stale-detection.md) (scope of `isPending`). Supersedes no
existing ADR: the mechanisms in ADR-0010, ADR-0014, ADR-0015, and ADR-0017 are reused unchanged.
The taxonomy this ADR replaces lives in `REQUIREMENTS.md`, not in an ADR.

## Context

The library ships nine signal types. They are indexed by two independent axes at once — the
**shape** of the data (single value, keyed sequence, keyed record) and the **origin** of the value
(mutable source, sync derivation, async derivation, external push). Nine names cover that
four-by-three matrix only partially:

| | mutable source | derived sync | derived async | external push |
|---|---|---|---|---|
| **single value** | `State` | `Memo` | `Task` | `Sensor` |
| **keyed sequence** | `List` | `deriveCollection` — source restricted to List/Collection | — | `Collection` |
| **keyed record** | `Store` | — | — | — |

Four cells are empty and one is restricted. The restriction matters most: `deriveCollection`
accepts a `CollectionSource<U>`, so a `Task<U[]>` or `Memo<U[]>` cannot be turned into a keyed
sequence. The most common asynchronous pipeline in application code — fetch an array, key it,
render per item — therefore has no derivation path.

The observed consequence is that authors, and language models trained predominantly on libraries
where imperative writes are the only mechanism, reach for the discouraged pattern:

```ts
// Discouraged, but currently the only way to get a Store from a Task.
const user = createTask(async () => fetchUser(id.get()))
const store = createStore({ name: '', email: '' })
createEffect(() => store.set(user.get()))
```

Documentation cannot fix this. The pattern is not a lapse in discipline; it is the only door.

Two further observations motivate collapsing the type set rather than only filling the matrix:

1. `Sensor` is a `State` with a lazy `watched` lifecycle and no setter. It reuses `StateNode`
   outright.
2. `Collection` is a `List` without mutators. Both are `MemoNode<T[]>` and expose the same lookup
   surface (`at`, `byKey`, `keyAt`, `indexOfKey`, `keys`, `length`, iterator).

Both pairs are already a mutability distinction wearing the costume of a type distinction. The
vocabulary for the distinction also already exists: `Signal<T>` and `MutableSignal<T>` in
`src/signal.ts`.

## Decision

### 1. Types are indexed by shape and mutability only

Six value types, in three shapes, each with a readonly base and a mutable extension:

```ts
Signal<T>            get()
MutableSignal<T>     ⊃ Signal<T>      + set, update

List<T, S>           ⊃ Signal<T[]>    + length, at, byKey, keyAt, indexOfKey, keys, [Symbol.iterator]
MutableList<T, S>    ⊃ List<T, S>     + set, update, add, remove, replace, sort, splice

Store<T>             ⊃ Signal<T>      + keys, byKey, proxy reads
MutableStore<T>      ⊃ Store<T>       + set, update, add, remove
```

`State`, `Memo`, `Task`, `Sensor`, and `Collection` cease to exist as type names. A consumer
programs against the shape it needs and against whether it may write. How the value came to exist
is not part of the consumption contract.

`Symbol.toStringTag` carries the shape — `'Signal' | 'List' | 'Store'` — not the origin.

`Effect` and `Slot` are unaffected. Both are orthogonal to shape: `Effect` is a terminal sink with
no value, and `Slot` is an integration-layer abstraction over `{ get, set? }` that ignores all
other methods of the signal bound to it.

### 2. `isPending` and `abort` become graph utilities

`Task` exposes `isPending()` and `abort()` as methods. Keeping them as methods after the collapse
would force `AsyncSignal`, `AsyncList`, and `AsyncStore` subtypes and restore a nine-name
taxonomy. Adding them to the base `Signal<T>` costs a closure per node on the synchronous hot path.

They become free functions alongside `batch`, `untrack`, and `match`:

```ts
isPending(signal): boolean   // reactive; false for a signal with no async origin
abort(signal): void          // no-op for a signal with no async origin
```

The internal `pendingNode: StateNode<boolean>` mechanism of ADR-0001 is unchanged; only the
accessor moves and its domain widens. Consumers gain the ability to ask an asynchronously derived
`List` or `Store` whether it is still loading, which no current API expresses.

### 3. Factories are indexed by origin: `create*` and `derive*`

```
create{Signal,List,Store}(value, options?)   → Mutable{Signal,List,Store}
derive{Signal,List,Store}(input, options?)   → {Signal,List,Store}
```

`create*` takes a value and yields a writable signal. `derive*` yields a readonly signal and
dispatches on `input`:

| `input` | `options` | Origin | Replaces |
|---|---|---|---|
| sync function | — | sync derivation | `createMemo`, `deriveCollection` |
| async function | `initial` required for List/Store | async derivation | `createTask` |
| seed value | `watched` required | external push | `createSensor`, `createCollection` |
| source signal + item function | — | per-item derivation (List/Store only) | `deriveCollection(source, fn)` |

`derive{List,Store}` additionally accept any `Signal<U[]>` or `Signal<U>` as a source, not only a
`List` or `Collection`. This is the restriction whose removal closes the async-to-composite gap.

### 4. `watched` is an option, never a callback position

Sync derivation and external push cannot be distinguished at runtime. Both are plain, arity-≤1,
synchronous functions — `(prev) => T` and `(apply) => Cleanup`. Neither can be called to find out
which it is: a derivation callback must stay lazy, and a `watched` callback must run when the
signal becomes observed. Opposite timing, no inspection available.

Async derivation *is* distinguishable. `isAsyncFunction` (`src/util.ts:11`) compares the
prototype against `AsyncFunction.prototype`, which is reliable for a native `async` function.
A hand-rolled function returning a thenable is not detected and is caught at the existing
`recomputeMemo()` choke point by `PromiseValueError`. That backstop is unchanged.

`watched` therefore moves entirely into options, where `Memo`, `List`, and `Store` already accept
it. Its signature depends on the input kind:

| Input kind | `watched` signature | Meaning |
|---|---|---|
| seed value | `(emit) => Cleanup` | External source drives the value |
| function | `() => Cleanup` | External event invalidates the derivation |

The `emit` argument is shape-appropriate: `emit(value: T)` for `Signal`,
`emit(changes: CollectionChanges<T>)` for `List` (today's `CollectionCallback`), and
`emit(patch: Partial<T>)` for `Store`.

### 5. The core four survive as narrow entry points

A bundle that uses only `createState`, a synchronous derivation, and `createEffect` must not pull
in `AbortController`, the task recompute path, or the watched lifecycle. `deriveSignal` handles
all three origins and therefore pulls all three.

`createState`, `createMemo`, `createTask`, and `createSensor` are retained as narrow,
single-origin, tree-shakable factories. They return the collapsed types (`MutableSignal<T>`,
`Signal<T>`) rather than distinct ones. `createSignal` and `deriveSignal` are façades that dispatch
to them.

No equivalent split is made for `List` and `Store`. A composite already pulls `State` for children,
`Memo` for the structural node, and the structural diff; the marginal cost of the async and
watched paths on top of that baseline does not justify four more factory names per shape.

### 6. Async composites are never unset

`deriveList` and `deriveStore` with an async input require `options.initial`. `length`, `at()`,
`byKey()`, and iteration therefore never throw, and no consumer needs `match()` merely to read a
derived collection. `isPending()` distinguishes loading-empty from resolved-empty.

`deriveSignal` with an async input keeps the current `Task` behaviour — `UnsetSignalValueError`
until first resolution, which `match()`'s `nil` branch depends on — and gains `initial` as an
optional escape from it.

### 7. Derived composites derive their slices; they do not write them

Each key of a derived composite gets its own `Memo` that reads the source and selects its own
slice. Children are *derived*, not written. Child-signal identity is preserved by key, which is
what makes this the same outcome the discouraged effect produces by hand — but with the dependency
edge visible to the graph.

An earlier draft of this ADR specified the opposite: a memoized recompute whose result is applied
through the diff in `list.set()` and `store.set()`. That is not implementable. Driving
`inner.set(source.get())` from a recompute writes to child signals mid-recompute, which calls
`propagate()` and then `flush()` while the graph is still running — the re-entrancy the flush guard
exists to prevent. Wrapping it in `batch()` defers the flush but still leaves writes inside a
tracked recompute. `deriveCollection` already used the per-slice mechanism before this ADR; the
draft simply mis-described it.

Per-slice `equals` does the work the diff was meant to do: a slice whose value did not change stops
propagation, so an unchanged property or item does not re-run its readers.

**Slices resolve by key, never by a cached index.** A derived composite over an unkeyed source must
map source elements to keys, and it is tempting to cache a key→index map and have each slice read
`items[index]`. That is unsound: a consumer may hold a slice signal directly, so the slice can be
refreshed through an edge that never passes through the composite's own rebuild, leaving the cached
index stale after a reorder and returning a different element under the same key. Any index cache
must be revalidated against the source array inside the slice's own recompute.

**Derived records do not recurse into nested values.** `createStore` converts a nested record to a
nested `Store` and a nested array to a `List` because a *write* needs a target: without nesting,
`store.address.city.set(…)` has nowhere to land. A derived record has no writes, so recursion has
no target — it would be purely a read optimization, guessing at a granularity the caller did not
ask for and paying a node per nested key whether or not that granularity is used. A caller who
wants sub-path granularity composes `deriveStore`/`deriveList` on the property and pays only there.
Under decision 1 the two factories produce the same `Store` type, so this is a documented behavioural
difference between construction paths, not a type difference.

The mechanisms in ADR-0010 (`FLAG_RELINK`), ADR-0014 (two-path access), ADR-0015 (structural
lookup edges — including its asymmetry: `byKey` and proxy reads create no structural edge, or
per-property granularity is lost), and ADR-0017 (proxy write rejection) apply unchanged.

## Alternatives Considered

**Fill the matrix, keep nine type names.** Closes the gap that forces effect-writes but leaves the
vocabulary indexed by two axes and leaves `.set()` reachable on things that should not have it.
Rejected: the derivation gap and the mutability leak reinforce each other, and closing only one
leaves the discouraged pattern both available and idiomatic-looking.

**Document the prohibition harder.** Rejected: a training-set prior is not answerable by prose. If
`.set()` exists on a derived value, it will be called. The corrective is a compile error.

**Three factories total, `create{Signal,List,Store}(valueOrFn, options)`.** Rejected on two counts:
it requires runtime dispatch that cannot distinguish sync derivation from external push (see
decision 4), and it pulls the async and watched machinery into every bundle that creates a plain
state, breaking the ≤4 kB core budget.

**Twelve factories, `create{Origin}{Shape}`.** Perfectly regular and maximally tree-shakable, but
twelve construction names to cover six types is a worse ratio than the status quo, and the
tree-shaking benefit is real only for the single-value shape — where decision 5 preserves it
anyway.

**`isPending`/`abort` on the base `Signal<T>`.** Rejected: a closure per node on the synchronous
hot path, paid by every `State` in the graph, for a capability most signals do not have.

## Consequences

**Positive**

- Every shape can be derived from every origin. The empty cells are gone.
- Nothing derived exposes `.set()`. The discouraged pattern becomes a compile error rather than a
  style violation.
- `Collection` and `Sensor` disappear as concepts. `Collection` in particular was confirmed a weak
  name; it turns out to have been "readonly List" all along.
- `isPending()` extends to composites, which is currently inexpressible.
- The type surface a consumer reasons about drops from nine names to six, plus two orthogonal
  primitives.

**Negative**

- Breaking. Every consumer that names `State`, `Memo`, `Task`, `Sensor`, or `Collection` as a type,
  or calls `task.isPending()` as a method, must migrate. Le Truc requires coordinated release.
- `List<T>` currently means the mutable type. Under this ADR it means the readonly base, so code
  that types a variable `List<T>` and calls `.add()` breaks silently at the type level — the most
  error-prone part of the migration.
- `createSignal` currently sniffs shape (array → `List`, record → `Store`). It becomes
  shape-specific. The coercion behaviour, which Le Truc relies on, moves to `toSignal(value)`.
- `createComputed` and `createMutableSignal` are subsumed by `deriveSignal` and `createSignal`.
- The full-library bundle budget must be re-measured. Merging `Collection` into `List` offsets some
  of the added surface, but the target is not guaranteed to hold.
- `Slot<T>` remains shape-agnostic, so a slotted `List` is consumed as `Signal<T[]>` and loses
  `at()` / `byKey()`. Deliberately out of scope: `Slot` abstracts over `{ get, set? }` and ignores
  all other methods by design.

**Neutral**

- Guards become shape-indexed: `isSignal`, `isList`, `isStore`, `isMutableSignal`, `isMutableList`,
  `isMutableStore`. The origin guards `isState`, `isMemo`, `isTask`, `isSensor`, and `isCollection`
  have no referent after the collapse and are removed. `isSignalOfType` remains the primitive.
