# ADR Index

**Last updated:** 2026-08-15
**Total ADRs:** 18

| # | ADR | Status | Related Requirements |
|---|-----|--------|---------------------|
| [0001](../../../../adr/0001-reactive-task-stale-detection.md) | Reactive Task Stale Detection via Pending Node | ✅ Accepted | Unified Graph |
| [0002](../../../../adr/0002-match-handler-signature-design.md) | Match Handler Signature Design | ✅ Accepted | Utility Function Exports |
| [0003](../../../../adr/0003-equality-strategy-naming-convention.md) | Equality Strategy Naming Convention | ✅ Accepted | Minimal Surface |
| [0004](../../../../adr/0004-isequal-placement-and-deprecation.md) | isEqual Placement and Deprecation | ✅ Accepted | Minimal Surface |
| [0005](../../../../adr/0005-cycle-detection-omission-in-deep-equality.md) | Cycle Detection Omission in Deep Equality | 🗑️ Superseded by [0016](../../../../adr/0016-path-scoped-cycle-detection-in-deep-equality.md) | Bundle Size, Zero-Deps |
| [0006](../../../../adr/0006-scope-root-option-pattern.md) | Scope Root Option Pattern | ✅ Accepted | API Design |
| [0007](../../../../adr/0007-node-composition-via-field-mixins.md) | Node Composition via Field Mixins | ✅ Accepted | Unified Graph |
| [0008](../../../../adr/0008-doubly-linked-list-edge-structure.md) | Doubly-Linked List Edge Structure | ✅ Accepted | Performance |
| [0009](../../../../adr/0009-activeSink-protocol-for-automatic-dependency-tracking.md) | activeSink Protocol for Automatic Dependency Tracking | ✅ Accepted | Explicit Reactivity |
| [0010](../../../../adr/0010-flag-relink-mechanism-for-structural-reactivity.md) | FLAG_RELINK Mechanism for Structural Reactivity | ✅ Accepted | Unified Graph |
| [0011](../../../../adr/0011-cascading-cleanup-protocol-in-unlink.md) | Cascading Cleanup Protocol in unlink() | ✅ Accepted | Unified Graph |
| [0012](../../../../adr/0012-two-level-flagging-dirty-and-check.md) | Two-Level Flagging (DIRTY and CHECK) | ✅ Accepted | Performance |
| [0013](../../../../adr/0013-link-fast-path-optimizations.md) | link() Fast-Path Optimizations | ✅ Accepted | Performance |
| [0014](../../../../adr/0014-two-path-access-pattern-for-composite-signals.md) | Two-Path Access Pattern for Composite Signals | ✅ Accepted | Performance |
| [0015](../../../../adr/0015-composite-lookup-methods-track-structural-changes.md) | Composite Lookup Methods Track Structural Changes (Asymmetrically) | ✅ Accepted | Explicit Reactivity, Non-Nullable Types, Minimal Surface |
| [0016](../../../../adr/0016-path-scoped-cycle-detection-in-deep-equality.md) | Path-Scoped Cycle Detection in Deep Equality | ✅ Accepted | Performance |
| [0017](../../../../adr/0017-store-proxy-rejects-direct-writes.md) | Store Proxy Rejects Direct Writes | ✅ Accepted | Explicit Reactivity, Minimal Surface |
| [0018](../../../../adr/0018-shape-indexed-signal-types.md) | Shape-Indexed Signal Types | ✅ Accepted | Minimal Surface, Every Shape Is Derivable, Bundle Size |

---

## Status Legend

- ✅ Accepted: Decision has been implemented and is in use
- 🔄 Proposed: Decision is under discussion
- ❌ Rejected: Decision was considered but not adopted
- 🗑️ Superseded: Decision has been replaced by a newer ADR

## Quick Links

- [ADR Template](adr-template.md)
- [ARCHITECTURE.md](../../../../ARCHITECTURE.md)
- [REQUIREMENTS.md](../../../../REQUIREMENTS.md)
