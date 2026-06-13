# ADR 0015: Neuron Signal

**Status**: Draft
**Date**: 2026-06-13
**Author**: @estherbrunner

## Context
We are introducing an experimental **Neuron** signal type to the `@zeix/cause-effect` library. This signal is intended for lightweight ML experimentation, particularly for educational purposes, and will be integrated into the deterministic signal graph. The Neuron signal will initially support forward and backpropagation with a default transformer architecture, with plans to extend functionality in the future.

## Decision
### Core Design
1. **Signal Type**: The Neuron signal is a new signal type, loosely replicating the behavior of a `Memo` signal but specialized for ML operations.
2. **Factory Function**: `createNeuron(inputs: Signal<number>[], options: NeuronOptions)`
   - `inputs` can be any `Signal<number>` (e.g., `State<number>`, `Memo<number>`, or other `Neuron` signals).
   - `options` includes:
     - Activation functions (`sigmoid`, `relu`, `tanh`, `linear`, or custom function).
     - Initialization strategies (`random`, `zeros`, `xavier`).
     - Learning rate (default: `0.1`).
     - Loss function (default: Mean Squared Error).
3. **Forward Propagation**: The Neuron computes a weighted sum of its inputs, applies an activation function, and returns the result via `.get()`.
4. **Backpropagation**: Errors are propagated backward to adjust weights and biases via an explicit `train(target)` method. Reverse edges are **not yet implemented** for multi-layer networks.

### Integration with Existing Signals
- **Dependency Tracking**: Neurons track dependencies like other signals, but **dynamic reconfiguration of input edges is not yet supported**.
- **Batching**: Neurons are pure functions without side effects and do not require the `batch()` mechanism.
- **Error Handling**: Input edges are validated, and errors (e.g., non-numeric values, circular dependencies) are handled gracefully.

### Performance and Safety
- **Performance**: Optimized for a low number of input signals (e.g., up to 16). Performance optimizations (e.g., WebAssembly) are deferred to future work.
- **Error Handling**: Invalid inputs (e.g., non-numeric values, circular dependencies) are validated and handled gracefully.
- **Cancellation**: All operations are synchronous. Async support is deferred to future work.

### Testing and Validation
- **Test Cases**: Focus on single-neuron scenarios, such as logic gates (e.g., `AND`, `OR`). Multi-layer networks will be explored by chaining Neurons.
- **Benchmarks**: Deferred until the design stabilizes and performance optimizations are needed.

## Consequences
### Benefits
- **Educational Value**: Provides a simple, reactive way to experiment with ML concepts (e.g., logic gates, single-neuron training).
- **Extensibility**: The design supports future enhancements, such as custom loss functions, optimizers, and dynamic input reconfiguration.
- **Integration**: Seamlessly integrates with the existing signal graph (e.g., `State`, `Memo`, `Effect`).

### Drawbacks
- **Complexity**: Introduces additional complexity to the signal graph, particularly with backpropagation and reverse edges.
- **Performance**: Initial implementation is not optimized for large networks. Performance optimizations (e.g., WebAssembly) are deferred to future work.
- **API Surface**: Expands the public API, requiring careful documentation and examples.

### Implementation Status
- **Forward Propagation**: Implemented and tested.
- **Backpropagation**: Implemented for single-neuron scenarios. Reverse edges for multi-layer networks are **not yet implemented**.
- **Dynamic Reconfiguration**: Not yet supported (e.g., switching inputs at runtime).
- **Sparse Connectivity**: Not yet supported (e.g., masking inputs).
- **Custom Loss Functions**: Hardcoded to Mean Squared Error (MSE).

### Feedback Mechanism: Design Decisions
The choice of backpropagation strategy has significant implications:

1. **Explicit `train()` Method**
   - **Pros**: Clear separation of forward and backward passes, easier to debug, and more control over when training occurs.
   - **Cons**: Requires manual triggering of training, which may not align with the reactive paradigm.

2. **Automatic Backpropagation During `.get()`**
   - **Pros**: Aligns with the reactive paradigm, as training happens automatically when the Neuron is accessed.
   - **Cons**: May introduce unexpected side effects (e.g., weight updates) during read operations, complicating debugging.

3. **Hybrid Approach**
   - **Pros**: Combines the best of both worlds—automatic training during `.get()` but with an option to disable it (e.g., `options.autoTrain = false`).
   - **Cons**: Adds complexity to the API and implementation.

**Decision**: Start with the **explicit `train()` method** for simplicity and clarity. Revisit the hybrid approach later if needed.

### Error Aggregation: Tradeoffs
The choice of error aggregation function impacts training dynamics and convergence:

| Function               | Pros                                                                 | Cons                                                                 | Use Case                          |
|------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|-----------------------------------|
| **Mean Squared Error** | - Smooth gradient (differentiable everywhere).
- Penalizes large errors quadratically. | - Sensitive to outliers.
- Slower convergence for small errors.     | Regression tasks.                |
| **Cross-Entropy**      | - Faster convergence for classification.
- Directly optimizes log-likelihood.        | - Only for classification.
- Requires softmax output.                | Binary/multi-class classification. |
| **Huber Loss**         | - Robust to outliers.
- Smooth for small errors.                   | - More complex to implement.                                         | Robust regression.                |
| **L1 Loss**            | - Robust to outliers.
- Sparse gradients.                          | - Non-differentiable at zero.
- Slower convergence.                  | Sparse regression.                |

**Decision**: Use **Mean Squared Error (MSE)** for error aggregation. This provides a simple and broadly applicable loss function for initial implementation.

## Alternatives Considered
1. **Extending `Memo`**: Instead of creating a new signal type, we could extend `Memo` to support ML operations. However, this would complicate the `Memo` API and violate the single-responsibility principle.
2. **Separate ML Library**: Introduce Neurons in a separate library (e.g., `@zeix/cause-effect-ml`). While this keeps the core library clean, it would delay integration and require duplication of signal graph logic.

## Tasks
See `TODO.md` for implementation tasks.

## Open Questions
1. How should dynamic reconfiguration of input signals be implemented (e.g., for active inference)?
2. Should Neurons support sparse connectivity (e.g., masking certain inputs)?
3. How should reverse edges be implemented for backpropagation in multi-layer networks?
4. Should Neurons support custom loss functions (e.g., cross-entropy, Huber loss)?
5. Should we introduce a `createLayer()` utility early to simplify multi-neuron networks?