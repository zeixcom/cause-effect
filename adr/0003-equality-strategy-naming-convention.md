# ADR 0003: Equality Strategy Naming Convention

## Status

✅ Accepted

## Context

The library needed a naming convention for equality comparison strategies used in signal options (`SignalOptions`, `ListOptions`, etc.). These are configuration values that determine how equality is checked when signal values change.

The key distinction: these are **named option values** (strategy sentinels), not utility functions that callers invoke directly. The naming should reflect this role.

## Decision

Use **SCREAMING_SNAKE_CASE** constants for all public equality presets:
- `DEFAULT_EQUALITY`
- `SKIP_EQUALITY`
- `DEEP_EQUALITY`

All three constants live in `graph.ts` alongside `SignalOptions`.

### Rejected: SHALLOW_EQUALITY

`SHALLOW_EQUALITY` was explicitly rejected because "one level deep" has no canonical definition across different data structures:
- Arrays: one level deep could mean checking array elements
- String arrays: unclear what "level" means
- Records: one level could mean checking property values

Users needing shallow equality are expected to write a one-liner specific to their type. The library provides `keysEqual` and `valuesEqual` precisely because the right shallow check is type-specific.

## Alternatives Considered

- **camelCase function names** (e.g., `skipEqual`, `deepEqual`): Rejected — these are named option values, not utility functions callers invoke directly. The constant convention better matches their role as strategy sentinels.
- **Adding `SHALLOW_EQUALITY`**: Rejected — as explained above, no canonical definition.
- **is-prefix** (e.g., `isDefaultEquality`): Rejected — `is`-prefix is reserved for type guards in this library.

## Consequences

- ✅ Clear semantic distinction from utility functions
- ✅ Consistent with TypeScript enum/const naming conventions
- ✅ Avoids namespace pollution with function-style names
- ✅ Matches the role of these values as strategy sentinels
- ⚠️ Users must implement their own shallow equality for specific types

## Related

- Architecture: [Equality strategy naming](ARCHITECTURE.md#key-decisions)
- Requirements: [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage)
