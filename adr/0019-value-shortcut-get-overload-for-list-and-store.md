# ADR 0019: Value-Shortcut `get(key)` Overload for List and Store

## Status

🔄 Proposed — 2026-08-17, for v2.0. Depends on [ADR-0018](0018-shape-indexed-signal-types.md) (🔄 Proposed, unreleased — `List`/`Store` naming this ADR builds on).

## Context

A reverse-prompt reconstruction of this codebase — an experiment where an LLM rebuilt the library from scratch via prompting alone, without seeing the source, to surface where the real design departs from training-set priors (see `project_naming_and_docs_overhaul.md`) — produced a `Store.get()` overloaded on arity: `get()` returns the whole aggregate value, `get(field)` returns that field's raw value directly. The reconstruction's `List` has no stable keys at all (a plain index-based array), so it offers no comparable `byKey` alternative to evaluate.

Today:

- `List<T,S>.get(): T[]` returns the whole array (a value); `List<T,S>.byKey(key: string): S | undefined` returns the *child signal* (`S`, e.g. `Cell<T>`) and, per [ADR-0015](0015-composite-lookup-methods-track-structural-changes.md), also tracks structural changes (add/remove/reorder).
- `Store<T>.get(): T` returns the whole record (a value); `Store<T>.byKey<K>(key: K): Cell<T[K]> | undefined` returns the *child signal*. The proxy (`store.name`) reaches the same child signal for statically known keys — the documented idiomatic path per ADR-0015; `byKey` is what a caller reaches for with a dynamic or computed key name.

`byKey()` returning a signal, not a value, is deliberate: it is the handle a caller needs to pass to a `Slot`, subscribe to independently, or hold across renders.

What the reconstruction's `Store.get(field)` actually is, once separated from the "replace byKey" framing, is a **value-reading shortcut**: today, reading a single item's or property's *value* by key takes two calls — `list.byKey(key)?.get()` or `store.byKey(key)?.get()` — and the trailing `.get()` is easy to forget, silently leaving a signal handle where a value was expected. This ADR evaluates adding that shortcut as an **overload alongside `byKey`**, not a replacement for it.

`list.byKey(key)?.get()` / `store.byKey(key)?.get()` is confirmed user-land practice, not a hypothetical, and it fails in two distinct ways:

1. **`byKey()` is nullable, forcing optional chaining at every call site.** For `Store`, this is avoidable noise: `T`'s keys are statically known, so a per-property lookup should not need a null check at all. `byKey`'s `| undefined` on Store (`src/nodes/store.ts:71,76`) exists for reasons unrelated to whether the key is present — see the Decision section — so a `Store`-only accessor that drops it is a genuine type-safety improvement, not just a shorthand.
2. **The trailing `.get()` is easy to forget**, and the signal/value distinction it exists to bridge is not obvious even to an experienced user of this library. A caller who forgets it is left holding a signal where a value was expected, with no compile error in most contexts (see the additive-feature-bar argument below).

Both failure modes motivate the same fix: a direct value-returning accessor, keyed, with no intermediate optional signal.

## Decision

Add a `get(key)` overload to `List` and `Store` that returns the *value* at that key, equivalent to `byKey(key)?.get()`. `byKey()` is unchanged and remains the way to reach the child signal.

```ts
// List<T, S> — unchanged: get(): T[], byKey(key): S | undefined
get(key: string): T | undefined

// Store<T> — unchanged: get(): T, byKey(key): Cell<T[K]> | undefined
get<K extends keyof T & string>(key: K): T[K]
```

**List** keeps `| undefined`: a runtime string key genuinely may not be present, the same honesty `byKey` already carries (ADR-0015).

**Store** does not carry `| undefined`: `T`'s keys are statically known, every key is initialized at construction, and the value type `T[K]` already expresses any optionality the caller declared on `T` itself. This matches [Non-Nullable Types](../REQUIREMENTS.md#non-nullable-types) more precisely than `byKey`/the proxy do today — both of those carry an unconditional `| undefined` on their return type (`src/nodes/store.ts:71,76`) that predates this ADR and is not reproduced here, because `get(key)` returns a value, not a signal, and there is no "the child hasn't been constructed yet" case a value read needs to defend against.

