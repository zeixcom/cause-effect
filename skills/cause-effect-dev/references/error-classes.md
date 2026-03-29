<overview>
Error classes thrown by @zeix/cause-effect and the conditions that trigger them. Read this when writing error-handling code, testing error conditions, or diagnosing an unexpected throw.
</overview>

<error_table>
| Class | When thrown |
|---|---|
| `NullishSignalValueError` | Signal value is `null` or `undefined` |
| `InvalidSignalValueError` | Value fails the `guard` predicate |
| `InvalidCallbackError` | A required callback argument is not a function |
| `DuplicateKeyError` | List/Collection key collision on insert |
| `UnsetSignalValueError` | Reading a Sensor or Task before it has produced its first value |
| `ReadonlySignalError` | Attempting to write to a read-only signal |
| `RequiredOwnerError` | `createEffect` called outside an owner (effect or scope) |
| `CircularDependencyError` | A cycle is detected in the reactive graph |

All error classes are defined in `src/errors.ts`.
</error_table>

<error_details>

<NullishSignalValueError>
Thrown when a signal's value is `null` or `undefined`. Because all signal generics use `T extends {}`, nullish values are excluded by type — this error surfaces the constraint at runtime for cases where type safety is bypassed (e.g. untyped interop, type assertions).
</NullishSignalValueError>

<InvalidSignalValueError>
Thrown when a value passed to `set()` fails the `guard` predicate supplied in the signal's options. This is the runtime enforcement of custom type narrowing at signal boundaries.

```typescript
const age = createState(0, {
  guard: (v): v is number => typeof v === 'number' && v >= 0,
})
age.set(-1) // throws InvalidSignalValueError
```
</InvalidSignalValueError>

<InvalidCallbackError>
Thrown when a required callback argument (e.g. the computation function passed to `createMemo`, `createTask`, or `createEffect`) is not a function. Catches programming errors like passing `undefined` or a non-function value.
</InvalidCallbackError>

<DuplicateKeyError>
Thrown when inserting an item into a List or Collection whose key already exists. Keys must be unique within a given List or Collection. Use `update()` or `set()` to change an existing entry instead.
</DuplicateKeyError>

<UnsetSignalValueError>
Thrown when `.get()` is called on a Sensor or Task before it has emitted its first value. Unlike State, Sensor and Task have no initial value — they start in an explicitly unset state.

Handle this with `match`, which provides a `nil` branch for the unset case:

```typescript
match([sensor, task], {
  ok: ([s, t]) => render(s, t),
  nil: () => showSpinner(),
})
```
</UnsetSignalValueError>

<ReadonlySignalError>
Thrown when code attempts to call `.set()` on a signal that was created as or converted to a read-only signal. Derived signals (Memo, Task) are inherently read-only; certain factory options can also produce read-only State or Sensor instances.
</ReadonlySignalError>

<RequiredOwnerError>
Thrown when `createEffect` is called without an active owner in the current execution context. Effects must be created inside a `createScope` callback or inside another `createEffect` callback so that their cleanup can be registered.

```typescript
// Wrong — no active owner
createEffect(() => console.log('runs'))  // throws RequiredOwnerError

// Correct — wrapped in a scope
const dispose = createScope(() => {
  createEffect(() => console.log('runs'))
})
```
</RequiredOwnerError>

<CircularDependencyError>
Thrown when the graph engine detects a cycle during propagation — a signal that, directly or transitively, depends on itself. Cycles make it impossible to determine a stable evaluation order and are always a programming error.

Common cause: a Memo or Task that writes to a State it also reads, or two Memos that read each other.
</CircularDependencyError>

</error_details>

<testing_error_conditions>
Use `expect(() => ...).toThrow(ErrorClass)` to assert that a specific error is thrown:

```typescript
import { InvalidSignalValueError, createState } from '@zeix/cause-effect'

test('rejects negative age', () => {
  const age = createState(0, { guard: (v): v is number => typeof v === 'number' && v >= 0 })
  expect(() => age.set(-1)).toThrow(InvalidSignalValueError)
})
```

Import error classes directly from `src/errors.ts` in internal tests, or from the package root in consumer-facing tests.
</testing_error_conditions>