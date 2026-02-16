# Cause & Effect - Requirements

This document captures the vision, audience, constraints, and boundaries of the library. It is intended to survive version bumps and guide decisions about what belongs in the library and what does not.

## Vision

Cause & Effect is a **primitives-only reactive state management library** for TypeScript. It provides the foundational building blocks that library authors and experienced developers need to manage complex, dynamic, composite, and asynchronous state — correctly and performantly — in a unified signal graph.

The library is deliberately **not a framework**. It has no opinions about rendering, persistence, or application architecture. It is a thin, trustworthy layer over JavaScript that provides the comfort and guarantees of fine-grained reactivity while avoiding the common pitfalls of imperative code.

## Audience

### Primary: Library Authors

TypeScript library authors — frontend or backend — who need a solid reactive foundation to build on. The library is designed so that consuming libraries should not have to implement their own reactive primitives. The extensive set of signal types exists precisely so that patterns like external data feeds, async derivations, and keyed collections are handled correctly within a unified graph rather than bolted on as ad-hoc extensions.

Cause & Effect is open source, built to power **Le Truc**, a Web Component library by Zeix AG.

### Secondary: Experienced Developers

Developers who want to write framework-agnostic web applications with a thin layer over JavaScript. They value explicit dependencies, predictable updates, and type safety over the convenience of a full framework. They are comfortable composing their own rendering and application layers on top of reactive primitives.

## Design Principles

### Explicit Reactivity
Dependencies are automatically tracked through `.get()` calls, but relationships remain clear and predictable. There is no hidden magic — the graph always reflects the true dependency structure.

### Non-Nullable Types
All signals enforce `T extends {}`, excluding `null` and `undefined` at the type level. This is a deliberate design decision: developers should be able to trust returned types and never have to do null checks after a value enters the signal graph.

### Unified Graph
Every signal type participates in the same dependency graph with the same propagation, batching, and cleanup semantics. Composite signals (Store, List, Collection) and async signals (Task) are first-class citizens, not afterthoughts. The goal is that all state which is derivable can be derived.

### Minimal Surface, Maximum Coverage
The library ships 9 signal types — each justified by a distinct role in the graph and a distinct data structure it manages:

| Type | Role | Data Structure |
|------|------|----------------|
| **State** | Mutable source | Single value |
| **Sensor** | External input source | Single value (lazy lifecycle) |
| **Memo** | Synchronous derivation | Single value (memoized) |
| **Task** | Asynchronous derivation | Single value (memoized, cancellable) |
| **Effect** | Side-effect sink | None (terminal) |
| **Slot** | Stable delegation (integration layer) | Single value (swappable backing signal) |
| **Store** | Reactive object | Keyed properties (proxy-based) |
| **List** | Reactive array | Keyed items (stable identity) |
| **Collection** | Reactive collection (external source or derived) | Keyed items (lazy lifecycle, item-level memoization) |

This set is considered **complete**. The principle for inclusion is: does this type represent a fundamentally different data structure or role in the graph that cannot be correctly or performantly expressed as a composition of existing types?

## Runtime Environments

- All evergreen browsers
- Bun
- Modern Node.js (with ES module support)
- Deno

The library uses no browser-specific APIs in its core. Environment-specific behavior (DOM events, network connections) is the responsibility of user-provided callbacks (Sensor start functions, Collection start callbacks, watched callbacks).

## Size and Performance Constraints

### Bundle Size

| Usage | Target |
|-------|--------|
| Core signals only (State, Memo, Task, Effect) | Below 5 kB gzipped |
| Full library (all 9 signal types + utilities) | Below 10 kB gzipped |

The library must remain tree-shakable: importing only what you use should not pull in unrelated signal types.

### Performance

The synchronous path (State, Memo, Effect propagation) must be competitive with current leaders in fine-grained reactivity (Preact Signals, Solid, Alien Signals). The library's differentiator is not being the absolute fastest on micro-benchmarks, but seamlessly integrating async (Task), external observers (Sensor, Collection), and composite signals (Store, List, Collection) without sacrificing sync-path performance.

## Non-Goals

The following are explicitly out of scope and will not be added to the library:

- **Rendering**: No DOM manipulation, no virtual DOM, no component model, no template system. Rendering is the responsibility of consuming libraries or application code.
- **Persistence**: No serialization, no local storage, no database integration. State enters and leaves the graph through signals; how it is stored is not this library's concern.
- **Framework-specific bindings**: No React hooks, no Vue composables, no Angular decorators. Consuming libraries build their own integrations.
- **DevTools protocol**: Debugging is straightforward by design — attaching an effect to any signal reveals its current value and update behavior. A dedicated debugging protocol adds complexity without proportional value.
- **Additional signal types**: The 9 signal types are considered complete. New types would only be considered if major Web Platform changes shift the optimal way to achieve the library's existing goals.

## Stability

Version 0.18 is the last pre-release before 1.0. The API surface — how signals are created and consumed — is considered stable. From 1.0 onward:

- **Breaking changes** are expected only if major new features of the Web Platform shift the optimal way to achieve the goals this library already does.
- **New features** are not expected. The signal type set is complete.
- **Backward compatibility** becomes a concern at 1.0. Prior to that, all known consumers (Le Truc and one other library) are maintained by Zeix AG and can adapt to changes.

## Success Criteria

The library succeeds when:

1. Consuming libraries (Le Truc and others) do not need to implement their own reactive primitives for patterns the signal graph already covers.
2. The mental model is understandable: developers can predict how changes propagate by understanding the graph structure.
3. The type system catches errors at compile time that would otherwise surface as runtime null checks or stale state bugs.
4. Performance remains competitive on standard reactivity benchmarks without special-casing for benchmarks.
5. The library remains small enough that it does not meaningfully contribute to bundle size concerns in production applications.
