# ADR 0016: Path-Scoped Cycle Detection in Deep Equality

## Status

✅ Accepted

## Context

[ADR-0005](0005-cycle-detection-omission-in-deep-equality.md) decided against cycle detection in `deepEqual`/`DEEP_EQUALITY`, on the grounds that `DEEP_EQUALITY` "has never shipped in a release" and the deprecated `isEqual` alias "has no known consumers" — making a stack overflow on circular input an acceptable, low-blast-radius outcome.

Both premises no longer hold, and one of them did not hold even when ADR-0005 was written:

- `Store.set()` / `Store.update()` call `diffRecords()`, which runs `DEEP_EQUALITY` on every property comparison **unconditionally, with no override**. Any `Store` holding a self-referencing plain object (a parent pointer, a tree/graph node, a cached back-reference — ordinary, non-pathological data shapes) crashes on the first `set()`.
- `List` and `Collection` default `itemEquals` to `DEEP_EQUALITY` (overridable, but it is what most consumers use).
- `Store`/`List`/`Collection` wrap arbitrary **user-supplied plain objects** — that is their entire purpose. A stack overflow triggered by ordinary application data going through the default path of the library's most commonly used composite signal types is a much larger blast radius than ADR-0005 assumed.
- Git history shows `DEEP_EQUALITY` became the shipped Store/List/Collection default on 2026-04-17 (`3acf29e`, v1.2.0) — over a month before ADR-0005 was documented (2026-05-21). The ADR's "never shipped" / "no known consumers" framing was already inaccurate when written.

There is also direct prior art: before v1.2.0, `list.ts` had a private `isEqual` with correct cycle handling — a `WeakSet` populated with both operands per recursive pair, cleaned up via `try`/`finally` after each call (so it tracked only the *current recursion path*, not everything ever visited), throwing `CircularDependencyError` on an actual cycle. This was removed when `DEEP_EQUALITY` was unified into `graph.ts`, and ADR-0005 retroactively rationalized the removal.

A branch fixing unrelated bugs (`bugfix/code-audit-fixes`) independently re-added a cycle guard to `deepEqual` in `graph.ts`, but with a regression relative to the pre-v1.2.0 implementation: a single `WeakSet` keyed only on `a`, with entries added but **never removed**. This tracks "every object ever visited during this top-level call," not "objects on the current path," so two non-cyclic but aliased/shared sub-objects (e.g. two array elements pointing at the same default object) compared against two different counterparts produce false-positive equality the second time the shared object is encountered:

```ts
const shared = { val: 1 }
DEEP_EQUALITY([shared, shared], [{ val: 1 }, { val: 2 }]) // → true (wrong: second pair differs)
```

## Decision

Reinstate cycle detection in `deepEqual` (`src/graph.ts`), scoped to the current recursion path rather than the whole call:

- Add the current operand to a `WeakSet` before recursing into its children; remove it in a `finally` block after the comparison returns. This flags only genuine cycles (an object reachable from itself via the active recursion path) and never poisons later, unrelated comparisons of an object that merely appears more than once in the input.
- When a cycle is detected, treat the pair as equal and let the rest of the structure continue comparing normally, matching the convention used by Node's `util.isDeepStrictEqual` and Lodash's `isEqual` (memoize recurring pairs as equal rather than erroring).
- Do **not** revert to the pre-v1.2.0 behavior of throwing `CircularDependencyError` on a detected cycle. That error type already has an unrelated, established meaning in this library — a cycle in the *reactive graph* (`refresh()`'s `FLAG_RUNNING` guard) — and reusing it for a cycle in *user data* conflates two different failure modes. Equality predicates are also conventionally expected not to throw.

## Alternatives Considered

- **(a) Keep ADR-0005's "no cycle detection"**: Rejected. Reachable via ordinary `Store`/`List`/`Collection` usage with self-referencing plain objects; a stack-overflow crash on default usage of the library's most common composite types is worse than a small `WeakSet` allocation on the object/array comparison path.
- **(b) Keep the branch's "ever visited" `WeakSet` (single-operand, never removed)**: Rejected. Verified false positives on aliased/shared non-cyclic sub-objects (see Context).
- **(c) Revert to pre-v1.2.0 behavior (throw `CircularDependencyError` on cycle)**: Rejected. Overloads an error type already meaning "reactive graph cycle" for a second, unrelated concept; diverges from the ecosystem convention (Node, Lodash) for cyclic deep-equality; surprises callers who use `equals` as a non-throwing predicate.
- **(d) Path-scoped `WeakSet`, cycle ⇒ equal** *(chosen)*: Only flags genuine cycles, correctly allows DAG-shared substructures to compare independently, and matches established conventions without overloading existing error semantics.

## Consequences

- ✅ Correctness restored for circular plain objects/arrays passed through `Store`, `List`, `Collection` — their default, and for `Store` non-overridable, equality path.
- ✅ No false positives on aliased/shared but non-cyclic substructures (verified against the failing case in Context).
- ✅ No new error type or throwing behavior introduced; matches Node/Lodash convention, reducing surprise for consumers passing `DEEP_EQUALITY` as an `equals` option.
- ⚠️ Re-introduces the `WeakSet` allocation and `try`/`finally` overhead that ADR-0005 removed for performance. Paid only on the recursive object/array comparison path (primitive-only signal values are unaffected); the buggy version of this guard already in the branch showed no regression on the `storeUpdate` benchmark, so the corrected, path-scoped version (same allocation shape, one add/delete per recursion level) is not expected to regress further.
- ⚠️ Supersedes ADR-0005 outright — its rationale no longer matches reality, and arguably did not match reality even when it was written (see Context).
- ⚠️ Diverges from the pre-v1.2.0 throwing behavior. Any (undocumented, unlikely) consumer relying on `CircularDependencyError` from `isEqual` on circular input will instead see the comparison resolve to `true`. Accepted per Alternative (c).

## Related

- Requirements: [Size and Performance Constraints](../REQUIREMENTS.md#size-and-performance-constraints)
- Supersedes: [ADR-0005](0005-cycle-detection-omission-in-deep-equality.md)
- Related: [ADR-0004](0004-isequal-placement-and-deprecation.md) (isEqual placement and deprecation), [ADR-0003](0003-equality-strategy-naming-convention.md) (equality strategy naming convention)
- Tracking: TODO.md CE-010
