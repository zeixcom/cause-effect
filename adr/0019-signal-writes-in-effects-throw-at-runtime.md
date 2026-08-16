# ADR 0019: Signal Writes in Effects Throw at Runtime

## Status

🔄 Proposed — 2026-08-16, for v2.0. Not accepted; see Review Notes below.

Would amend the bounded-convergence key decision in
[ARCHITECTURE.md](../ARCHITECTURE.md) § Key Decisions ("Effects writing signals they depend
on"), and extend the enforcement thesis of [ADR-0018](0018-shape-indexed-signal-types.md)
from compile time to runtime.

### Review Notes (2026-08-16)

A prototype implementation (`EffectWriteError`, the trusted-write window, guard calls at all
14 mutator entry points) was built and measured to validate the plan below: core bundle 2202 B
gzipped (within the 3072 B ceiling), no performance regression, 672 tests passing. The
mechanism works as designed. Held back on the merits, not the mechanics:

- **No simplification unlocked.** Decision 5 already concedes the convergence machinery
  (`flush()`, `scheduleEffect`, `EffectConvergenceError`) stays exactly as-is; this ADR is
  pure addition against the "would this let us delete something" bar, not a trade.
- **The guard is broader than the Context justifies.** Context motivates this around
  *invisible dependencies* — an effect writing a signal it also depends on. The implemented
  guard (Decision 1) throws on any synchronous write to any signal from an effect body, read
  or not — e.g. `createEffect(() => count.set(1))` throws even though `count` is never read
  and no cycle exists. That is a defensible *stricter* rule ("effects write outward, full
  stop" — REQUIREMENTS.md), but it is a different, larger claim than "prevents invisible
  dependencies," and the Consequences section should not lean on the narrower framing while
  shipping the broader rule. The Alternatives section's rejection of the narrower guard was on
  detection-cost grounds only, not because the broader rule was independently desired.
- **Escape-hatch cost.** The trusted-write window is a second piece of module state
  (`trustedWriteDepth`) that must stay synchronized with every future internal emit path, on
  top of the guard itself needing a call at every future public mutator (Consequences,
  Maintenance).

Revisit if either: (a) a narrower, still-practical detection of the actual invisible-dependency
case is found (the rejected "ban only untracked writes" alternative, or a variant of it), or
(b) the broad rule is wanted on its own terms and the ADR is rewritten to argue for that
directly rather than via the invisible-dependency framing.

## Context

ADR-0018 closed the derivation matrix and removed setters from derived values. Writing a
*derived* target from inside an effect is now a compile error. But the anti-pattern has a
surviving form that no type can reject: writing a **mutable** signal from inside an effect.

```ts
// Still compiles after ADR-0018, still an invisible dependency.
const user = createTask(async () => fetchUser(id.get()))
const store = createStore({ name: '', email: '' })
createEffect(() => store.set(user.get()))
```

The graph knows the effect reads `user` and that `store` exists, but not that `store` depends
on `user`. All five mechanical consequences listed in
[REQUIREMENTS.md](../REQUIREMENTS.md) § Every Shape Is Derivable follow, and the multi-pass
`flush()` with `EffectConvergenceError` exists mainly to keep this pattern from diverging —
tolerance of the pattern, not endorsement of it.

ADR-0018's own thesis applies verbatim: a training-set prior is not answerable by prose. If
the write is reachable, it will be written.

A source audit established what is mechanically possible:

1. **The detection hook exists.** `runEffect` sets `activeSink` to the effect node for the
   duration of the body (`src/graph.ts:525`), and an `EffectNode` is distinguishable from a
   memo/task node by the same `'value' in node` test `refresh()` already uses
   (`src/graph.ts:550`).
2. **Write paths are heterogeneous.** `MutableSignal` writes go through `setState`; `List`
   and `Store` mutators write the structural node directly (`node.value = …` plus
   `propagate()`) and also call child-signal setters. There is no single write choke point
   below the public mutator methods.
3. **The library itself writes while an effect is active, legitimately.** Three internal
   paths run with `activeSink` set to an effect:
   - a sensor's `emit`, invoked from `watched` activation inside the effect whose first
     `get()` started it (`src/nodes/sensor.ts:101`);
   - a task's `pendingNode` flip after the sink is restored to the reading effect
     (`src/nodes/task.ts:69`);
   - the external-push `deriveList` form's `onChanges`, which writes child item signals and
     whose own comment anticipates "when emit is called inside one" (`src/nodes/list.ts:849`).

   These are external input *entering* the graph, not an effect writing inward — the
   activation merely happens to be triggered by a read inside an effect. A naive guard
   false-positives on all three.
4. **Detection is synchronous-only.** `activeSink` is restored in `runEffect`'s `finally`,
   so writes in asynchronous continuations (post-`await`, `setTimeout`) escape, as do writes
   in effect cleanup callbacks, which run before `activeSink` is set (`src/graph.ts:522`).

## Decision

### 1. Public mutators throw during an effect body

Every public mutator — `MutableSignal.set/update`, the seven `List` mutators
(`set`, `update`, `add`, `remove`, `replace`, `sort`, `splice`), the four `Store` mutators
(`set`, `update`, `add`, `remove`), and `Slot.set` — throws `EffectWriteError` when called
synchronously while an effect body is running. The error follows the `[where]` convention of
`src/errors.ts` (e.g. `[List.add]`) and names the corrective: derive the value, or write from
outside the effect.

The check is `activeSink` is an `EffectNode` and no trusted-write window is open (decision 2).
One module-state read plus one property check per write — negligible against the
`validateSignalValue` call already in every setter.

### 2. A trusted-write window exempts the library's own emit paths

A module-level counter, opened and closed like `batchDepth`, wraps the internal writes that
legitimately occur while an effect is active: sensor `emit`, task `pendingNode` transitions,
and the `onChanges` handlers of external-push `deriveList`/`deriveStore`. The guard throws
only at window depth zero.

This is the distinction the guard actually draws: not "code ran while an effect was active"
but "an effect wrote inward." External input pushed through `watched`/`emit` is the former;
a `.set()` in an effect body is the latter.

### 3. Effects only

Memo and task recompute bodies are unaffected. Writing a signal from inside a derivation is
the same anti-pattern, but the composite rebuild paths (`refreshComposite`, relink,
`onChanges` staging) require a full false-positive audit before they can be covered, and the
sink-kind discrimination is already in the check — extending it later is a one-line change
plus that audit.

### 4. `untrack` is the escape hatch; no new API

`untrack(() => sig.set(v))` nulls `activeSink` and therefore bypasses the guard. This is
documented as the deliberate opt-out for genuine feedback loops. An explicit
`allowWrites(fn)` utility was rejected as new surface against the Minimal Surface principle
for a capability `untrack` already expresses: run this outside the tracking scope.

### 5. The convergence machinery stays, with a shifted rationale

Multi-pass `flush()`, `scheduleEffect`, and `EffectConvergenceError` are retained. Effect-body
self-writes — the pattern the pass bound was built for — are now unreachable, but the
unguarded periphery can still diverge: a trusted `emit` during an effect's first observation
can re-dirty effects mid-flush, and so can a write inside an effect cleanup. The bound is the
backstop for those paths. Only its documented rationale changes.

### 6. The clamping pattern migrates

Converging self-writes (clamping, write-once initialization) were documented as legitimate.
They now throw. The migrations are genuine restructurings, each covered by an existing API:

- clamp at the write site (event handler or `update()`), not in a reaction to the value;
- reject invalid values up front with the signal's `guard` option;
- derive the clamped view with `deriveSignal`, leaving the raw input mutable.

## Alternatives Considered

**Ban only writes to signals the effect does not track.** Preserves the clamping pattern and
targets exactly the invisible dependency. Rejected: an effect's dependency set is unknown
until the run completes — a write to `B` before a later read of `B` is indistinguishable
from a write to an untracked signal at write time — so detection would have to be deferred
to end-of-run reconciliation, with a write log per run, an error thrown far from the stack
that caused it, and convergence handling still needed for self-writes. A rule whose
exception ("only what you don't read") is subtler than the rule is not a rule a training-set
prior can learn.

**Dev-mode-only guard.** Rejected: the library is ESM-only and environment-agnostic with no
dev/prod build split, and the precedent errors (`InvalidStoreMutationError`,
`CircularDependencyError`, `PromiseValueError`) are all always-on. A guard that vanishes in
production guards nothing.

**Guard inside `setState`.** Rejected on both counts: `List`/`Store` structural writes bypass
`setState` entirely, so the guard would be incomplete; and the internal callers (sensor
`emit`, task `pendingNode`) would false-positive without a bypass parameter, which is the
trusted-write window arrived at from the wrong end.

**Extend to memo/task bodies now (MobX-style).** Writing any signal from inside a derivation
would throw, as in MobX computeds. Deferred, not rejected: it requires auditing every
internal write in composite rebuild paths first (decision 3).

**Explicit escape-hatch API (`allowWrites(fn)`).** Rejected: new conceptual weight for a
capability `untrack` already provides; see decision 4.

## Consequences

**Positive**

- Success Criterion 3 — "no correct program needs an imperative write from inside an effect"
  — becomes mechanically enforced for the synchronous case. "Effects write outward" is a
  runtime invariant, not advice.
- The surviving mutable-target form of the ADR-0018 anti-pattern fails at the write site,
  synchronously, with the effect on the stack — instead of surfacing as a stale-value bug or
  an `EffectConvergenceError` a thousand flush passes later.
- External input through `watched`/`emit` is unaffected by construction, so sensors, tasks,
  and external-push composites keep their lazy activation semantics.

**Negative**

- Breaking beyond ADR-0018: documented converging self-write patterns now throw. Migration
  recipes are required (decision 6) and the shared reference entry
  `<self_writing_effects_converge_or_throw>` must be rewritten.
- Best-effort by construction: writes in asynchronous continuations and in effect cleanups
  escape the guard. Documented as such; the convergence bound remains the backstop for
  divergent loops through those paths.
- Bundle: the error class, the window counter, and ~14 guard calls land in the tree-shaken
  core (estimated 80–100 B gzipped against ~1000 B headroom on the 3072 B promise). The
  regression-bundle test must verify this; the core figure is never relaxed to accommodate
  it.
- Maintenance: every future public mutator must call the guard, and every future internal
  emit path must open the trusted window. Both are single-choke-point conventions, but they
  are conventions — a new mutator added without the guard silently reopens the hole.

## Related

- Requirements: [Every Shape Is Derivable](../REQUIREMENTS.md#every-shape-is-derivable),
  [Minimal Surface, Maximum Coverage](../REQUIREMENTS.md#minimal-surface-maximum-coverage),
  [Size and Performance Constraints](../REQUIREMENTS.md#size-and-performance-constraints),
  Success Criterion 3
- Architecture: [Key Decisions](../ARCHITECTURE.md#key-decisions) — amends the
  "Effects writing signals they depend on" row
- Extends: [ADR-0018](0018-shape-indexed-signal-types.md) § Context (the discouraged
  pattern) and § Consequences ("The corrective is a compile error")