`get(key)` must carry both edges `byKey(key)?.get()` would establish by composing the two calls manually: the ADR-0015 structural edge (from the `byKey`-equivalent lookup) and the value edge (from `.get()` on the child). Implement it as a thin wrapper over the existing two-call path — not a separate lookup — so tracking behavior is identical, not merely similar, to what it replaces syntactically.

`MutableList`/`MutableStore` inherit the overload from their readonly base; no separate declaration is needed.

### `get(key)` is single-level; nested-path access is explicitly out of scope

`get(key)` returns a value, not a signal, so — unlike `byKey`, which returns a nested `MutableStore`/`MutableList` that can itself be `byKey`'d — it **cannot be chained** to reach a nested property in a second call. One-call nested access (`store.get('user.settings.appearance')` or `store.get('user', 'settings', 'appearance')`) was evaluated and rejected for this ADR:

- A **dot-path string** would have to split on `.`, which silently breaks this ADR's own core equivalence (`get(key) === byKey(key)?.get()`) for any key that legitimately contains a literal dot — `get('a.b')` and `byKey('a.b')` would then disagree about what "the key" is. That is a footgun built into the feature at birth, not a rare edge case worth accepting for the sake of a shorter call.
- A **variadic path** (`get(...path: string[])`) avoids the parsing ambiguity but needs a recursive tuple-indexed conditional type to stay type-safe, adds a third call arity to an already-overloaded method (compounding the unverified TS overload-resolution risk below), and only partially works: per [ADR-0018 §7](0018-shape-indexed-signal-types.md), a *readonly* `Store`'s `byKey` returns a flat `Cell` for every property, never a nested `Store`, so path traversal would reach only one level deep on a derived store and multiple levels on a mutable one — an asymmetry the caller has no static signal for. A path can also cross from a `Store`'s statically-known `keyof T` segments into a `List`'s runtime-generated string keys (e.g. a `MutableList` of `MutableStore` items via a custom item factory, CE-011), where the recursive type has nothing left to check and silently degrades to `string`/`unknown` mid-chain — precisely the compile-time guarantee the variadic form exists to provide.

Nested reads keep using the existing `byKey` chain (`store.byKey('user')?.byKey('settings')?.byKey('appearance')?.get()`) or the proxy (`store.user?.settings?.appearance?.get()`). Either may be revisited in a future ADR if nested access turns out to be common enough to justify the type-level cost — that has not been evaluated here.

### Why this clears the additive-feature bar

