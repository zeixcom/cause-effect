# ADR 0015: Neuron Signal

**Status**: Draft
**Date**: 2026-06-13
**Author**: @estherbrunner

## Context
We are introducing an experimental **Neuron** signal type to the `@zeix/cause-effect` library. This signal is intended for lightweight ML experimentation, particularly for educational purposes, and will be integrated into the deterministic signal graph. The Neuron signal will initially support forward and backpropagation with a default transformer architecture, with plans to extend functionality in the future.

## Decision
### Core Design
1. **Signal Type**: The Neuron signal will be a new signal type, loosely replicating the behavior of a `Memo` signal but specialized for ML operations.
2. **Factory Function**: `createNeuron(inputs: Signal<number>[], options: NeuronOptions)`
   - `inputs` can be any `Signal<number>`, not limited to other Neurons.
   - `options` will include:
     - Activation functions (`sigmoid`, `relu`, `tanh`, `linear`).
     - Initialization strategies (`random`, `zeros`, `xavier`).
     - Learning rate and other hyperparameters.
3. **Forward Propagation**: The Neuron will compute a weighted sum of its inputs, apply an activation function, and return the result via `.get()`.
4. **Backpropagation**: Errors will be propagated backward to adjust weights and biases. The exact mechanism is still under exploration but will likely involve "reverse edges" for error propagation.

### Integration with Existing Signals
- **Dependency Tracking**: Neurons will track dependencies like other signals, with **dynamic reconfiguration of input edges** as a future requirement.
- **Batching**: Since Neurons are pure functions without side effects, they will not require the `batch()` mechanism.
- **Error Handling**: Input edges will be validated, and errors will be caught and handled similarly to other signals (e.g., `Memo`, `Task`).

### Performance and Safety
- **Performance**: Initially, we assume a low number of input signals (e.g., up to 16). Performance optimizations (e.g., WebAssembly) will be explored later.
- **Error Handling**: Invalid inputs (e.g., non-numeric values) and circular dependencies will be validated and handled gracefully.
- **Cancellation**: All operations will be synchronous for now, with async support deferred to future work.

### Testing and Validation
- **Test Cases**: Focus on single-neuron scenarios, such as logic gates (e.g., `AND`, `OR`). Multi-layer networks will be explored by chaining Neurons.
- **Benchmarks**: Deferred until the design stabilizes and performance optimizations are needed.

## Consequences
### Benefits
- **Educational Value**: Provides a simple, reactive way to experiment with ML concepts.
- **Extensibility**: The design allows for future enhancements, such as custom loss functions, optimizers, and dynamic input reconfiguration.
- **Integration**: Seamlessly integrates with the existing signal graph, enabling reactive ML workflows.

### Drawbacks
- **Complexity**: Introduces additional complexity to the signal graph, particularly with backpropagation and reverse edges.
- **Performance**: Initial implementation may not scale well for large networks, but this will be addressed in future iterations.
- **API Surface**: Expands the public API, which may require careful documentation and examples.

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
2. Should we introduce a `createLayer()` utility early to simplify multi-neuron networks?