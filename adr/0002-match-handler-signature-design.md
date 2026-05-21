# ADR 0002: Match Handler Signature Design

## Status

✅ Accepted

## Context

The `match()` utility provides conditional dispatch on signal state with the precedence order: `nil` > `err` > `stale` > `ok`. We needed to design handler signatures that cleanly separate concerns between value display and state management, particularly for the `stale` state.

The `stale` handler needed to handle the transition when a Task is re-fetching but hasn't yet resolved. The key question was: what information should be passed to the handler, and how should cleanup be managed?

## Decision

### `stale` Handler Signature

Thunk `() => MaybePromise<MaybeCleanup>` — **no arguments**

The reset concern (e.g., hiding a spinner) belongs to the returned cleanup function, not to the handler parameters. Passing the value would mix stale-display and value-display concerns. The `ok` handler handles value display exclusively.

### `stale` Fallback Behavior

When the `stale` handler is absent, call `ok` with the stale values.

This preserves backward compatibility — existing callers continue to see stale values in `ok` during re-fetches.

### `stale` Scope

Both single-signal and tuple overloads support the `stale` handler.

This is symmetrical with `nil`: the `stale` handler fires if any Task in the signal set is pending. The same precedence rule applies in both contexts.

## Alternatives Considered

- **Receive stale value `(value: T)`**: Rejected — mixes stale-display and value-display concerns
- **Receive `pending: boolean`**: Rejected — redundant with handler purpose, adds unnecessary parameter
- **Call `nil` (hide content while re-loading)**: Rejected — breaks backward compatibility
- **Single-signal only**: Rejected — creates asymmetry with `nil` handler

## Consequences

- ✅ Clean separation of concerns: `ok` handles value display, `stale` handles pending state UI (spinners, etc.)
- ✅ Consistent API surface across all handler types
- ✅ Backward compatible with existing code
- ✅ Symmetrical behavior between single and tuple overloads

## Related

- Architecture: [stale handler signature](ARCHITECTURE.md#key-decisions), [stale fallback](ARCHITECTURE.md#key-decisions), [stale scope](ARCHITECTURE.md#key-decisions)
- Requirements: [Utility Function Exports](REQUIREMENTS.md#utility-function-exports)
