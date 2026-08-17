# ADR 0015: Composite Lookup Methods Track Structural Changes (Asymmetrically)

## Status

✅ Accepted

## Context

The direct-lookup methods on composite signals — `at()`, `byKey()`, `keyAt()`, and `indexOfKey()` on **List** and **Collection**, and `byKey()` on **Store** — historically created **no graph edge**. They were raw reads into the internal `keys[]` array / `signals` map. Calling `byKey(k)` inside an effect or memo therefore did *not* subscribe to structural changes: the effect would silently fail to re-run when the key was added, removed, or reordered.

This was a documented footgun (the `direct_lookups_do_not_track` entry in `non-obvious-behaviors.md`), requiring consumers to defensively read `keys()`, `length`, or `get()` first to establish a structural edge before using a direct lookup. The workaround was unintuitive and easy to forget, especially because `byKey`/`at` *look* reactive.

The goal of this decision is to remove that footgun. The design question is whether the fix should apply **uniformly** to all composite types or **asymmetrically**, because List/Collection and Store differ in a structurally important way.

The two composite shapes:

- **List / Collection** — keys are runtime-generated `string`s. The *only* way to reach a specific item's signal is `byKey(k)` or `at(i)`. A key can disappear (removed) while a consumer still holds a reference to it.
- **Store** — keys are the statically-known properties of `T`. The idiomatic access is the proxy (`store.prop`) → `byKey` → child `State` → `.get()`, which forms a **property-level** edge. Per-property reactivity is Store's defining feature.

