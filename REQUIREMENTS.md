# Cause & Effect - Requirements

This document captures the vision, audience, constraints, and boundaries of the library. It survives version bumps. It guides the decision about what belongs in the library.

> **Signal taxonomy is in transition.** v1.x ships nine signal types indexed by shape *and* origin.
> The target described below is the shape-indexed taxonomy of
> [ADR-0018](adr/0018-shape-indexed-signal-types.md), accepted for v2.0. Its construction API
> ships as a bridge: `createList`, `createStore`, `deriveList`, and `deriveStore` keep their 1.x
> names, and the single-value `createCell`/`deriveCell` follow in 1.5.1, deprecating the
> one-release-old `deriveSignal`. Deferred to v2.0: the origin-indexed names (`State`, `Memo`,
> `Task`, `Sensor`, `Collection`, their guards, and the `createMemo`/`createTask`/`createSensor`
> factories) and `createSignal`'s shape dispatch. Where the two differ, the v1.x API is named
> explicitly.

## Vision

Cause & Effect is a **primitives-only reactive state management library** for TypeScript. It provides the building blocks that library authors and experienced developers need. Those blocks manage complex, dynamic, composite, and asynchronous state in one signal graph, correctly and fast.

The library is deliberately **not a framework**. It has no opinion about rendering, persistence, or application architecture. It is a thin, trustworthy layer over JavaScript. It gives the guarantees of fine-grained reactivity without the common pitfalls of imperative code.

## Audience

### Primary: Library Authors

TypeScript library authors, frontend or backend, who need a reactive foundation to build on. A consuming library must not have to implement its own reactive primitives. The set of signal types is broad for that reason. External data feeds, derived async values, and keyed collections all belong in one graph, not in ad-hoc extensions.

Cause & Effect is open source, built to power **Le Truc**, a Web Component library by Zeix AG.

### Secondary: Experienced Developers

Developers who write framework-agnostic web applications with a thin layer over JavaScript. They value explicit dependencies, predictable updates, and type safety over the convenience of a full framework. They compose their own rendering and application layers on top of reactive primitives.

## Design Principles

### Explicit Reactivity
A `.get()` call tracks a dependency automatically. The relationship stays clear and predictable, because the graph always reflects the true dependency structure.

### Non-Nullable Types
Every signal enforces `T extends {}`, which excludes `null` and `undefined` at the type level. A developer can therefore trust the returned type. No null check is needed after a value enters the graph.

### Unified Graph
Every signal type joins the same graph, with the same propagation, batch, and cleanup semantics. Composite signals and asynchronous signals are first-class, not afterthoughts.

### Every Shape Is Derivable
Every state that can be derived must be derivable. This is a requirement on the API surface, not advice to the developer.

An imperative write from inside an effect creates a dependency the graph cannot see. The graph knows that the effect reads `A`, and it knows that `B` exists, but not that `B` depends on `A`. Five consequences follow, and all of them are mechanical rather than stylistic:

1. `B` is stale for a whole flush pass, so any effect that reads `B` in the same flush sees the previous value.
2. Equality suppression is lost. The effect ran, so `B` is written even when `A` recomputed to an equal value.
3. There is no abort-on-change, so an out-of-order asynchronous response overwrites a newer one.
4. `B` has no lazy lifecycle. It stays alive when nothing observes it.
5. The multi-pass `flush()` and `EffectConvergenceError` exist mainly to keep this pattern from diverging.

A developer reaches for this pattern when the library offers no derivation for the shape they need. The corrective is therefore an API in which no such gap exists, and in which a derived signal has no setter to reach for. Writing *outward* — to the DOM, the network, or storage — remains what an effect is for.

### Minimal Surface, Maximum Coverage
Signal types are indexed by the **shape** of the data and by whether the consumer may write. They are not indexed by origin. How a signal came to hold its value is a property of its construction, not of its consumption contract.

| Type | Shape | Consumer may write |
|------|-------|--------------------|
| **`Signal<T>`** | Single value | No |
| **`MutableSignal<T>`** | Single value | Yes |
| **`List<T>`** | Keyed sequence — stable identity, per-item reactivity | No |
| **`MutableList<T>`** | Keyed sequence | Yes |
| **`Store<T>`** | Keyed record — proxy-based, per-property reactivity | No |
| **`MutableStore<T>`** | Keyed record | Yes |

Two primitives are orthogonal to shape and complete the set:

