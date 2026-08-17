<overview>
Key API constraints, defaults, and callback patterns for @zeix/cause-effect.
This is the shared base reference for both consumer and developer contexts.
For consumer projects, this is self-contained. For library development, see
cause-effect-dev/references/ for additional internal details.
</overview>

<type_constraint>
**`T extends {}`** — all signal generics exclude `null` and `undefined` at the type level.
This is intentional: signals always have a value; absence must be modelled explicitly.

```typescript
// Wrong — TypeScript will reject this
const count = createState<number | null>(null)

// Correct — use a sentinel or a wrapper type
const count = createState<number>(0)
const selected = createState<{ id: string } | { id: never }>({ id: '' })
```
</type_constraint>

<core_functions>
**`createScope(fn, options?)`**
- Returns a single `Cleanup` function
- `fn` receives no arguments and may return an optional cleanup that runs when the scope is disposed
- Used to group effects and control their shared lifetime
- `options.root = true` (`ScopeOptions`) — suppresses parent-owner registration; the returned `dispose` is the sole teardown mechanism. Use for scopes whose lifecycle is controlled externally (e.g. a web component's `disconnectedCallback`)

```typescript
const dispose = createScope(() => {
  createEffect(() => console.log(count.get()))
  // all effects inside are disposed when dispose() is called
})
dispose() // cleans up everything inside
```

**`createEffect(fn)`**
- Returns a `Cleanup` function
- **Must be called inside an owner** (another effect or a scope) — throws `RequiredOwnerError` otherwise
- `fn` runs immediately and re-runs whenever its tracked dependencies change
- Registers cleanup with the current `activeOwner`

**`batch(fn)`**
- Defers the reactive flush until `fn` returns
- Multiple state writes inside `fn` coalesce into a single propagation pass
- Use when updating several signals that feed the same downstream computation

```typescript
batch(() => {
  x.set(1)
  y.set(2)
  z.set(3)
  // only one propagation pass runs after all three writes
})
```

**`untrack(fn)`**
- Runs `fn` without recording dependency edges (nulls `activeSink`)
- Reads inside `fn` do not subscribe the current computation to those signals
- Use to read a signal's current value without creating a reactive dependency

```typescript
createEffect(() => {
  const a = reactive.get()           // tracked — effect re-runs when reactive changes
  const b = untrack(() => other.get()) // untracked — no dependency on other
  render(a, b)
})
```

**`unown(fn)`**
- Runs `fn` without registering cleanups in the current owner (nulls `activeOwner`)
- For creating a scope with an external lifecycle authority, prefer `createScope(fn, { root: true })` — it is equivalent to `unown(() => createScope(fn))` but more readable
- Use `unown` directly when detaching non-scope computations from the current owner
</core_functions>

<options>
**`equals`**
- Available on every single-value factory (`createCell`, `createState`, `deriveCell`, `deriveComputed`); lists and stores take `itemEquals`
- Default: strict equality (`===`)
- When a new value is considered equal to the previous one, propagation stops —
  downstream nodes are not re-run
- **`SKIP_EQUALITY`** — special sentinel value for `equals`; forces propagation on every
  update regardless of value. Use with mutable-reference external-push cells where the
  reference never changes but the contents do:

```typescript
import { deriveCell, SKIP_EQUALITY } from '@zeix/cause-effect'

const box = document.getElementById('box')!
const element = deriveCell(box, { // same reference every time, so skip reference equality
  watched: emit => {
    const obs = new MutationObserver(() => emit(box))
    obs.observe(box, { attributes: true })
    return () => obs.disconnect()
  },
  equals: SKIP_EQUALITY,
})
```

**`guard`**
- Available on `createState` and `deriveCell`'s external-push form (internally `createSensor`)
- A predicate `(value: unknown) => value is T`
- Throws `InvalidSignalValueError` if a set value fails the predicate
- Use to enforce runtime type safety at signal boundaries

```typescript
const age = createState(0, {
  guard: (v): v is number => typeof v === 'number' && v >= 0,
})
```
</options>

<callback_patterns>
**Derivation callbacks receive `prev`**
- Signature: `(prev: T | undefined) => T` for a sync derivation; `(prev: T | undefined, abortSignal: AbortSignal) => Promise<T>` for an async one
- `prev` is the previous computed value, enabling reducer-style patterns without external state:

```typescript
const runningTotal = deriveComputed((prev: number | undefined) =>
  (prev ?? 0) + newValue.get(), { initial: 0 })
```

**Async derivations carry an `AbortSignal`**
- The second argument to an async callback is an `AbortSignal`, always named `abortSignal`
- The signal is aborted when dependencies change before the previous async run completes
- Always forward it to any `fetch` or cancellable async operation:

```typescript
const results = deriveCell(async (_prev, abortSignal) => {
  const res = await fetch(`/api/search?q=${query.get()}`, { signal: abortSignal })
  return res.json()
})
```

**`watched` has two forms, keyed on the input kind**
- A seed input takes `(emit) => Cleanup` — external push; the `emit` argument is shape-appropriate (`emit(value)`, `emit(changes)`, `emit(patch)`)
- A function input takes `(invalidate) => Cleanup` — invalidation only
- `watched` is always an option, never a callback position
- Passing the wrong form compiles but degrades silently — match the form to the input kind

**`Slot` is a property descriptor**
- Has `get`, `set`, `configurable`, `enumerable` fields — pass directly to `Object.defineProperty()`
- Delegates reads and writes to a swappable backing signal; use `replace(nextSignal)` to swap
- Is a forwarding layer, not a value owner — has no `update()` method

```typescript
const nameState = createCell('Alice')
const nameSlot = createSlot(nameState)
Object.defineProperty(element, 'name', nameSlot)
```
</callback_patterns>

<match_helper>
`match` reads one or more signals and routes to a handler based on signal state.

**Routing precedence:** `nil` > `err` > `stale` > `ok`

**Handlers:**
- `nil` — at least one signal has no value yet (loading)
- `err` — at least one signal has an error
- `stale` — all signals have a value but at least one async derivation is re-computing (`isPending() === true`). Omitting `stale` falls back to `ok`, showing retained data unchanged. Cleanup returned by `stale` runs before the next handler fires.
- `ok` — all signals have a settled value

**Single-signal form** — `ok` receives the value directly, `err` a single `Error`:

```typescript
createEffect(() => {
  match(task, {
    ok:    data  => render(data),
    stale: ()    => {
      dimContent()
      return clearDimmed
    },
    nil:   ()    => showSpinner(),
    err:   error => showError(error),
  })
})
```

**Tuple form** — for two or more signals; `ok` receives a typed tuple, `err` an `Error[]`:

```typescript
createEffect(() => {
  match([task, sensor], {
    ok:  ([result, value]) => render(result, value),
    nil: () => showSpinner(),
  })
})
```

Read all signals eagerly in the signals argument — not inside branches. See
non-obvious-behaviors.md for details on conditional reads.
</match_helper>

<lifecycle_summary>
| Function | Must be in owner? | Returns | Re-runs on dependency change? |
|---|---|---|---|
| `createScope(fn, options?)` | No | `Cleanup` | No (fn runs once) |
| `createEffect(fn)` | **Yes** | `Cleanup` | Yes |
| `createCell(value)` / `createState(value)` | No | `MutableCell<T>` | Source — never recomputes |
| `deriveCell(fn)` / `deriveComputed(fn)` | No | `Cell<T>` | Lazily (on read) |
| `deriveCell(asyncFn)` (internally `createTask`) | No | `Cell<T>` | Yes (async, with cancellation) |
| `deriveCell(seed, { watched })` (internally `createSensor`) | No | `Cell<T>` | Source — set by external push |
| `createList(items, options?)` | No | `MutableList<T>` | Source — keyed array |
| `deriveList(...)` | No | `List<T>` | Yes — whole-array, per-item, or external push |
| `createStore(value)` | No | `MutableStore<T>` | Source — proxy-based record |
| `deriveStore(...)` | No | `Store<T>` | Yes — per-property derivation |
| `createSlot(signal)` | No | `Slot<T>` | Forwarding — delegates to backing signal |
</lifecycle_summary>
