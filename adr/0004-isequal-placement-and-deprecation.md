# ADR 0004: isEqual Placement and Deprecation

## Status

✅ Accepted

## Context

The `isEqual` deep equality function is used internally for `DEEP_EQUALITY` strategy and was previously exported as part of the public API. During refactoring, a circular import issue arose:

- `isEqual` needs access to `CircularDependencyError` (for potential future use)
- `CircularDependencyError` lives in `errors.ts`
- `errors.ts` already imports from `util.ts`
- Therefore, `util.ts` cannot import back from `errors.ts`

Additionally, the public export of `isEqual` needed to be addressed as part of API cleanup.

## Decision

### Placement

Implementation of `isEqual` in `graph.ts`; public preset exported as `DEEP_EQUALITY` from `graph.ts`.

This resolves the circular import issue because:
- `graph.ts` already imports `CircularDependencyError` from `errors.ts`
- `graph.ts` is the correct home for all equality constants and related functionality
- No circular dependency is introduced

### Public Export

The deprecated `isEqual` function is re-exported from `index.ts` as a deprecated alias pointing to the implementation in `graph.ts`.

This maintains backward compatibility while signaling that the function should not be used going forward. No known downstream consumers exist, but since it was part of the public API, a deprecation cycle is the correct path to removal rather than immediate deletion.

## Alternatives Considered

- **Place in `util.ts`**: Blocked — circular import with `errors.ts`
- **Keep in `list.ts`**: Rejected — wrong module ownership; `graph.ts` is the natural home
- **Remove immediately**: Rejected — breaks deprecation policy; was part of public API

## Consequences

- ✅ Resolves circular import constraint
- ✅ Maintains API stability through deprecation cycle
- ✅ Correct module ownership (equality-related code in `graph.ts`)
- ⚠️ Deprecated function remains in public API surface temporarily

## Related

- Architecture: [isEqual placement](ARCHITECTURE.md#key-decisions), [isEqual public export](ARCHITECTURE.md#key-decisions)
- Requirements: [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
