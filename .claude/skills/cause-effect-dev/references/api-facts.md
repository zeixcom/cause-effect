<overview>
Key API constraints, defaults, and callback patterns for @zeix/cause-effect. Read this when writing or reviewing any code that uses the public API.
</overview>

<type_constraint>
**`T extends {}`** — all signal generics exclude `null` and `undefined` at the type level. This is intentional. Use wrapper types or sentinel values to represent absence:

```typescript
// Wrong — TypeScript will reject this
const count = createState<number | null>(null)

// Correct — use a sentinel or wrapper
const count = createState<number>(0)
const value = createState<{ data: string } | never>({ data: '' })
```
</type_constraint>

<core_functions>
**`createScope(fn, options?)`**
- Returns a single `Cleanup` function
- `fn` receives no arguments and may return an optional cleanup that runs when the scope is disposed
- Used to group effects and control their shared lifetime
- `options.root = true` (`ScopeOptions`) — suppresses parent-owner registration; the returned `dispose` is the sole teardown mechanism. Use for scopes whose lifecycle is controlled externally (e.g. a web component's `disconnectedCallback`)

**`createEffect(fn)`**
- Returns a `Cleanup` function
- **Must be called inside an owner** (another effect or a scope) — throws `RequiredOwnerError` otherwise
- `fn` runs immediately and re-runs whenever its tracked dependencies change
- Registers cleanup with the current `activeOwner`

**`batch(fn)`**
- Defers the reactive flush until `fn` returns
- Multiple state writes inside `fn` coalesce into a single propagation pass
- Use when updating several signals that feed the same downstream computation

**`untrack(fn)`**
- Runs `fn` without recording dependency edges (nulls `activeSink`)
- Reads inside `fn` do not subscribe the current computation to those signals
- Use to read a signal's current value without creating a reactive dependency

**`unown(fn)`**
- Runs `fn` without registering cleanups in the current owner (nulls `activeOwner`)
- For creating a scope with an external lifecycle authority, prefer `createScope(fn, { root: true })` — it is equivalent to `unown(() => createScope(fn))` but more readable
- Use `unown` directly when detaching non-scope computations from the current owner
</core_functions>

<options>
**`equals`**
- Available on `createState`, `createSensor`, `createMemo`, `createTask`
- Default: strict equality (`===`)
- When a new value is `equals` to the previous, propagation stops — downstream nodes are not re-run
- **`SKIP_EQUALITY`** — special sentinel for `equals`; forces propagation on every update regardless of value. Use with mutable-reference sensors where the reference never changes but the contents do

**`guard`**
- Available on `createState`, `createSensor`
- A predicate `(value: unknown) => value is T`
- Throws `InvalidSignalValueError` if a set value fails the guard
- Use to enforce runtime type safety at signal boundaries
</options>

<callback_patterns>
**Memo and Task callbacks receive `prev`**
- Signature: `(prev: T) => T` for Memo; `(prev: T, signal: AbortSignal) => Promise<T>` for Task
- `prev` is the previous value on every run after the first
- Enables reducer patterns without external state:

```typescript
const count = createState(0)
const doubled = createMemo((prev) => {
  const next = count.get() * 2
  return next === prev ? prev : next  // referential stability
})
```

**`Slot` is a property descriptor**
- Has `get`, `set`, `configurable`, `enumerable` fields — pass directly to `Object.defineProperty()`
- Delegates reads and writes to a swappable backing signal; use `replace(nextSignal)` to swap
- Is a forwarding layer, not a value owner — has no `update()` method

```typescript
const nameState = createState('Alice')
const slot = createSlot(nameState)
Object.defineProperty(element, 'name', slot)
```

**`Task` carries an `AbortSignal`**
- The second argument to the Task callback is an `AbortSignal`
- The signal is aborted when the Task's dependencies change before the previous async operation completes
- Always pass it to any `fetch` or cancellable async operation inside a Task
</callback_patterns>

<lifecycle_summary>
| Function | Must be in owner? | Returns | Re-runs on dependency change? |
|---|---|---|---|
| `createScope(fn, options?)` | No | `Cleanup` | No (fn runs once) |
| `createEffect(fn)` | **Yes** | `Cleanup` | Yes |
| `createMemo(fn)` | No | `Memo<T>` | Lazily (on read) |
| `createTask(fn)` | No | `Task<T>` | Yes (async) |
</lifecycle_summary>