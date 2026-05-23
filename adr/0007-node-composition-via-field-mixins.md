# ADR 0007: Node Composition via Field Mixins

## Status

✅ Accepted

## Context

The signal graph engine needs to represent multiple node types (State, Memo, Task, Effect, Store, List, Collection, Slot) with different capabilities. Each node type has a distinct role:

- **Sources** produce values (State, Sensor, Memo, Task, Store, List, Collection, Slot)
- **Sinks** consume values (Memo, Task, Effect)
- **Owners** manage cleanup (Effect, Scope)
- **Async** nodes handle promises (Task)

A traditional class inheritance approach would create a complex hierarchy with significant code duplication. We needed a design that:
- Allows flexible composition of capabilities
- Minimizes code duplication
- Maintains type safety
- Enables each node type to have exactly the fields it needs

## Decision

Use **field mixin composition** instead of class inheritance. Nodes are composed from reusable field groups:

| Mixin | Fields | Purpose |
|-------|--------|---------|
| `SourceFields<T>` | `value`, `sinks`, `sinksTail`, `stop?` | Holds a value and tracks dependents |
| `OptionsFields<T>` | `equals`, `guard?` | Equality check and type validation |
| `SinkFields` | `fn`, `flags`, `sources`, `sourcesTail` | Holds a computation and tracks dependencies |
| `OwnerFields` | `cleanup` | Manages disposal of child effects/scopes |
| `AsyncFields` | `controller`, `error` | AbortController for async cancellation |

Concrete node types compose these mixins:

| Node | Composed From | Role |
|------|---------------|------|
| `StateNode<T>` | SourceFields + OptionsFields | Source only |
| `MemoNode<T>` | SourceFields + OptionsFields + SinkFields + `error` | Source + Sink |
| `TaskNode<T>` | SourceFields + OptionsFields + SinkFields + AsyncFields | Source + Sink |
| `EffectNode` | SinkFields + OwnerFields | Sink only |
| `Scope` | OwnerFields | Owner only (not in graph) |

## Alternatives Considered

- **(a) Class inheritance hierarchy**: Rejected — would require a base class with all possible fields, leading to memory overhead for nodes that don't need all capabilities. Also creates complex type relationships.
- **(b) Interface merging with type guards**: Rejected — runtime type checking overhead and less type-safe than composition.
- **(c) Separate types with union discriminators**: Rejected — loses the ability to share common field access patterns.

## Consequences

- ✅ **Flexible composition**: Each node type has exactly the fields it needs, no more
- ✅ **No inheritance complexity**: Flat structure, easy to understand and maintain
- ✅ **Type-safe field access**: TypeScript correctly types each field based on composition
- ✅ **Memory efficient**: No unused fields on any node type
- ✅ **Extensible**: New node types can be added by composing existing mixins
- ⚠️ **Slightly verbose**: Type definitions must explicitly compose mixins

## Related

- Requirements: [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage), [Unified Graph](REQUIREMENTS.md#unified-graph)
- Architecture: [Node Field Mixins](ARCHITECTURE.md#node-field-mixins), [Concrete Node Types](ARCHITECTURE.md#concrete-node-types)
