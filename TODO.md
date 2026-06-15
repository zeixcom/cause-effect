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

- [ ] CE-012: Implement reverse edges for backpropagation in multi-layer networks
  **Skill:** cause-effect-dev
  **Context:** Extend the graph to support reverse edges for backpropagation. Update `neuron.ts` and `layer.ts` to propagate errors backward via reverse edges. This will enable multi-layer networks (e.g., XOR).

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
