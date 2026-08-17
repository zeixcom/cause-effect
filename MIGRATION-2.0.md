# Migrating toward Cause & Effect 2.0

> **Status:** v2.0 is not yet released and not yet committed ([ADR-0018](adr/0018-shape-indexed-signal-types.md)
> is Accepted). This guide prepares consumer code ahead of the breaking release. Every bridge
> name ships by 1.5.1 and behaves identically to the name it replaces.

## What changes in 2.0

Signal types stop being indexed by *origin* (`State`, `Memo`, `Task`, `Sensor`, `Collection`)
and are indexed by *shape* and *mutability* instead: `Signal`/`MutableSignal`,
`List`/`MutableList`, `Store`/`MutableStore`. Construction is indexed by origin:
`create*` for mutable sources, `derive*` for everything else. `isPending(signal)` and
`abort(signal)` become graph utilities. See [ADR-0018](adr/0018-shape-indexed-signal-types.md)
for the rationale.

The hazard this guide exists to defuse: **`List<T>` changes meaning.** Today it is the
*mutable* type. In 2.0 it is the *readonly base* — which is today's `Collection`. The bridge
names and the codemod below convert that silent flip into a staged, deprecation-driven rename.
**`Store<T>` flips the same way** — today's mutable type, 2.0's readonly base (today's
`DerivedStore`) — and gets the same bridge treatment.

## Bridge names (1.5.0)

