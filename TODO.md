# TODO

- [x] CE-005: Implement Neuron signal core
  **Skill:** cause-effect-dev
  **Context:** Implement the `createNeuron` factory function, including forward propagation, dependency tracking, and basic error handling. Follow the design outlined in [ADR 0015](adr/0015-neuron-signal.md). Support dynamic reconfiguration of input signals for future active inference.

- [x] CE-006: Implement backpropagation for Neuron signal
  **Skill:** cause-effect-dev
  **Context:** Add backpropagation support to the Neuron signal, including reverse edges for error propagation. Use an **explicit `train()` method** for clarity and **Mean Squared Error (MSE)** for error aggregation.

- [x] CE-007: Validate Neuron signal inputs and dependencies
  **Skill:** cause-effect-dev
  **Context:** Add validation for Neuron signal inputs (e.g., non-numeric values, circular dependencies) and ensure errors are handled gracefully.

- [x] CE-008: Test single-neuron scenarios
  **Skill:** cause-effect-dev
  **Context:** Write tests for single-neuron scenarios, such as logic gates (e.g., `AND`, `OR`). Verify forward and backward propagation.

- [x] CE-009: Prototype multi-layer networks with `createLayer`
  **Skill:** cause-effect-dev
  **Context:** Implement `createLayer` as a new signal type, optimized for dense connectivity and backpropagation. Validate feasibility by chaining Layers and Neurons.

- [x] CE-010: Draft public API documentation for Neuron and Layer signals
  **Skill:** tech-writer
  **Context:** Draft API documentation for the Neuron and Layer signals, including examples for forward/backward propagation and multi-layer networks. This will later be moved to a separate package.

- [x] CE-011: Review Neuron and Layer signal design and implementation — reviewed ✓
  **Skill:** architect
  **Review:** The implementation aligns with the ADRs and project goals but has gaps in dynamic reconfiguration, sparse connectivity, and backpropagation for multi-layer networks. Follow-up tasks created for these gaps.

- [x] CE-012: Implement reverse edges for backpropagation in multi-layer networks — re-scoped ✓
  **Skill:** architect
  **Re-scope:** Reverse edges are unnecessary. Per ADR 0017, multi-layer backpropagation is
  handled by recursive `train()` calls over the ML code's own forward-input references, which
  the ML layer already holds — the reactive graph never needs to know the topology. The task
  becomes CE-021: validate the recursive `train()` chain end-to-end (e.g. an XOR network)
  inside `correlation-prediction`.

- [ ] CE-013: Add dynamic reconfiguration support to Neuron and Layer signals
  **Skill:** cause-effect-dev
  **Context:** Add `setInputs` to `Neuron` and `setInputSignal` to `Layer` to update inputs at runtime. This will support active inference and dynamic workflows.

- [ ] CE-014: Add sparse connectivity support to Neuron and Layer signals
  **Skill:** cause-effect-dev
  **Context:** Add a `mask` option to `NeuronOptions` and `LayerOptions` to ignore certain inputs during forward/backward passes. This will enable attention mechanisms and sparse networks.

- [ ] CE-015: Add custom loss function support to Neuron signals
  **Skill:** cause-effect-dev
  **Context:** Add a `lossFunction` option to `NeuronOptions` to support custom loss functions (e.g., cross-entropy, Huber loss). Default to Mean Squared Error (MSE).

- [ ] CE-016: Add tests for Layer signals and edge cases in Neuron signals
  **Skill:** cause-effect-dev
  **Context:** Add `layer.test.ts` to cover basic functionality and edge cases (e.g., input shape validation, backpropagation). Extend `neuron.test.ts` to test dynamic reconfiguration, sparse connectivity, and multi-layer networks.

---

## Extraction to `correlation-prediction`

Decoupling strategy decided in [ADR 0017](adr/0017-public-api-decoupling-for-ml-primitives.md):
public-API-only reuse, weights-as-signals, no cause-effect API extension required for initial
extraction. Tasks are ordered — CE-019 depends on CE-018, CE-020/021 depend on CE-019,
CE-022 depends on CE-020, CE-023 depends on CE-022.

- [ ] CE-017: Set up `packages/correlation-prediction/` workspace package
  **Skill:** cause-effect-dev
  **Context:** Create the package (own `package.json` with `@zeix/cause-effect` as a
  dependency, `tsconfig`, build config) and configure the repo root as a workspace so
  `@zeix/cause-effect` resolves locally during development. Follow ADR 0017 §Decision. No
  code yet — just the scaffold. **Check:** does the workspace resolve the local cause-effect
  source without publishing?

