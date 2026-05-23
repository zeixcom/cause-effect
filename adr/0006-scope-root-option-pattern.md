# ADR 0006: Scope Root Option Pattern

## Status

✅ Accepted

## Context

`createScope` creates a standalone ownership scope without a computation. We needed the ability to create root-level scopes that don't register with a parent scope. This is important for external-lifecycle owners such as web components.

The design question was: how should this option be exposed in the API?

## Decision

Use `ScopeOptions { root?: boolean }` as the second argument to `createScope`.

```typescript
// Create a child scope (default)
const childScope = createScope(fn);

// Create a root scope (no parent registration)
const rootScope = createScope(fn, { root: true });
```

### Implementation

This is a one-line implementation difference from a standalone function. Extending the existing `createScope` function avoids adding a new export to the public API.

## Alternatives Considered

- **Standalone `createRoot(fn)` export**: Rejected — only one line of implementation difference; extending existing function avoids API surface bloat
- **Positional boolean `createScope(fn, true)`**: Rejected — readable only with IDE hover support; an options object is self-documenting in code review

## Consequences

- ✅ Follows the `*Options` pattern used by every other creation function (`SignalOptions`, `ListOptions`, `SensorOptions`, etc.)
- ✅ Self-documenting in code review (clear intent with `root: true`)
- ✅ No additional exports added to public API
- ✅ Consistent with library's API design principles

## Related

- Architecture: [createScope root option](ARCHITECTURE.md#key-decisions)
- Requirements: [Utility Function Exports](REQUIREMENTS.md#utility-function-exports), [API Design](REQUIREMENTS.md#design-principles)
