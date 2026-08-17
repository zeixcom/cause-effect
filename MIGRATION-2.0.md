# Migrating toward Cause & Effect 2.0

> **Status:** v2.0 is not yet released ([ADR-0018](adr/0018-shape-indexed-signal-types.md) is
> Accepted; implementation is complete on branch `v2/shape-exploration`). This guide describes
> the final (Revision) names ahead of the breaking release. All bridge names are available
> since 1.5.0 and behave identically to the names they replace.

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

`createList`, `deriveList`, `deriveStore`, `createState`, `Slot`, `Effect`, and `match`
keep their names and behavior. `createMemo` is renamed `deriveComputed`. `createTask` and
`createSensor` are removed from the public API — both route through `deriveCell` instead
(ADR-0018 §4: `watched` is an option, never a callback position, because a derivation
callback and an external-push callback are indistinguishable at runtime).

## Smaller 2.0 renames (no bridge — they land at 2.0)

| 1.x name | 2.0 name | Notes |
|---|---|---|
| `createCollection(watched, options?)` | *(removed)* | Internal to `deriveList(seed, { watched })`. No replacement export. |
| `.deriveCollection(fn)` methods | *(removed)* | `deriveList(source, fn)` covers every use. |
| `CollectionSource<T>` | `ListSource<T>` | A longer name — the codemod's exact-identifier rules will **not** catch it; rename by hand. |
| `CollectionCallback<T>` | `ListCallback<T>` | Its argument is now named `emit` (was `apply`/`applyChanges`). |
| `CollectionChanges<T>` | `ListChanges<T>` | |
| `SensorCallback<T>` | `CellCallback<T>` | Completes the `CellCallback`/`ListCallback`/`StoreCallback` triple. Its argument is now named `emit` (was `set`). |
| `ComputedOptions<T>` / `SensorOptions<T>` | `DeriveCellOptions<T>` | One options type for the single-value derive family. The seed option is `initial`. |
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

## ⚠️ Second flip: `Signal` returns to the umbrella, narrow shape renamed to `Cell`

ADR-0018 was revised after the section above shipped on this branch. The single-value shape
first landed as a *narrowed* `Signal` (the section above); it has since been renamed to
**`Cell`**, and **`Signal`/`MutableSignal` return to their v1.x umbrella meaning** — matching
`Cell`, `List`, or `Store` alike, by structural `.get()` rather than by tag. If you have not
adopted the narrow-`Signal` interlude described above, skip this section; it exists for anyone
who wrote code against the intermediate state on this branch.

| Intermediate (narrow `Signal`) | Current (2.0, revised) | Notes |
|---|---|---|
| `Signal<T>` (narrow, single value) | `Cell<T>` | Same type, same behavior — renamed. |
| `MutableSignal<T>` (narrow) | `MutableCell<T>` | Same type, same behavior — renamed. |
| `createSignal(value)` | `createCell(value)` | |
| `deriveSignal(input, options?)` | `deriveCell(input, options?)` | |
| `isSignal(x)` (narrow, single-value only) | `isCell(x)` | `isSignal` itself now means something wider again — see below. |
| `isMutableSignal(x)` (narrow) | `isMutableCell(x)` | Same caveat. |
| `createMemo(fn, options?)` | `deriveComputed(fn, options?)` | |

**`isSignal`/`isMutableSignal` flip back — but they never stopped compiling.** In the
intermediate state, these two guards matched only the single-value shape. They now match the
umbrella again: any of `Cell`, `List`, or `Store` (and, structurally, `Slot`, which has
`get()`/`set()` too). The names themselves are not retired and never were — only their match
widens, back to what they meant in 1.x and mean again in 2.0:

```ts
isSignal(myList)   // intermediate: false   2.0 (revised): true  — umbrella match restored
isSignal(myCell)   // intermediate: true    2.0 (revised): true  — still matches
isSignal(myStore)  // intermediate: false   2.0 (revised): true  — umbrella match restored
```

