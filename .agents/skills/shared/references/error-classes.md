<overview>
Error classes thrown by @zeix/cause-effect and the conditions that trigger them.
This is the shared base reference for both consumer and developer contexts.
For library development, see cause-effect-dev/references/ for additional details
on testing error conditions from source.
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
  EffectConvergenceError,
  PromiseValueError,
} from '@zeix/cause-effect'
```

All error classes are defined in `src/errors.ts` for library development.
</import>

<error_table>
| Class | When thrown |
|---|---|
| `NullishSignalValueError` | Signal value is `null` or `undefined` |
| `InvalidSignalValueError` | Value fails the `guard` predicate |
| `InvalidCallbackError` | A required callback argument is not a function |
| `DuplicateKeyError` | List/DerivedList key collision on insert |
| `UnsetSignalValueError` | Reading an async derivation (Task) before it has produced its first value, with no `initial` |
| `ReadonlySignalError` | Attempting to write to a read-only signal |
| `RequiredOwnerError` | `createEffect` called outside an owner (scope or parent effect) |
| `CircularDependencyError` | A cycle is detected in the reactive graph |
| `EffectConvergenceError` | Effects keep re-triggering each other without settling (1000 flush passes) |
| `PromiseValueError` | A non-`async` Memo/Slot callback returns a `Promise` |
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
`deriveComputed`, `deriveCell`, or `createEffect` — is not a function. Catches programming
errors like passing `undefined` or a non-function value by mistake.
</InvalidCallbackError>

<DuplicateKeyError>
Thrown when inserting an item into a List or DerivedList whose key already exists. Keys must
be unique within a given List or DerivedList.

**Fix:** use the collection's update or set method to change an existing entry rather than
inserting a new one with the same key.
</DuplicateKeyError>

<UnsetSignalValueError>
Thrown when `.get()` is called on a Task before it has emitted its first value, and `initial`
was not passed. Unlike State, an async derivation (`deriveCell(asyncFn)`, internally Task)
starts in an explicitly unset state with no synthetic initial value by default. An
external-push cell (`deriveCell(seed, { watched })`, internally Sensor) does not have this
problem through the public API — the seed argument always doubles as the initial value.

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

**Exception:** use `createScope(fn, { root: true })` when the DOM manages the element's
lifetime (e.g. inside `connectedCallback`/`disconnectedCallback`) and you intentionally
want to bypass owner registration. `unown(() => createScope(fn))` achieves the same effect
but is the legacy pattern.
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

<EffectConvergenceError>
Thrown when queued effects did not settle within 1000 flush passes. An effect that writes
to a signal it also depends on is re-run until the graph converges — converging writes
(clamping, normalization, write-once initialization) are allowed and the effect always
observes the final value. This error fires only when the graph can never settle.

**Common causes:**
- An effect that unconditionally writes a signal it reads: `createEffect(() => count.set(count.get() + 1))`
- Two effects that write each other's dependencies (mutual ping-pong)

The error surfaces from the `set()`/`update()`/`batch()`/`createEffect()` call that
triggered the runaway. Other queued effects still run before it is thrown (it may arrive
inside an `AggregateError` when other effects also threw).

**Fix:** make the self-write conditional so it converges, or express the derived value as a
`deriveComputed` instead of writing state from an effect.
</EffectConvergenceError>

<PromiseValueError>
Thrown when a Memo or Slot callback returns a `Promise`. `deriveCell`/`deriveComputed`
decide Memo vs. Task by checking whether the callback is declared `async` — a check made
before the callback ever runs. A callback that forgets `async` but still returns a `Promise`
(e.g. `() => fetch(url).then(r => r.json())`) is created as a `Memo`. Without this check, the
`Promise` object itself would be silently cached as the memo's value.

```typescript
import { deriveCell, PromiseValueError } from '@zeix/cause-effect'

// Wrong — sync callback, routed to Memo, returns a Promise
const data = deriveCell(() => fetch('/api').then(r => r.json()))
data.get() // throws PromiseValueError

// Correct — async keyword routes to Task
const data2 = deriveCell(async () => {
  const r = await fetch('/api')
  return r.json()
})
```

**Fix:** add the `async` keyword to the callback so it routes to Task (internally
`createTask`, reached through `deriveCell`'s dispatch) instead.
</PromiseValueError>

</error_details>

<testing_error_conditions>
Use `expect(() => ...).toThrow(ErrorClass)` to assert that a specific error is thrown.
Import the error class from the package root for consumer-facing tests, or from
`src/errors.ts` for internal library tests:

```typescript
// Consumer-facing test
import { createState, InvalidSignalValueError } from '@zeix/cause-effect'

test('rejects negative age', () => {
  const age = createState(0, {
    guard: (v): v is number => typeof v === 'number' && v >= 0,
  })
  expect(() => age.set(-1)).toThrow(InvalidSignalValueError)
})

// Internal library test
import { InvalidSignalValueError, createState } from '@zeix/cause-effect'
import { InvalidSignalValueError as InternalError } from './src/errors.ts'

test('internal error handling', () => {
  // Can use either import
  expect(() => createState(0).set(null as any)).toThrow(InvalidSignalValueError)
})
```
</testing_error_conditions>
