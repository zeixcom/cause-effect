# TODO

- [ ] CE-005: Implement Neuron signal core
  **Skill:** cause-effect-dev
  **Context:** Implement the `createNeuron` factory function, including forward propagation, dependency tracking, and basic error handling. Follow the design outlined in [ADR 0015](adr/0015-neuron-signal.md). Support dynamic reconfiguration of input signals for future active inference.

- [ ] CE-006: Implement backpropagation for Neuron signal
  **Skill:** cause-effect-dev
  **Context:** Add backpropagation support to the Neuron signal, including reverse edges for error propagation. Use an **explicit `train()` method** for clarity and **Mean Squared Error (MSE)** for error aggregation.

- [ ] CE-007: Validate Neuron signal inputs and dependencies
  **Skill:** cause-effect-dev
  **Context:** Add validation for Neuron signal inputs (e.g., non-numeric values, circular dependencies) and ensure errors are handled gracefully.

- [ ] CE-008: Test single-neuron scenarios
  **Skill:** cause-effect-dev
  **Context:** Write tests for single-neuron scenarios, such as logic gates (e.g., `AND`, `OR`). Verify forward and backward propagation.

- [ ] CE-009: Prototype multi-layer networks with `createLayer`
  **Skill:** cause-effect-dev
  **Context:** Implement `createLayer` as a new signal type, optimized for dense connectivity and backpropagation. Validate feasibility by chaining Layers and Neurons.

- [ ] CE-010: Draft public API documentation for Neuron and Layer signals
  **Skill:** tech-writer
  **Context:** Draft API documentation for the Neuron and Layer signals, including examples for forward/backward propagation and multi-layer networks. This will later be moved to a separate package.

- [ ] CE-011: Review Neuron and Layer signal design and implementation
  **Skill:** architect
  **Context:** Review the Neuron and Layer signal design and implementation for alignment with project goals, API consistency, and potential edge cases. Update [ADR 0015](adr/0015-neuron-signal.md) and [ADR 0016](adr/0016-layer-signal.md) as needed.