If you wrote a call site during the intermediate state that depended on `isSignal` matching
*only* the single-value shape — for example, an `if (isSignal(x)) { ... } else if (isList(x))
{ ... }` chain where the `isSignal` branch assumed `x` could not be a `List` — switch that call
site to `isCell`. The chain still compiles either way (both guards exist), but with `isSignal`
it now also enters the first branch for a `List` or `Store`, silently changing which branch
runs — the same silent-behavior-change hazard the section above warns about, on the way back.

**`createTask` and `createSensor` are removed from the public API, with no direct
replacement — route through `deriveCell`.** Both still exist internally (`deriveCell`
dispatches to them), but neither is exported. The call shape changes because `deriveCell`
picks the origin from its argument instead of you picking the factory:

```ts
// Before (intermediate state): createTask
const user = createTask(async (_prev, abortSignal) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal })
  return res.json()
})
user.isPending() // method on Task

// After (2.0, revised): deriveCell with an async function
const user = deriveCell(async (_prev, abortSignal) => {
  const res = await fetch(`/api/users/${userId.get()}`, { signal: abortSignal })
  return res.json()
})
isPending(user) // free function — asynchrony is an origin, not a shape
```

```ts
// Before (intermediate state): createSensor
const mousePos = createSensor<{ x: number; y: number }>({
  watched: (emit) => {
    const handler = (e: MouseEvent) => emit({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  },
  initial: { x: 0, y: 0 },
})

// After (2.0, revised): deriveCell with a seed and a watched option
const mousePos = deriveCell({ x: 0, y: 0 }, {
  watched: (emit) => {
    const handler = (e: MouseEvent) => emit({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  },
})
```

The seed positional argument replaces `createSensor`'s optional `initial` option — in
`deriveCell`'s external-push form the seed *is* the initial value, so there is no longer a way
to construct a fully unset external-push cell through the public API.

The codemod (`tools/codemod-v2.ts`) rewrites `createMemo` to `deriveComputed`, `createComputed`
to `deriveCell` (a literal `options.value` becomes `options.initial`, and an async call site is
flagged for the `.isPending()`/`.abort()` → free-function migration — `deriveComputed` is
sync-only, so `createComputed`'s async form cannot land there), `createMutableSignal` to
`createCell`, and `deriveSignal` to `deriveCell` automatically. It flags `createSignal`,
`createTask`, `createSensor`, and the origin guards for manual review — each needs the
judgment call shown above, not a mechanical rename. It leaves `isSignal` and `isMutableSignal`
untouched and unflagged, since their meaning is the same in 1.x and in the revised 2.0 — only
the intermediate state on this branch differed.

## Running the codemod

```sh
bun tools/codemod-v2.ts 'src/**/*.ts'   # or: bunx tsx tools/codemod-v2.ts …
```

The codemod is **meaning-preserving**: every new name denotes exactly what the old name
denotes in 1.x, so the output compiles and behaves identically before and after. It rewrites
the renames in the table above (exact identifier match — your own `ListOptions`-style names
and your own declarations named `List` are left alone) and syncs the imports. It leaves
`isSignal`/`isMutableSignal` untouched and unflagged — their meaning is the same in 1.x and
in the revised 2.0 (see "Second flip" above). Run your formatter afterwards; the rewritten
`deriveList(...)` calls are syntactically valid but not formatted to taste.

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
contract. Each use needs a decision: the shape guards (`isCell`, `isList`, `isStore`) or a
plain property check. **But read "Second flip" above first** — `isSignal` is the umbrella
again, so a mechanical `isState || isMemo → isSignal` rewrite is wrong whenever the value can
be a `List` or `Store`; the narrow-shape equivalent is `isCell`. The codemod flags these call
sites; audit them by hand.

**`createComputed` and `createMutableSignal`.** Subsumed in 2.0 by `deriveCell` and
`createCell`. Both remain available in 1.x; no action needed until 2.0.

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

The function forms of `createSignal` map to `deriveCell(input, options?)` in 2.0.
