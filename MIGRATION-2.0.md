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

`createList`, `deriveList`, `deriveStore`, `createState`, `createMemo`, `createTask`,
`createSensor`, `createSlot`, `createEffect`, and `match` keep their names and behavior.

Two 1.5 names rename once more at the 2.0 boundary: `DerivedList<T>` becomes `List<T>` and
`DerivedStore<T>` becomes `Store<T>`. Adopting the bridge names therefore means one more
mechanical rename when you move to 2.0 — only `MutableList<T>` and `MutableStore<T>` are
terminal vocabulary, carried into 2.0 unchanged.

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

**`.deriveCollection(fn)` methods.** Deprecated as of 1.5.0. Both forms are **removed in
2.0** — the method on `MutableList`/`DerivedList` and the module-level `deriveCollection`
(which 1.5.0 already unexports) — folded into the top-level `deriveList(source, itemFn)`.
A chain `users.deriveCollection(f)` becomes `deriveList(users, f)` — mechanically findable,
but the codemod deliberately leaves methods alone so your pipelines stay diffable. Migrate
by hand when you adopt the other v2 renames.

**`CollectionSource<T>`.** Renames to `ListSource<T>` in 2.0 — same structure, new name.
The codemod has no rule for it (like `ListOptions`-style longer names, it is a distinct
symbol rather than a deprecated one), so rename it by hand. This is also the answer for
`reconcile`-style signatures that mention it: the 2.0 signature says `ListSource<T>` where
1.x said `CollectionSource<T>`.

**Origin guards.** `isState`, `isMemo`, `isTask`, `isSensor`, and `isComputed` have no
mechanical replacement — they are removed because origin is no longer part of the consumption
contract. Each use needs a decision: usually the shape guards (`isSignal`, `isMutableSignal`)
or a plain property check. The v2 codemod cannot make that call; audit these uses by hand.

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
