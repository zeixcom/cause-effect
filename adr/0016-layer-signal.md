# ADR 0016: Layer Signal

**Status**: Draft
**Date**: 2026-06-13
**Author**: @estherbrunner

## Context
To simplify the creation of multi-neuron networks, we are introducing a **Layer** signal type. A Layer is a specialized `List` of Neuron signals, optimized for dense connectivity and backpropagation. Unlike a generic `List`, a Layer will:
- Subscribe to a single dense input signal (e.g., another Layer or a `Collection` of signals).
- Initialize Neurons with uniform options (e.g., activation function, initialization strategy).
- Propagate errors backward through the entire Layer during backpropagation.

## Decision
### Core Design
1. **Signal Type**: The Layer signal will be a new signal type, extending the behavior of `List<Neuron>` but optimized for ML workflows.
2. **Factory Function**: `createLayer(inputs: Signal<number[]> | Layer, options: LayerOptions)`
   - `inputs` can be:
     - A `Signal<number[]>` (dense input vector).
     - Another `Layer` (for chaining).
   - `options` will include:
     - Neuron-specific options (e.g., `activation`, `initialization`).
     - Layer-specific options (e.g., `size`, `lossFunction`).
3. **Forward Propagation**: Each Neuron in the Layer computes its output based on the input vector or upstream Layer.
4. **Backpropagation**: Errors are propagated backward through the Layer, adjusting weights and biases for all Neurons.

### Integration with Existing Signals
- **Dependency Tracking**: Layers will track dependencies like other signals, subscribing to a single dense input signal (e.g., `Signal<number[]>` or another `Layer`).
- **Dynamic Reconfiguration**: Layers will support dynamic reconfiguration of input signals (e.g., switching from one `Layer` to another).
- **Error Handling**: Input validation will ensure compatibility with the Layer’s expected input shape (e.g., matching input vector length).

### Comparison with `createList`
| Feature               | `createList<Neuron>`                          | `createLayer`                                  |
|-----------------------|-----------------------------------------------|-----------------------------------------------|
| **Input Subscription** | Subscribes to individual sparse signals.      | Subscribes to a single dense signal (e.g., `Signal<number[]>` or `Layer`). |
| **Initialization**     | Neurons initialized individually.             | Neurons initialized uniformly with shared options. |
| **Backpropagation**    | Errors propagated per Neuron.                 | Errors propagated through the entire Layer.   |
| **Use Case**          | General-purpose reactive lists.               | Optimized for dense ML workflows.             |

**Recommendation**: Use `createLayer` for ML workflows where Neurons share uniform options and dense connectivity. Use `createList` for general-purpose reactive lists of Neurons.

### Performance and Safety
- **Performance**: Layers will leverage dense matrix operations (e.g., WebAssembly) for forward/backward passes, improving scalability.
- **Error Handling**: Input shape mismatches (e.g., input vector length ≠ Layer size) will be validated and handled gracefully.

## Consequences
### Benefits
- **Simplified API**: Reduces boilerplate for creating multi-neuron networks.
- **Performance**: Optimized for dense connectivity and backpropagation.
- **Integration**: Seamlessly integrates with Neurons and other signals.

### Drawbacks
- **Complexity**: Introduces a new signal type with specialized behavior.
- **API Surface**: Expands the public API, requiring documentation and examples.

## Alternatives Considered
1. **Overload `createNeuron`**: Instead of a new signal type, overload `createNeuron` to accept a `Signal<number[]>` or `Layer`. However, this would complicate the `Neuron` API and violate the single-responsibility principle.
2. **Extend `createList`**: Add Layer-specific behavior to `createList`. However, this would bloat the `List` API and reduce clarity for non-ML use cases.

## Tasks
See `TODO.md` for implementation tasks.

## Open Questions
1. Should Layers support dynamic resizing (e.g., adding/removing Neurons at runtime)?
2. How should Layers handle sparse connectivity (e.g., masking certain inputs)?
3. Should Layers support custom weight initialization (e.g., pre-trained weights)?