[Stability](../REQUIREMENTS.md#stability) requires a non-breaking addition to fill a genuine gap, fit the existing mental model, and add no conceptual weight:

- **Genuine gap**: `list.byKey(key)?.get()` is the only current path to a keyed value, and dropping the trailing `.get()` is a real, silent footgun — the expression still type-checks (`S | undefined` is a valid value in most contexts a caller might mistake for `T | undefined`, e.g. logging, JSX interpolation, JSON serialization) and fails only downstream or not at all.
- **Fits the mental model**: [Explicit Reactivity](../REQUIREMENTS.md#explicit-reactivity) states a `.get()` call tracks a dependency and returns a value — uniformly true across every shape today except this one path, where reading a keyed value takes a `.get()` call *and* a signal-returning call first. This overload makes "call `.get()` for a tracked value" hold without exception.
- **No conceptual weight**: it introduces no new concept — `get(key)` is defined entirely in terms of the two operations (`byKey`, `.get()`) that already exist and already compose this way. A caller who never uses it loses nothing; a caller who does is not learning a new mental model, only a shorter spelling of one they already have.

## Alternatives Considered

- **Replace `byKey` with an overloaded `get` that returns the signal for `get(key)`.** Rejected. This was the original framing, before checking what the reconstruction's `Store.get(field)` actually returns. It collapses two different return kinds (value vs. signal) onto one call spelled by arity, which is a worse legibility trade than the two-method status quo — a reader cannot tell from `x.get(k)` alone whether they hold a value or a signal, whereas `x.byKey(k)` is unambiguous. It also destroys the only path to a bare child-signal handle (needed for `Slot` binding, independent subscription, passing a reference to a subroutine) without offering a replacement.
- **Status quo — `byKey(key)?.get()` only, no shortcut.** Rejected as the default, but the fallback if the ergonomic gain here is judged not to clear the additive-feature bar on review — the two-call form is not broken, only more verbose and one keystroke away from a silent type-widening mistake.
- **A differently named shortcut (e.g. `valueAt(key)`, `read(key)`) instead of overloading `get`.** Not seriously considered — no distinct name was raised during this evaluation, and overloading `get` is what directly answers the "genuinely better" observation from the reconstruction; a new name would reopen exactly the naming-unfamiliarity question this ADR exists to close.
- **Dot-path nested access — `get('a.b.c')`.** Rejected. Breaks the `get(key) === byKey(key)?.get()` equivalence for any key containing a literal `.`, with no compile-time signal that it has diverged. See the Decision section.
- **Variadic nested access — `get(...path)`.** Rejected for this ADR, not ruled out permanently. Type-safe in principle but requires a recursive tuple-indexed conditional type, only partially applies to readonly `Store` (which does not recurse into nested composites, ADR-0018 §7), and degrades to loose typing wherever a path crosses from a `Store`'s static keys into a `List`'s runtime keys. See the Decision section.

## Consequences

- ✅ **Closes the two-call footgun**: `list.get(key)` / `store.get(key)` reads a tracked value in one call, with no risk of forgetting the trailing `.get()` and holding a signal by mistake.
- ✅ **Uniform `.get()` semantics**: every shape's `.get()` now returns a value and tracks a dependency, with no exception for the keyed-value case.
- ✅ **`byKey()` unchanged**: signal-handle access (`Slot` binding, independent subscription, passing a reference) is fully preserved; this ADR adds a path, it removes none.
- ✅ **Store's value read drops the ADR-agnostic `| undefined`** that `byKey`/the proxy carry today, matching Non-Nullable Types more precisely for the common "I just want the value" case.
- ⚠️ **Second path to the same value — needs verification against Minimal Surface**: `get(key)` is definitionally redundant with `byKey(key)?.get()`. The additive-feature bar in Stability is argued above to be cleared, but this is a judgment call the Architect/user should confirm, not a mechanical result.
- ⚠️ **TypeScript overload-resolution risk, unverified by a compiler check**: no internal call site in `src/` or `test/` currently passes `list.get` or `store.get` as a bare function reference (`array.map(list.get)`, `effect(list.get)` — checked; none found), so the immediate codebase is safe. But overloaded methods do not collapse cleanly to a single callable type, so a consumer who does pass `.get` by reference (rather than calling it) — e.g. `items.map(list.get)` expecting the arity-0 signature — may see the overload resolve unexpectedly or the reference fail to type-check as a plain `() => T[]`. This should be spiked against `tsc` with a realistic call-by-reference example before implementation, not assumed safe from this ADR alone.
- ⚠️ **Structural-edge duplication is an implementation obligation, not a given**: `get(key)`'s value must be produced by the same lookup `byKey` uses, or the two paths could silently diverge in tracking behavior (e.g. `get(key)` tracking only the value edge and missing the ADR-0015 structural edge). The implementing task must verify both edges are established, not just that the returned value is correct.

## Related

- Requirements: [Explicit Reactivity](../REQUIREMENTS.md#explicit-reactivity), [Non-Nullable Types](../REQUIREMENTS.md#non-nullable-types), [Minimal Surface, Maximum Coverage](../REQUIREMENTS.md#minimal-surface-maximum-coverage), [Stability](../REQUIREMENTS.md#stability)
- Architecture: [Composite Lookup Methods](../ARCHITECTURE.md#composite-lookup-methods)
- Depends on: [Shape-Indexed Signal Types (ADR-0018)](0018-shape-indexed-signal-types.md)
- Builds on: [Composite Lookup Methods Track Structural Changes (ADR-0015)](0015-composite-lookup-methods-track-structural-changes.md)