| Deprecated name | Bridge name (1.5) | v2.0 name | Notes |
|---|---|---|---|
| `List<T>` | `MutableList<T>` | `MutableList<T>` | Same type, same behavior. The `List` name is recycled for the readonly base. |
| `isList(x)` | `isMutableList(x)` | `isMutableList(x)` | `isList` widens to the readonly base in 2.0. |
| `Collection<T>` | `DerivedList<T>` | `List<T>` | Same type, same behavior — the readonly keyed sequence returned by `deriveList`. |
| `isCollection(x)` | `isDerivedList(x)` | `isList(x)` | |
| `createCollection(watched, options?)` | `deriveList(seed, { watched, … })` | `deriveList(seed, { watched, … })` | The `value` option becomes the seed argument; every other option carries over verbatim. Available since 1.5.0. |
| `Store<T>` | `MutableStore<T>` | `MutableStore<T>` | Same type, same behavior. The `Store` name is recycled for the readonly base (today's `DerivedStore`). |
| `isStore(x)` | `isMutableStore(x)` | `isMutableStore(x)` | 1.x `isStore` checks the shape tag only, so it matches a `DerivedStore` too; `isMutableStore` also requires the write capability. In 2.0, `isStore` narrows to the readonly base. |
| `createComputed(fn, options?)` | `deriveCell(fn, options?)` | `deriveCell(fn, options?)` | Same dispatch (sync → `Memo`, async → `Task`), returned as `Signal<T>` instead of the deprecated `Memo`/`Task` union. `options.value` becomes `options.initial`. Available since 1.5.1. |
| `createMutableSignal(value)` | `createCell(value)` · `createList(array)` · `createStore(record)` | unchanged — terminal vocabulary | 1.x dispatches on the shape of the argument, so pick the factory that matches it; for a single value, `createCell` is an alias of `createState`. The codemod picks by literal shape. Do not bridge through `createSignal(value)`: it accepts the same shapes in 1.x, but 2.0 removes it. |
| `CollectionSource<T>` | `ListSource<T>` | `ListSource<T>` | Same type, same behavior — the source `deriveList` keys and derives from. Terminal 2.0 name. |
| `CollectionCallback<T>` | `ListCallback<T>` | `ListCallback<T>` | Same type, same behavior — the external-push watched callback. Terminal 2.0 name. |
| `CollectionChanges<T>` | `ListChanges<T>` | `ListChanges<T>` | Same type, same behavior — the `applyChanges` mutation descriptor. Terminal 2.0 name. |
| `DeriveCollectionCallback<T, U>` | `PerItemCallback<T, U>` | `PerItemCallback<T, U>` | Same type, same behavior — the per-item transformation callback. Terminal 2.0 name. |

`createList`, `deriveList`, `deriveStore`, `createState`, `createMemo`, `createTask`,
`createSensor`, `createSlot`, `createEffect`, and `match` keep their names and behavior.

Two 1.5 names rename once more at the 2.0 boundary: `DerivedList<T>` becomes `List<T>` and
`DerivedStore<T>` becomes `Store<T>`. Adopting the bridge names therefore means one more
mechanical rename when you move to 2.0 — `MutableList<T>`, `MutableStore<T>`, and the 1.5.1
single-value names (`createCell`, `deriveCell`, `DeriveCellOptions`) are the terminal
vocabulary, carried into 2.0 unchanged.

## ⚠️ Second flip: `deriveSignal` renames to `deriveCell`

ADR-0018 was revised on 2026-08-17, after 1.5.0 shipped: the single-value shape is named
**`Cell`**, and **`Signal` stays the umbrella** it already is in 1.x. One released name
carried the superseded narrow-`Signal` vocabulary: the 1.5.0 bridge factory `deriveSignal`
and its options type. 1.5.1 renames both to the terminal names:

| Deprecated (1.5.0) | Terminal (1.5.1) | Notes |
|---|---|---|
| `deriveSignal(input, options?)` | `deriveCell(input, options?)` | Same dispatch: sync function → `Memo`, async function → `Task`, seed value + `watched` → `Sensor`. Returned as `Signal<T>`. |
| `DeriveSignalOptions<T>` | `DeriveCellOptions<T>` | Same members, renamed. |

No 1.x type or guard ever carried the narrow meaning — `Signal<T>`, `isSignal`, and
`isMutableSignal` are untouched, and nothing else needs an audit. `createSignal` is
unrelated to the flip: its shape dispatch is a 1.x convenience that 2.0 removes outright
(see the coercion recipe below), not part of the narrow-`Signal` vocabulary. Both
deprecated names are removed in 2.0; the codemod rewrites them automatically.

## Running the codemod

```sh
bun tools/codemod-v2.ts 'src/**/*.ts'   # or: bunx tsx tools/codemod-v2.ts …
```

The codemod is **meaning-preserving**: every new name denotes exactly what the old name
denotes in 1.x, so the output compiles and behaves identically before and after. It rewrites
the renames in the table above (exact identifier match — your own `ListOptions`-style names
and your own declarations named `List` are left alone) and syncs the imports. Run your
formatter afterwards; the rewritten `deriveList(...)` calls are syntactically valid but not
formatted to taste.

Three call shapes are rewritten beyond identifier renames: `createCollection(watched,
options?)` becomes the `deriveList(seed, { watched, … })` form; `createMutableSignal(v)`
becomes `createCell(v)`/`createList(v)`/`createStore(v)` by the shape of a literal argument;
and a literal `value:` option on a `createComputed` call becomes `initial:` (the callee
renames to `deriveCell` with the rest). The codemod **flags** what it will not rewrite:
every `createSignal(...)` call — no meaning-preserving 2.0 rewrite exists — plus
`createMutableSignal` with a non-literal argument, `createComputed` with non-literal
options, and `createComputed` with an async callback, whose `Task` methods
`.isPending()`/`.abort()` become the free functions `isPending(signal)`/`abort(signal)`
in 2.0.

`--module <name>` scopes which import declarations are updated: the codemod syncs imports
only on declarations whose module specifier *contains* `<name>` as a substring. The default,
`cause-effect`, matches `@zeix/cause-effect` and any deeper specifier under it alike. A
consumer that re-exports the library can pass its own scope — for example
`--module @zeix/le-truc` — to rewrite exactly the imports pulling from that package, still
including deeper specifiers such as `@zeix/le-truc/subpath`.

## What the codemod cannot decide

**Read-only `List<T>` positions.** The codemod renames *every* `List` reference to
`MutableList`, which preserves the 1.x meaning but keeps the position mutable forever. If a
position only reads (a parameter, a return type, a variable bound to `deriveList(...)`),
narrow it to `DerivedList<T>` today — or do nothing, and let it become the v2 `List<T>` at
the 2.0 boundary. Either is safe; leaving it `MutableList` is merely more permissive than
necessary.

**`.deriveCollection(fn)` methods.** Deprecated as of 1.5.0, **removed in 2.0** — folded into
the top-level `deriveList(source, itemFn)`. A chain `users.deriveCollection(f)` becomes
`deriveList(users, f)` — mechanically findable, but the codemod deliberately leaves methods
alone so your pipelines stay diffable. Migrate by hand when you adopt the other v2 renames.

**`DeriveCollectionOptions<T>`.** Folds into `deriveList`'s own `DeriveListOptions<T>` in 2.0 —
no separate name survives, so it is the one 1.5 auxiliary type in this area with no bridge name.
The codemod has no rule for it, so if your code names `DeriveCollectionOptions` explicitly,
switch it to `DeriveListOptions` by hand — every field it has, `DeriveListOptions` already has.

**Origin guards.** `isState`, `isMemo`, `isTask`, `isSensor`, and `isComputed` have no
mechanical replacement — they are removed because origin is no longer part of the consumption
contract. Each use needs a decision: usually the shape guards (`isSignal`, `isMutableSignal`)
or a plain property check. The v2 codemod cannot make that call; audit these uses by hand.
The types `State`, `Memo`, `Task`, `Sensor`, `SensorCallback`, `SensorOptions`, and
`ComputedOptions` (the last only via `createComputed` — `createMemo`/`createTask` keep it)
are removed alongside their guards for the same reason.

**`createComputed(fn, options?)`.** Deprecated as of 1.5.0. The codemod renames it to
`deriveCell(fn, options?)` and rewrites a literal `options.value` to `options.initial`.
Two cases stay flagged: non-literal options (rename `value` yourself), and an async
callback — it returned a `Task` carrying `.isPending()`/`.abort()`, which on `Signal<T>`
become the free functions `isPending(signal)`/`abort(signal)`.

**`createMutableSignal(value)`.** Deprecated as of 1.5.0. For a literal argument the
codemod rewrites the call to `createCell`/`createList`/`createStore` by shape — terminal
vocabulary, all three. A non-literal argument stays flagged: only you can see the runtime
shape. Do not bridge through `createSignal(value)`: it accepts the same shapes in 1.x,
but 2.0 removes it (see the coercion recipe below).

## The `createSignal` shape coercion

In 2.0 the shape sniffing ends and the `createSignal` name goes with it: single values
construct through `createCell` (an alias of `createState` since 1.5.1), arrays through
`createList`, records through `createStore`, and functions through `deriveCell`. A coercion
that hides the shape decision is the v1-ism the 2.0 taxonomy deletes. If you need it (for
example, to keep a re-export surface stable), it is three lines over the primitives:

```ts
import { createList, createState, createStore, isRecord } from '@zeix/cause-effect'

const coerceSignal = (value: unknown) =>
	Array.isArray(value) && value.every(item => item != null)
		? createList(value)
		: isRecord(value)
			? createStore(value)
			: createState(value)
```