Relevant: [Explicit Reactivity](REQUIREMENTS.md#explicit-reactivity), [Non-Nullable Types](REQUIREMENTS.md#non-nullable-types) (Store keys are statically non-nullable), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage), [Two-Path Access Pattern (ADR-0014)](0014-two-path-access-pattern-for-composite-signals.md).

## Decision

Apply tracking **asymmetrically**, matching each composite type's access model.

### List and Collection — lookups track structure

`at()`, `byKey()`, `keyAt()`, and `indexOfKey()` now call `subscribe()` (the same O(1) structural-consumer edge that `keys()`, `length`, and `get()` already create). `deriveCollection` uses `ensureFresh()` instead of `subscribe()`, because its node can be stale from upstream tracked changes (its keys come from a tracked source rather than local mutation) — matching what `length`/`keys()`/`get()` already do there.

Reading any of these methods inside an effect or memo now re-runs on key add/remove/reorder. Return types are unchanged: `byKey(k): S | undefined`, `at(i): S | undefined`, `keyAt(i): string | undefined`, `indexOfKey(k): number`. The `| undefined` is honest — a runtime string genuinely may not be a present key — and is no longer a tracking workaround.

The consumer edge is **independent** of the two-path pattern in ADR-0014, which governs *value-rebuild* edges (child signal → composite node). `subscribe()`→`link()` is O(1) with the ADR-0013 fast-path checks and never triggers value-rebuild relinking.

Internal consequence for `deriveCollection`: the per-item `Memo`/`Task` callback previously read `source.byKey(key)?.get()`. Once `byKey` tracks, that single expression would create *both* a structural edge (unwanted — it would make every per-item memo recompute on any structural change) and an item-value edge (wanted — it lets the memo react to `item.set()`). The implementation therefore splits it: `untrack(() => source.byKey(key))` suppresses the structural edge, then `itemSignal.get()` keeps the item-value edge tracked. Key synchronization continues to be handled by `syncKeys()` reading `source.keys()`.

A latent inefficiency in `List.replace()` was exposed and fixed: now that `byKey(k).get()` can create both an item-edge and a structural edge, `replace()`'s `signal.set()` and node-propagation each flushed separately, firing such subscribers up to three times. The two propagations are now wrapped in `batch()` so they flush once.

### Store — lookups deliberately do NOT track structure

`Store.byKey()` and proxy property access (`store.prop`) remain **untracked** for structural changes. Store keys are statically known from `T`, and proxy reads are already granular: `store.name` returns the child `State`, whose `.get()` forms a *property-level* edge. Adding a structural edge on top would make every property read also subscribe to "any key added/removed," so `store.set({ name, age: 26 })` would re-run the `name` effect even when `name` is unchanged — defeating per-property reactivity.

Consumers who want whole-store structural reactivity read `store.keys()`, `store.get()`, or iterate the store (`for (const [key, signal] of store)`), all of which track structure.

## Alternatives Considered

### For List / Collection

- **(a) Throw on missing key → non-nullable return type**: Rejected. Replaces a null-check with a catch-check, conflicts with the [Non-Nullable Types](REQUIREMENTS.md#non-nullable-types) principle (absence is modelled explicitly, not via thrown control flow), and is a breaking change.
- **(b) Add `*OrThrow` siblings** (`byKeyOrThrow`, `atOrThrow`): Rejected. Replaces today's risky `!` non-null-assert with a checked variant, but adds API surface against the [Minimal Surface](REQUIREMENTS.md#minimal-surface-maximum-coverage) grain for a niche need.
- **(c) Keep `| undefined` and track** *(chosen)*: The `| undefined` remains honest (the key may genuinely be absent), and tracking removes the defensive `keys()` pre-read. Minimal, additive, non-breaking.

### For Store

- **(a) Track uniformly with List/Collection**: Rejected. Breaks granular property-level subscriptions — verified by the `should support granular property-level subscriptions` test. `store.set({ name: 'John', age: 26 })` would spuriously re-run the `name` effect.
- **(b) Leave untracked** *(chosen)*: Store proxy access is already the correct granular path; Store keys are statically typed and cannot "disappear" from under a typed reference the way a runtime key can. The original `direct_lookups_do_not_track` footgun did not apply to Store.

### Cross-cutting

- **(c) Force uniformity for consistency**: Rejected. The asymmetry is not accidental — it maps to a real semantic difference between dynamic-keyed collections and statically-keyed stores. Uniformity would trade one documented footgun for spurious over-firing that is *harder* to debug (over-firing resembles a framework bug; under-firing had a documented workaround).

## Consequences

- ✅ **Footgun removed for List/Collection**: reading `byKey`/`at`/`keyAt`/`indexOfKey` inside a computation now behaves as every consumer assumes. The `direct_lookups_do_not_track` non-obvious-behavior entry is deleted; the defensive `keys()` pre-read is no longer required.
- ✅ **Honest types preserved**: `| undefined` on List/Collection lookups now means only "the key may be absent," never "I must defend against non-tracking."
- ✅ **Store granularity intact**: per-property reactivity is unaffected; no spurious re-runs.
- ✅ **No performance regression on the sync path**: the consumer edge is O(1) and does not trigger value-rebuild relinking (ADR-0013 fast-paths; ADR-0014 two-path pattern untouched). `List.replace()` is now batched, reducing redundant flushes for subscribers holding both edges.
- ⚠️ **`List.replace()` perf baseline shifted**: the regression benchmark `listReplace` moved from ~0.6 ms (stable) to ~1.3 ms (limit 1.6 ms) due to the batch wrapper. Within tolerance; flagged for monitoring.
- ⚠️ **Behavior change (not API/type-breaking)**: effects that read *only* List/Collection lookup methods will now re-run on structural changes where they previously did not. This is the intended fix, but consumers relying on the old non-tracking behavior (rare, and previously documented as wrong) may see additional runs.
- ⚠️ **Asymmetry requires documentation**: the difference between List/Collection (tracked) and Store (untracked) must be explained clearly in ARCHITECTURE.md and this ADR, so it is read as a principled design choice rather than an oversight.

## Clarification: Iterators also track

This ADR originally addressed only the direct-lookup methods. The `Symbol.iterator` of every composite type is a structural accessor of the same class and was extended to track identically:

- **List / Collection** — `*[Symbol.iterator]()` calls `subscribe()` (`createCollection`) or `if (activeSink) link(node, activeSink)` + `ensureFresh()` (`deriveCollection`), matching each type's sibling accessors. Because these are generator methods, the edge is established lazily on first `.next()`, not when the iterator object is created — `for…of`, spread, and `Array.from` all advance immediately, so iteration subscribes as expected.
- **Store** — `*[Symbol.iterator]()` calls `subscribe()`. This is consistent with, not a contradiction of, the Store decision above: the Store iterator yields `[key, signal]` pairs and is a **whole-store traversal**, exactly like `store.keys()` and `store.get()` which already track. The only untracked Store accessors remain the granular per-property paths (`byKey` and the proxy), where a structural edge would defeat per-property reactivity. The principled line within Store is therefore **whole-store vs per-property**, and the iterator falls on the whole-store side.

This extension was motivated by a correctness gap surfaced during review: the `bykey_set_does_not_propagate_to_structural_subscribers` non-obvious-behavior entry promised `list.replace(key, value)` propagates "regardless of how subscribers are attached," but the iterator established no edge at all — so an effect using `for (const sig of list)` was notified by neither `byKey(k).set()` nor `replace()`. With iterators tracking, `replace()` now genuinely reaches every subscriber path and that promise holds.

No internal `untrack` guard was needed (unlike the `deriveCollection` per-item `byKey` lookup, which suppresses a structural edge to keep per-item memos narrow): internal callers (`buildValue`, `applyChanges`, `syncKeys`) use `source.keys()` or direct map iteration, never the public `Symbol.iterator`.

## Clarification (added 2026-08, external-push Stores)

The "untracked for structure" decision above governs *graph edges*, not *lifecycle*. For a
derived external-push Store — `deriveStore(seed, { watched })` — an effect that reads only
`store.prop` or `store.byKey(k)` still activates the `watched` lifecycle: such a store has
no other value source than the `emit` handed to `watched`, so without activation on
property reads the store would stay frozen at its seed forever.

The two concerns are separated by a **lifecycle anchor**: a source node that carries
watcher edges but never holds or propagates a value. Any observation form — structural
(`get()`/`keys()`/iterator) or per-property (`byKey`/proxy/`has`) — links the anchor,
which starts `watched` on the first edge and stops it when the last edge detaches
(reusing `unlink()`'s existing sink-count lifecycle, ADR-0011). The structural node is
linked only by the whole-store accessors, exactly as before: a property read still
creates no structural edge, so per-property granularity is preserved. Activation
(lifecycle) and tracking (edges) are separate concerns; this clarification changes only
the former.

## Related

- Requirements: [Explicit Reactivity](REQUIREMENTS.md#explicit-reactivity), [Non-Nullable Types](REQUIREMENTS.md#non-nullable-types), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
- Architecture: [Composite Lookup Methods](ARCHITECTURE.md#composite-lookup-methods)
- Dependencies: [Two-Path Access Pattern (ADR-0014)](0014-two-path-access-pattern-for-composite-signals.md), [Link Fast-Path Optimizations (ADR-0013)](0013-link-fast-path-optimizations.md), [FLAG_RELINK Mechanism (ADR-0010)](0010-flag-relink-mechanism-for-structural-reactivity.md), [activeSink Protocol (ADR-0009)](0009-activeSink-protocol-for-automatic-dependency-tracking.md)