| Type | Role |
|------|------|
| **`Effect`** | Side-effect sink; terminal, holds no value |
| **`Slot<T>`** | Integration-layer abstraction over `{ get, set? }`; delegates to a swappable backing signal and ignores its other methods |

This set is **complete**. One question decides inclusion. Does the type represent a data shape or a graph role that no composition of the existing types expresses correctly or fast? A new *origin* is never grounds for a new type.

### Construction Covers Every Cell

Four origins apply to all three shapes. Every cell in the matrix is reachable:

| Origin | Single value | Keyed sequence | Keyed record |
|--------|--------------|----------------|--------------|
| Mutable source | `createCell(value)` | `createList(array)` | `createStore(record)` |
| Sync derivation | `deriveCell(fn)` | `deriveList(fn)` | `deriveStore(fn)` |
| Async derivation | `deriveCell(asyncFn, { initial })` | `deriveList(asyncFn, { initial })` | `deriveStore(asyncFn, { initial })` |
| External push | `deriveCell(seed, { watched })` | `deriveList(seed, { watched })` | `deriveStore(seed, { watched })` |

`create*` yields a mutable type; `derive*` yields a readonly one. A derived signal has no setter, so an imperative write to it is a compile error rather than a convention to remember. `createCell(value)` takes a single value verbatim, with no shape conversion; the 1.x `createSignal(value)` keeps its wider dispatch (array → `List`, record → `Store`) until 2.0 removes it.

`watched` is an option, never a callback position: a synchronous derivation callback and an external-push callback are indistinguishable at runtime, and neither can be called to find out which it is.

In 2.0 the narrow entry points cover the single-value shape only: `createCell`, with `createState` as its alias, and `deriveComputed(fn)` for a sync-only derivation. They exist for tree-shaking: a bundle of `createState`, a sync derivation, and `createEffect` must not pull in `AbortController` or the watched lifecycle. `createTask` and `createSensor` have no 2.0 counterpart — async derivation and external push pull their machinery in through `deriveCell` regardless of the factory name. See [ADR-0018](adr/0018-shape-indexed-signal-types.md).

### Graph Utilities

Seven utilities complete the public API alongside the signal types:

| Utility | Role |
|---------|------|
| `batch(fn)` | Defer effect execution until the end of the batch |
| `untrack(fn)` | Read signals without creating dependency edges |
| `unown(fn)` | Detach child scopes and effects from the current owner |
| `createScope(fn, options?)` | Create a standalone ownership scope without a computation. `ScopeOptions { root?: boolean }`: set `root: true` to opt out of parent registration, for an owner with an external lifecycle such as a web component |
| `match(signal(s), handlers)` | Conditional dispatch on signal state (`nil` > `err` > `stale` > `ok`) |
| `isPending(signal)` | Whether an asynchronously derived signal has settled. Reactive. `false` for a signal with no async origin |
| `abort(signal)` | Cancel in-flight asynchronous work. No-op for a signal with no async origin |

`match()` belongs with `createEffect`. Both handle side effects that follow a state change. `match()` is the primary API to branch an effect over a pending or errored signal, and it runs inside an effect.

`isPending()` and `abort()` are utilities rather than methods because asynchrony is an origin, not a shape. Any of the three shapes can be derived asynchronously, so a method would either force three async subtypes or add a closure to every node on the synchronous hot path. In v1.x these are methods on `Task`.

### Utility Function Exports

A small set of utility functions is exported for the benefit of library authors:

| Function | Status |
|----------|--------|
| `isSignalOfType(value, type)` | Intentionally stable — the canonical signal type guard primitive. Zero allocations (`Symbol.toStringTag` direct check). |
| `isFunction`, `isRecord`, `valueString` | Intentionally stable — used by Le Truc. |
| `isObjectOfType` | Deprecated. Will be removed in v2.0. (`isSignalOfType` replaces `isObjectOfType` for signal guards.) |

Type guards follow the taxonomy. They are indexed by shape and mutability: `isSignal`, `isList`, `isStore`, `isMutableSignal`, `isMutableList`, `isMutableStore`, and `isSlot`. `isSignalOfType(value, type)` remains the primitive, matching against the shape carried in `Symbol.toStringTag`.

The v1.x origin guards `isState`, `isMemo`, `isTask`, `isSensor`, `isCollection`, and `isComputed` have no referent once types are shape-indexed. They are removed in v2.0.

