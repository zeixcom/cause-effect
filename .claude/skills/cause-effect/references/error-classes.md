<overview>
Error classes thrown by @zeix/cause-effect and the conditions that trigger them. All knowledge
is self-contained — no library source files required. Read this when writing error-handling
code, testing error conditions, or diagnosing an unexpected throw.
</overview>

<import>
All error classes are exported from the package root:

```typescript
import {
  NullishSignalValueError,
  InvalidSignalValueError,
  InvalidCallbackError,
  DuplicateKeyError,
  UnsetSignalValueError,
  ReadonlySignalError,
  RequiredOwnerError,
  CircularDependencyError,
} from '@zeix/cause-effect'
```
</import>

<error_table>
| Class | When thrown |
|---|---|
| `NullishSignalValueError` | Signal value is `null` or `undefined` |
| `InvalidSignalValueError` | Value fails the `guard` predicate |
| `InvalidCallbackError` | A required callback argument is not a function |
| `DuplicateKeyError` | List/Collection key collision on insert |
| `UnsetSignalValueError` | Reading a Sensor or Task before it has produced its first value |
| `ReadonlySignalError` | Attempting to write to a read-only signal |
| `RequiredOwnerError` | `createEffect` called outside an owner (scope or parent effect) |
| `CircularDependencyError` | A cycle is detected in the reactive graph |
</error_table>

<error_details>

<NullishSignalValueError>
Thrown when a signal's value is `null` or `undefined`. Because all signal generics use
`T extends {}`, nullish values are excluded by design — this error surfaces the constraint
at runtime if type safety is bypassed (e.g. via a type assertion or untyped interop).

**Prevention:** model absence explicitly with a sentinel value or wrapper type instead of `null`.
</NullishSignalValueError>

<InvalidSignalValueError>
Thrown when a value passed to `.set()` fails the `guard` predicate supplied in the signal's
options. This is the runtime enforcement of custom type narrowing at signal boundaries.

```typescript
import { createState, InvalidSignalValueError } from '@zeix/cause-effect'

const age = createState(0, {
  guard: (v): v is number => typeof v === 'number' && v >= 0,
})

age.set(-1) // throws InvalidSignalValueError
```
</InvalidSignalValueError>

<InvalidCallbackError>
Thrown when a required callback argument — such as the computation function passed to
`createMemo`, `createTask`, or `createEffect` — is not a function. Catches programming
errors like passing `undefined` or a non-function value by mistake.
</InvalidCallbackError>

<DuplicateKeyError>
Thrown when inserting an item into a List or Collection whose key already exists. Keys must
be unique within a given List or Collection.

**Fix:** use the collection's update or set method to change an existing entry rather than
inserting a new one with the same key.
</DuplicateKeyError>

<UnsetSignalValueError>
Thrown when `.get()` is called on a Sensor or Task before it has emitted its first value.
Unlike State, Sensor and Task start in an explicitly unset state with no initial value.

**Fix:** use `match` to handle the unset state (`nil` branch) instead of calling `.get()`
directly:

```typescript
import { match } from '@zeix/cause-effect'

createEffect(() => {
  match([sensor, task], {
    ok:  ([s, t]) => render(s, t),
    nil: () => showSpinner(),
  })
})
```
</UnsetSignalValueError>

<ReadonlySignalError>
Thrown when code attempts to call `.set()` on a read-only signal. Derived signals (Memo,
Task) are inherently read-only. Certain factory options may also produce read-only State
or Sensor instances.

**Fix:** only write to signals you own (State, Sensor via the internal setter callback).
</ReadonlySignalError>

<RequiredOwnerError>
Thrown when `createEffect` is called without an active owner in the current execution context.
Effects must be created inside a `createScope` callback or inside another `createEffect`
callback so their cleanup can be registered and managed.

```typescript
import { createEffect, createScope } from '@zeix/cause-effect'

// Wrong — no active owner
createEffect(() => console.log('runs'))  // throws RequiredOwnerError

// Correct — wrapped in a scope
const dispose = createScope(() => {
  createEffect(() => console.log('runs'))
})
```

**Exception:** use `unown` when the DOM manages the element's lifetime (e.g. inside
`connectedCallback`/`disconnectedCallback`) and you intentionally want to bypass owner
registration.
</RequiredOwnerError>

<CircularDependencyError>
Thrown when the graph engine detects a cycle during propagation — a signal that, directly
or transitively, depends on itself. Cycles make it impossible to determine a stable
evaluation order and are always a programming error.

**Common causes:**
- A Memo or Task that writes to a State it also reads
- Two Memos that read each other

**Fix:** restructure the data flow so that values move in one direction only.
</CircularDependencyError>

</error_details>

<testing_error_conditions>
Use `expect(() => ...).toThrow(ErrorClass)` to assert that a specific error is thrown.
Import the error class from the package root:

```typescript
import { createState, InvalidSignalValueError } from '@zeix/cause-effect'

test('rejects negative age', () => {
  const age = createState(0, {
    guard: (v): v is number => typeof v === 'number' && v >= 0,
  })
  expect(() => age.set(-1)).toThrow(InvalidSignalValueError)
})
```
</testing_error_conditions>