- [ ] CE-018: Refactor `Neuron` to public-API-only (weights-as-signals)
  **Skill:** cause-effect-dev
  **Context:** Rewrite `createNeuron` so forward propagation is a `createMemo` over inputs
  and a `createState<number[]>` holding weights+bias, and `train()` updates that state inside
  `batch()`. Remove all `src/graph.ts` internal imports (`FLAG_*`, `makeSubscribe`,
  `propagate`, `refresh`, `flush`, `link`, `trimSources`, field-mixin types, node-shape types)
  — see ADR 0017 §Backpropagation. Keep `train()` as recursive backprop over `input.train()`
  for Neuron inputs. Move the file into `packages/correlation-prediction/`.
  **Check:** existing neuron tests pass unchanged; `getWeights` returns a copy (fixes the
  internal-alias issue); no non-exported cause-effect symbols imported.

- [ ] CE-019: Refactor `Layer` to public-API-only, drop divergent propagation
  **Skill:** cause-effect-dev
  **Context:** Replace `LayerNode` + hand-rolled `recomputeLayer()`/flag juggling with
  `createMemo` over the layer's neurons (following the same weights-as-signals pattern as
  CE-018). This removes the duplicated `LayerNode` type (also defined in `src/graph.ts`) and
  the divergent propagation path identified in review. Depends on CE-018.
  **Check:** no `recomputeLayer`, no manual `FLAG_*` manipulation; the shared propagation path
  is used; `get()` behaves identically.

- [ ] CE-020: Fix `Layer.train` / `backpropagate` API shape and apply gradients
  **Skill:** cause-effect-dev
  **Context:** Two review issues. (1) `train(target: number)` applies one scalar target across
  a vector output — meaningful only for size-1 layers; change the signature to
  `train(targets: number[])` (or document the stub clearly if deferred). (2)
  `backpropagate` accumulates into `node.gradients` but nothing applies those gradients to
  weights — dead state today; either wire gradient application into weight updates or document
  the method as a stub pending CE-012's successor. Depends on CE-019.
  **Check:** after `train`, weights visibly change and forward output reflects the update;
  gradient state is either applied or explicitly marked unimplemented in JSDoc.

- [ ] CE-021: Port ML tests into `correlation-prediction` and validate multi-layer backprop
  **Skill:** cause-effect-dev
  **Context:** Move `test/neuron.test.ts` into the package and add coverage for the
  recursive `train()` chain end-to-end — an XOR network is the canonical test (it requires a
  hidden layer, so it proves multi-layer backprop works without reverse edges per ADR 0017).
  Also verify weights-as-signals interacts correctly with `equals`/`SKIP_EQUALITY` across
  layers (ADR 0017 Open Question 1). Supersedes the original CE-012 premise.
  **Check:** XOR converges over training epochs; single-neuron logic-gate tests still pass.

- [ ] CE-022: Remove ML exports from cause-effect `index.ts` and `signal.ts`
  **Skill:** cause-effect-dev
  **Context:** Once CE-018/019 move the code, drop `createLayer`/`isLayer`/`Layer` and
  `createNeuron`/`isNeuron`/`Neuron` from `index.ts`, remove `TYPE_NEURON`/`TYPE_LAYER` from
  `SIGNAL_TYPES` and the `isLayer` re-export in `src/signal.ts`. Remove the now-unused
  `LayerNode` type and the ML-only exports newly added to `src/graph.ts` (`OptionsFields`,
  `SinkFields`, `SourceFields`, `FLAG_RUNNING`, etc.) if nothing else uses them — verify
  first. Depends on CE-019.
  **Check:** `bun test` passes; `index.ts` no longer references Neuron/Layer.

- [ ] CE-023: Restore bundle-size regression limits for `index.ts`
  **Skill:** cause-effect-dev
  **Context:** Revert `test/regression-bundle.test.ts` to the REQUIREMENTS.md targets (≤ 7,000 B
  gzipped; minified limit per REQUIREMENTS.md / current ceiling). With ML code out of
  `index.ts` (CE-022), the bundle should return under 7 kB gzipped. Block the stable
  `1.4.0` release on this passing. Depends on CE-022. **Check:** measured gzipped size < 7,000 B.

- [ ] CE-024: Update docs for the extraction
  **Skill:** tech-writer
  **Context:** README/GUIDE currently document Neuron/Layer (added on this branch) — remove
  those sections from cause-effect docs and point to `correlation-prediction` once it has its
  own README. Update `REQUIREMENTS.md` if its wording implies Neuron/Layer are part of
  cause-effect (they shouldn't — they were always out of the 9-type set). Update the
  ARCHITECTURE.md signal-types table if it references them. Depends on CE-022.
  **Check:** no cause-effect doc references Neuron/Layer as part of this library.

- [ ] CE-025: Add ADR 0017 to the ADR index
  **Skill:** adr-keeper
  **Context:** `.agents/skills/adr-keeper/references/adr-index.md` is stale (lists 6 ADRs;
  repo has 17) and does not include 0015/0016/0017. Rebuild the index from the current `adr/`
  directory so 0017 (and the earlier missing entries) appear. Low priority but keeps the
  index trustworthy as the decoupling work proceeds.
  **Check:** index row count matches the number of ADR files.
