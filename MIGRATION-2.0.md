# Migrating toward Cause & Effect 2.0

> **Status:** v2.0 is not yet released and not yet committed ([ADR-0018](adr/0018-shape-indexed-signal-types.md)
> is Proposed). This guide prepares consumer code ahead of the breaking release. All bridge
> names are available since 1.5.0 and behave identically to the names they replace.

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

## Bridge names (1.5.0)

| Deprecated name | Bridge name (1.5) | v2.0 name | Notes |
|---|---|---|---|
| `List<T>` | `MutableList<T>` | `MutableList<T>` | Same type, same behavior. The `List` name is recycled for the readonly base. |
| `isList(x)` | `isMutableList(x)` | `isMutableList(x)` | `isList` widens to the readonly base in 2.0. |
| `Collection<T>` | `DerivedList<T>` | `List<T>` | Same type, same behavior — the readonly keyed sequence returned by `deriveList`. |
| `isCollection(x)` | `isDerivedList(x)` | `isList(x)` | |
| `createCollection(watched, options?)` | `deriveList(seed, { watched, … })` | `deriveList(seed, { watched, … })` | The `value` option becomes the seed argument; every other option carries over verbatim. Available since 1.5.0. |

`createList`, `deriveList`, `deriveStore`, `createState`, `createMemo`, `createTask`,
`Slot`, `Effect`, and `match` keep their names and behavior. `createSensor` keeps its
name; in 2.0 its `watched` callback moves from the first argument into the options —
`createSensor({ watched, value?, equals?, guard? })` (ADR-0018 §4: `watched` is an
option, never a callback position, because a derivation callback and an external-push
callback are indistinguishable at runtime).

## Smaller 2.0 renames (no bridge — they land at 2.0)

| 1.x name | 2.0 name | Notes |
|---|---|---|
| `createCollection(watched, options?)` | *(removed)* | Internal to `deriveList(seed, { watched })`. No replacement export. |
| `.deriveCollection(fn)` methods | *(removed)* | `deriveList(source, fn)` covers every use. |
| `CollectionSource<T>` | `ListSource<T>` | A longer name — the codemod's exact-identifier rules will **not** catch it; rename by hand. |
| `CollectionCallback<T>` | `ListCallback<T>` | Its argument is now named `emit` (was `apply`/`applyChanges`). |
| `CollectionChanges<T>` | `ListChanges<T>` | |
| `SensorCallback<T>` | `SignalCallback<T>` | Completes the `SignalCallback`/`ListCallback`/`StoreCallback` triple. Its argument is now named `emit` (was `set`). |
| `ComputedOptions<T>` / `SensorOptions<T>` | `DeriveSignalOptions<T>` | One options type for the single-value derive family. The seed option is `initial`. |
| the `value` option | the `initial` option | On `createMemo`, `createTask`, `createSensor`, `deriveSignal`, `deriveList`, `deriveStore`. Positional arguments are unchanged: `value` for `create*`, `input` for `derive*`. |
| an `AbortSignal` callback parameter named `abort` or `signal` | `abortSignal` | Renamed everywhere for one uniform name — callback parameters are positional, so call sites compile unchanged. |
| `isEqual` | *(removed)* | Use `DEEP_EQUALITY`. |
| `isObjectOfType` | *(removed)* | Use `isSignalOfType`. |

## ⚠️ `isSignal` and `isMutableSignal` change meaning — silently

This is the one break with **no bridge, no codemod rewrite, and no compile error**, so it
deserves its own section. In 1.x, `isSignal(x)` is the umbrella: true for every signal
type, including `List`, `Store`, and `Slot`. In 2.0 it matches **only the single-value
shape**. Likewise `isMutableSignal(x)` matched every mutable type (`State`, `Store`,
`List`); in 2.0 it matches only the mutable single-value shape.

```ts
isSignal(myList)      // 1.x: true   2.0: false  — use isList()
isSignal(myStore)     // 1.x: true   2.0: false  — use isStore()
isSignal(mySlot)      // 1.x: true   2.0: false  — use isSlot()
isMutableSignal(myStore) // 1.x: true  2.0: false — use isMutableStore()
```

Code that guards an `unknown` value with `isSignal` and then branches still compiles and
still runs — it just takes the non-signal branch for composites. Audit every `isSignal`
and `isMutableSignal` call site: if the argument can be a `List`, `Store`, or `Slot`,
switch to the shape guard you mean. For "is this any reactive value at all?", the
structural check `typeof x?.get === 'function'` is the recipe — it also accepts
descriptor-like objects a tag check never did.

## Running the codemod

```sh
bun tools/codemod-v2.ts 'src/**/*.ts'   # or: bunx tsx tools/codemod-v2.ts …
```

The codemod is **meaning-preserving**: every new name denotes exactly what the old name
denotes in 1.x, so the output compiles and behaves identically before and after. It rewrites
the renames in the table above (exact identifier match — your own `ListOptions`-style names
and your own declarations named `List` are left alone) and syncs the imports. It also
**flags** every `isSignal`/`isMutableSignal` call site for manual review — it cannot rewrite
those, because the 2.0 meaning depends on what the argument can be (see the section above).
Run your formatter afterwards; the rewritten `deriveList(...)` calls are syntactically valid
but not formatted to taste.

## What the codemod cannot decide

**Read-only `List<T>` positions.** The codemod renames *every* `List` reference to
`MutableList`, which preserves the 1.x meaning but keeps the position mutable forever. If a
position only reads (a parameter, a return type, a variable bound to `deriveList(...)`),
narrow it to `DerivedList<T>` today — or do nothing, and let it become the v2 `List<T>` at
the 2.0 boundary. Either is safe; leaving it `MutableList` is merely more permissive than
necessary.

**`.deriveCollection(fn)` methods.** The method form stays in 1.x and 2.0 folds it into the
top-level `deriveList(source, fn)`. A chain `users.deriveCollection(f)` becomes
`deriveList(users, f)` — mechanically findable, but the codemod leaves methods alone so your
pipelines stay diffable. Migrate when you adopt the other v2 renames.

**Origin guards.** `isState`, `isMemo`, `isTask`, `isSensor`, and `isComputed` have no
mechanical replacement — they are removed because origin is no longer part of the consumption
contract. Each use needs a decision: the shape guards (`isSignal`, `isList`, `isStore`) or a
plain property check. **But read the `isSignal` section above first** — `isSignal` itself has
changed meaning, so a mechanical `isState || isMemo → isSignal` rewrite is wrong whenever the
value can be a composite. The codemod flags these call sites; audit them by hand.

**`createComputed` and `createMutableSignal`.** Subsumed in 2.0 by `deriveSignal` and
`createSignal`. Both remain available in 1.x; no action needed until 2.0.

## The `createSignal` shape coercion

In 2.0, `createSignal(value)` becomes single-value only. The 1.x shape sniffing — array →
`List`, record → `Store`, function → `Memo`/`Task`, signal → itself — is **removed with no
replacement export**: a coercion that hides the shape decision is the v1-ism the 2.0 taxonomy
deletes. If you need it (for example, to keep a re-export surface stable), it is three lines
over the primitives:

```ts
import { createList, createState, createStore, isRecord } from '@zeix/cause-effect'

const coerceSignal = (value: unknown) =>
	Array.isArray(value) && value.every(item => item != null)
		? createList(value)
		: isRecord(value)
			? createStore(value)
			: createState(value)
```

The function forms of `createSignal` map to `deriveSignal(input, options?)` in 2.0.