## Runtime Environments

- All evergreen browsers
- Bun
- Modern Node.js (with ES module support)
- Deno

The core uses no browser-specific API. Environment-specific behavior, such as a DOM event or a network connection, belongs in a user-provided callback. That is the `watched` option, which is the single mechanism by which an external source enters the graph.

## Size and Performance Constraints

### Bundle Size

Two figures, doing two different jobs.

| Usage | Role | Minified | Gzipped |
|-------|------|----------|---------|
| Core only (`createState`, `createMemo`, `createTask`, `createEffect`) | **Promise** — hard, never relaxed | — | Below 4 kB (4096 B) |
| Full library (all signal types + utilities) | **Diagnostic** — working ceiling, re-baselined per release | Below 32 kB (32768 B) | Below 10 kB (10240 B) |

**The core figure is the promise.** Because the library is tree-shakable, an application pays only for the construction paths it imports. What a typical consumer actually ships is the core figure, not the full-library one, so that is the number that carries the commitment in Success Criterion 6. It is a hard limit and is not relaxed for refactoring. If it regresses, do not raise it — correct the claim in `REQUIREMENTS.md` and `README.md` to the real figure and raise it with the Architect.

**The full-library figure is a diagnostic.** It exists to catch an accidental blowup — a dependency pulled in whole, a factory that defeats tree-shaking — not to be optimised against byte by byte. It is a working ceiling with deliberate slack, and it is re-baselined from measurement at each release rather than treated as a constant.

Re-baselining is a release gate, not a routine edit. Lowering the ceiling toward measured usage at release time is what keeps the diagnostic meaningful; raising it mid-branch to unblock a commit is what makes it meaningless.

The library must remain tree-shakable. An import of one construction path must not pull in the others. This constraint is why the narrow single-value factories are retained alongside `createSignal` and `deriveCell`, and it is what makes the core figure the one that matters.

### Performance

The synchronous path — mutable source, synchronous derivation, and effect propagation — must be competitive with the current leaders in fine-grained reactivity: Preact Signals, Solid, and Alien Signals. The differentiator is not the fastest micro-benchmark. It is the integration of async, external input, and composite signals at no cost to the synchronous path.

## Non-Goals

The following are out of scope. The library does not add them:

- **Rendering**: No DOM manipulation, no virtual DOM, no component model, no template system. A consuming library or the application code renders.
- **Persistence**: No serialization, no local storage, no database integration. State enters and leaves the graph through signals. Storage is out of scope.
- **Framework-specific bindings**: No React hooks, no Vue composables, no Angular decorators. A consuming library builds its own integration.
- **DevTools protocol**: An effect attached to any signal reveals its current value and its update behavior. A dedicated protocol adds complexity without proportional value.
- **Additional signal types**: The type set is complete. A new type enters consideration only if a data shape or graph role appears that no composition of the existing types expresses correctly or fast. A new way of *producing* a value is a construction concern and never grounds for a new type.

## Stability

The library is stable at 1.0.0. New features enter reluctantly. Bundle size and conceptual simplicity are the two gatekeeping criteria.

- **Breaking changes** require a major version bump. They are justified by a major Web Platform feature that shifts the best way to reach the existing goals, or by a demonstrated failure of the mental model that no additive change can repair. A failure of the mental model must be evidenced by observed misuse, not anticipated. The shape-indexed taxonomy of [ADR-0018](adr/0018-shape-indexed-signal-types.md) is admitted under the second clause: the derivation matrix has empty cells, and users fall back to imperative writes from effects because no derivation exists for the shape they need.
- **New non-breaking features** must meet three conditions. They fill a genuine gap that a consuming library would otherwise implement itself. They fit the existing mental model. They add no conceptual weight.
- **Backward compatibility** is maintained from 1.0 onward.

## Success Criteria

The library succeeds when:

1. A consuming library, such as Le Truc, implements no reactive primitive that the graph already covers.
2. The mental model holds. A developer predicts propagation from the graph structure alone.
3. No correct program needs an imperative write from inside an effect to move a value between signals. Every such pipeline has a derivation, and the derived result has no setter to write to.
4. The type system catches at compile time what would otherwise surface as a runtime null check or a stale-value bug.
5. Performance stays competitive on standard reactivity benchmarks, with no special case for a benchmark.
6. The library stays small enough that it does not add a measurable bundle-size concern to a production application.
