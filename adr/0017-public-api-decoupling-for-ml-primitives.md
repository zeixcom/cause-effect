# ADR 0017: Public-API Decoupling for ML Primitives

**Status**: Draft
**Date**: 2026-06-19
**Author**: @estherbrunner

## Context

The `Neuron` and `Layer` signal types (ADR 0015 / 0016) are slated for extraction into a
separate library, `correlation-prediction`, distinct from cause-effect's deterministic signal
graph. For a clean boundary, `correlation-prediction` should depend on `@zeix/cause-effect`
as a normal dependency and consume only its **published public API**, treating the graph
engine as a black box.

The current implementation does the opposite. `src/nodes/neuron.ts` and `src/nodes/layer.ts`
import roughly fifteen internal symbols from `src/graph.ts` — `FLAG_DIRTY`, `FLAG_CHECK`,
`FLAG_RUNNING`, `makeSubscribe`, `propagate`, `refresh`, `flush`, `link`, `trimSources`, the
field-mixin types (`SourceFields`, `SinkFields`, `OptionsFields`), and node-shape types
(`MemoNode`, `SinkNode`). `layer.ts` hand-rolls its own `recomputeLayer()` and flag juggling
instead of composing onto the shared propagation path. This is the coupling that blocks clean
extraction, and it is also the root of most correctness issues found in review
(duplicated `LayerNode` type, divergent propagation logic, dead gradient state).

This ADR evaluates whether the full feature set — forward propagation, `train()` backpropagation,
and multi-layer networks — can be expressed on the public API alone, and what (if any)
extension to cause-effect's public surface that would require.

## Decision

### The two topologies are orthogonal

The decisive insight: **the ML connection graph and the reactive value-dependency graph are
independent structures.**

- The **reactive graph** tracks value dependencies: when an input signal changes, derived
  signals recompute and effects re-run. This is cause-effect's job, and forward propagation
  is exactly this — a derivation over input signals.
- The **ML topology** tracks weighted connections: which inputs feed which neuron, the weights
  and bias on each edge, layer membership. Backpropagation traverses this topology *backward*
  to adjust weights.

Because the ML code already holds explicit references to its forward inputs (`node.inputs`),
it can traverse backward via recursive `input.train(...)` calls. It never needs to *read* the
reactive graph's edge structure to do backprop. This is why "reverse edges" (CE-012) are not
the right mechanism: they would duplicate, inside the reactive graph, topology information the
ML code already owns.

### Forward propagation → `createMemo` (no internals)

A Neuron's output is a pure derivation: weighted sum of input values plus an activation
function. This maps directly onto `createMemo`. The memo body reads each input via `.get()`
(for free automatic dependency tracking) and returns `activation(weightedSum)`. No internal
symbols are required.

### Backpropagation → weights as signals (no API extension)

The crux is `train(target)`. After weights change, the neuron's cached output is stale, but a
memo only recomputes when its **signal** dependencies change. In the current internals-based
code this is solved by directly setting `FLAG_DIRTY` and calling `propagate()`/`flush()`. On
the public API, the equivalent is to make the weights themselves a signal:

- Store weights + bias in a single `createState<number[]>`.
- The forward memo reads `weights.get()` alongside the inputs, so weights become a tracked
  dependency.
- `train(target)` computes the weight deltas, then updates them via
  `batch(() => weights.set(nextWeights))`. The graph invalidates and propagates normally —
  no manual flag manipulation, no `flush()` call.

Multi-layer backprop is the recursion already present in the current `train()`: after updating
its own weights, a Neuron calls `input.train(propagatedTarget)` for each Neuron input. Each
such call updates that neuron's weight signal, which propagates through the graph. The chain
works for arbitrary depth with no reverse edges.

**This requires zero extension to cause-effect's public API.**

### Approach considered and rejected: a public `invalidate()` primitive

An alternative would be to expose a memo-invalidation capability — the same primitive the
`watched` callback receives internally — so `train()` could mark the output stale without a
signal update. This is more general (useful for any memo whose value depends on non-signalized
external state), but it expands cause-effect's public surface for a need that is, today,
ML-specific. REQUIREMENTS.md is explicit about minimal surface and reluctant feature addition.

**`invalidate()` is held in reserve as a fallback.** If future `correlation-prediction` needs
(optimizer state, attention masks) prove hard to signalize cleanly, it should be proposed as
its own cause-effect ADR at that point, argued on general merit rather than ML convenience.

### Approach considered and rejected: a graph-internals entry point

Exposing `@zeix/cause-effect/graph` (field mixins, flags, `link`/`propagate`/`flush`) would
let the current low-level code move verbatim. It preserves micro-optimizations but widens
cause-effect's maintained surface, re-introduces exactly the coupling extraction is meant to
remove, and would force every internal graph refactor to consider an external consumer.
**Rejected.**

## Consequences

### Benefits
- Clean package boundary: `correlation-prediction` depends on `@zeix/cause-effect` as a normal
  dependency, importing only published exports.
- cause-effect keeps its minimal surface and its under-7 kB-gzipped bundle target — ML code
  leaves `index.ts` entirely.
- Most review correctness issues dissolve as a side effect: the duplicated `LayerNode` type
  disappears (Layer composes `createMemo` rather than defining a node), `layer.ts`'s divergent
  propagation is replaced by the shared path, and `getWeights` aliasing becomes a non-issue
  when weights are read from a state signal.

### Drawbacks
- Weights-as-signals adds one signal node per neuron. Acceptable at the educational scale ADR
  0015 scopes to (≤ 16 inputs); revisit if large-network performance matters.
- We lose direct flag manipulation, which is marginally faster. Correctness and boundary
  cleanliness outweigh this micro-optimization for the stated scope.

### Effect on existing TODO items
- **CE-012 (reverse edges)** is **re-scoped**: reverse edges are unnecessary under the
  recursive-`train()` model. The real task becomes validating the multi-layer `train()`
  recursion end-to-end (e.g. an XOR network), not adding a new edge type.
- **CE-013 through CE-016** (dynamic reconfiguration, sparse connectivity, custom loss,
  layer tests) transfer to `correlation-prediction`'s own planning once the package exists.

## Feasibility verdict

**Public-API-only decoupling is feasible for the full feature set** (forward, `train()`,
multi-layer via recursion) under the weights-as-signals approach, with **no cause-effect API
extension** required for the initial extraction. The refactor can proceed on this basis; the
`invalidate()` fallback is documented here for future reference only.

## Alternatives Considered

1. **Keep ML in cause-effect behind an experimental entry point** — rejected; a workspace
   package is the intended end state and avoids a second move later.
2. **Ship the internals-based code as-is in the new package** — rejected; it would import
   internal symbols across a package boundary, which TypeScript cannot even express without
   an internals entry point.

## Open Questions

1. Does weights-as-signals interact correctly with `equals` / `SKIP_EQUALITY` for fine-grained
   propagation across layers? To be verified in the test port (CE-021).
2. For large layers, is one `State<number[]>` per neuron acceptable, or should a layer share a
   single weight-matrix signal? Defer optimization until profiling shows a need.

## Tasks

See `TODO.md` for CE-018 through CE-024.
