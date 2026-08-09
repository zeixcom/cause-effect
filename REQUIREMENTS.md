# Cause & Effect - Requirements

This document captures the vision, audience, constraints, and boundaries of the library. It survives version bumps. It guides the decision about what belongs in the library.

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
Every signal type joins the same graph, with the same propagation, batch, and cleanup semantics. Composite signals (Store, List, Collection) and the async signal (Task) are first-class, not afterthoughts. Every state that can be derived should be derived.

### Minimal Surface, Maximum Coverage
The library ships 9 signal types. Each has a distinct graph role and a distinct data structure:

| Type | Role | Data Structure |
|------|------|----------------|
| **State** | Mutable source | Single value |
| **Sensor** | External input source | Single value (lazy lifecycle) |
| **Memo** | Synchronous computed | Single value (memoized) |
| **Task** | Asynchronous computed | Single value (memoized, cancellable) |
| **Effect** | Side-effect sink | None (terminal) |
| **Slot** | Stable delegation (integration layer) | Single value (swappable backing signal) |
| **Store** | Reactive object | Keyed properties (proxy-based) |
| **List** | Reactive array | Keyed items (stable identity) |
| **Collection** | Reactive collection (external source or derived) | Keyed items (lazy lifecycle, item-level memoization) |

This set is **complete**. One question decides inclusion. Does the type represent a data structure or a graph role that no composition of the existing types expresses correctly or fast?

### Graph Utilities

Five utilities complete the public API alongside the signal types:

| Utility | Role |
|---------|------|
| `batch(fn)` | Defer effect execution until the end of the batch |
| `untrack(fn)` | Read signals without creating dependency edges |
| `unown(fn)` | Detach child scopes and effects from the current owner |
| `createScope(fn, options?)` | Create a standalone ownership scope without a computation. `ScopeOptions { root?: boolean }`: set `root: true` to opt out of parent registration, for an owner with an external lifecycle such as a web component |
| `match(signal(s), handlers)` | Conditional dispatch on signal state (`nil` > `err` > `stale` > `ok`) |

`match()` belongs with `createEffect`. Both handle side effects that follow a state change. `match()` is the primary API to branch an effect over a pending or errored signal, and it runs inside an effect.

### Utility Function Exports

A small set of utility functions is exported for the benefit of library authors:

| Function | Status |
|----------|--------|
| `isSignalOfType(value, type)` | Intentionally stable — the canonical signal type guard primitive. Zero allocations (`Symbol.toStringTag` direct check). |
| `isFunction`, `isRecord`, `valueString` | Intentionally stable — used by Le Truc. |
| `isObjectOfType` | Deprecated. Will be removed in v2.0. (`isSignalOfType` replaces `isObjectOfType` for signal guards.) |

Type guards for the 8 non-Effect signal types are exported and stable: `isState`, `isMemo`, `isTask`, `isSensor`, `isSlot`, `isList`, `isCollection`, and `isStore`.

## Runtime Environments

- All evergreen browsers
- Bun
- Modern Node.js (with ES module support)
- Deno

The core uses no browser-specific API. Environment-specific behavior, such as a DOM event or a network connection, belongs in a user-provided callback. Those are the Sensor callback, the Collection callback, and the `watched` option.

## Size and Performance Constraints

### Bundle Size

| Usage | Minified | Gzipped |
|-------|----------|---------|
| Core signals only (State, Memo, Task, Effect) | — | Below 4 kB (4096 B) |
| Full library (all 9 signal types + utilities) | Below 24 kB (24576 B) | Below 8 kB (8192 B) |

The full-library targets carry deliberate headroom above current usage, so that a routine bug fix is not blocked on a bundle-size regression. See `test/regression-bundle.test.ts` for the enforced limits.

The library must remain tree-shakable. An import of one signal type must not pull in the others.

### Performance

The synchronous path — State, Memo, and Effect propagation — must be competitive with the current leaders in fine-grained reactivity: Preact Signals, Solid, and Alien Signals. The differentiator is not the fastest micro-benchmark. It is the integration of async, external input, and composite signals at no cost to the synchronous path.

## Non-Goals

The following are out of scope. The library does not add them:

- **Rendering**: No DOM manipulation, no virtual DOM, no component model, no template system. A consuming library or the application code renders.
- **Persistence**: No serialization, no local storage, no database integration. State enters and leaves the graph through signals. Storage is out of scope.
- **Framework-specific bindings**: No React hooks, no Vue composables, no Angular decorators. A consuming library builds its own integration.
- **DevTools protocol**: An effect attached to any signal reveals its current value and its update behavior. A dedicated protocol adds complexity without proportional value.
- **Additional signal types**: The 9 signal types are complete. A new type enters consideration only if a major Web Platform change shifts the best way to reach the existing goals.

## Stability

The library is stable at 1.0.0. New features enter reluctantly. Bundle size and conceptual simplicity are the two gatekeeping criteria. The set of 9 signal types is complete.

- **Breaking changes** require a major version bump. They are justified only by a major Web Platform feature that shifts the best way to reach the existing goals.
- **New non-breaking features** must meet three conditions. They fill a genuine gap that a consuming library would otherwise implement itself. They fit the existing mental model. They add no conceptual weight.
- **Backward compatibility** is maintained from 1.0 onward.

## Success Criteria

The library succeeds when:

1. A consuming library, such as Le Truc, implements no reactive primitive that the graph already covers.
2. The mental model holds. A developer predicts propagation from the graph structure alone.
3. The type system catches at compile time what would otherwise surface as a runtime null check or a stale-value bug.
4. Performance stays competitive on standard reactivity benchmarks, with no special case for a benchmark.
5. The library stays small enough that it does not add a measurable bundle-size concern to a production application.
