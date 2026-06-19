# ADR Index

**Last updated:** 2026-06-19
**Total ADRs:** 17

| # | ADR | Status | Related Requirements |
|---|-----|--------|---------------------|
| [0001](../../../../adr/0001-reactive-task-stale-detection.md) | Reactive Task Stale Detection via Pending Node | ✅ Accepted | Unified Graph |
| [0002](../../../../adr/0002-match-handler-signature-design.md) | Match Handler Signature Design | ✅ Accepted | Utility Function Exports |
| [0003](../../../../adr/0003-equality-strategy-naming-convention.md) | Equality Strategy Naming Convention | ✅ Accepted | Minimal Surface |
| [0004](../../../../adr/0004-isequal-placement-and-deprecation.md) | isEqual Placement and Deprecation | ✅ Accepted | Minimal Surface |
| [0005](../../../../adr/0005-cycle-detection-omission-in-deep-equality.md) | Cycle Detection Omission in Deep Equality | ✅ Accepted | Bundle Size, Zero-Deps |
| [0006](../../../../adr/0006-scope-root-option-pattern.md) | Scope Root Option Pattern | ✅ Accepted | API Design |
| [0007](../../../../adr/0007-node-composition-via-field-mixins.md) | Node Composition via Field Mixins | ✅ Accepted | Minimal Surface, Unified Graph |
| [0008](../../../../adr/0008-doubly-linked-list-edge-structure.md) | Doubly-Linked List Edge Structure | ✅ Accepted | Bundle Size, Minimal Surface |
| [0009](../../../../adr/0009-activeSink-protocol-for-automatic-dependency-tracking.md) | activeSink Protocol for Automatic Dependency Tracking | ✅ Accepted | Explicit Reactivity |
| [0010](../../../../adr/0010-flag-relink-mechanism-for-structural-reactivity.md) | FLAG_RELINK Mechanism for Structural Reactivity | ✅ Accepted | Unified Graph, Minimal Surface |
| [0011](../../../../adr/0011-cascading-cleanup-protocol-in-unlink.md) | Cascading Cleanup Protocol in unlink() | ✅ Accepted | Unified Graph, Minimal Surface |
| [0012](../../../../adr/0012-two-level-flagging-dirty-and-check.md) | Two-Level Flagging (DIRTY and CHECK) | ✅ Accepted | Minimal Work |
| [0013](../../../../adr/0013-link-fast-path-optimizations.md) | link() Fast-Path Optimizations | ✅ Accepted | Performance |
| [0014](../../../../adr/0014-two-path-access-pattern-for-composite-signals.md) | Two-Path Access Pattern for Composite Signals | ✅ Accepted | Performance, Unified Graph |
| [0015](../../../../adr/0015-neuron-signal.md) | Neuron Signal | 🔄 Draft | — (experimental, out of 9-type scope) |
| [0016](../../../../adr/0016-layer-signal.md) | Layer Signal | 🔄 Draft | — (experimental, out of 9-type scope) |
| [0017](../../../../adr/0017-public-api-decoupling-for-ml-primitives.md) | Public-API Decoupling for ML Primitives | 🔄 Draft | Minimal Surface, Bundle Size |

---

## Status Legend

- ✅ Accepted: Decision has been implemented and is in use
- 🔄 Draft: Decision is proposed but not yet finalized; details may change
- ❌ Rejected: Decision was considered but not adopted
- 🗑️ Superseded: Decision has been replaced by a newer ADR

## Notes

- **0001–0014**: Core graph-engine and API decisions, all accepted and in use. Documented in [ARCHITECTURE.md](../../../../ARCHITECTURE.md).
- **0015–0017**: Experimental ML primitives (`Neuron`, `Layer`) and their extraction into the `correlation-prediction` package. These are outside cause-effect's 9-signal-type scope (see [REQUIREMENTS.md](../../../../REQUIREMENTS.md) Non-Goals) and remain Draft pending the extraction's first release.
- [ADR Template](adr-template.md)
