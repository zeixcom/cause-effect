<overview>
Key API constraints, defaults, and callback patterns for @zeix/cause-effect. All knowledge is
self-contained — no library source files required. Read this when writing or reviewing any
code that uses the public API.
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
- `fn` receives no arguments and may return an optional cleanup
- Use to group effects and control their shared lifetime
- `options.root = true` (`ScopeOptions`) — suppresses parent-owner registration; the returned `dispose` is the sole teardown mechanism. Use when an external authority (e.g. a web component's `disconnectedCallback`) manages the scope's lifetime

```typescript
const dispose = createScope(() => {
  createEffect(() => console.log(count.get()))
  // all effects inside are disposed when dispose() is called
})
dispose() // cleans up everything inside
```

**`createEffect(fn)`**
- Returns a `Cleanup` function
- **Must be called inside an owner** (a `createScope` callback or another `createEffect` callback)
- Throws `RequiredOwnerError` if called without an active owner
- Runs `fn` immediately, then re-runs whenever tracked dependencies change

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
- Runs `fn` without recording dependency edges
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
- Runs `fn` without registering cleanups in the current owner
- For DOM-managed lifecycles involving a scope, prefer `createScope(fn, { root: true })` — it is equivalent to `unown(() => createScope(fn))` but more readable
- Use `unown` directly when detaching a single computation (e.g. `createEffect`) rather than a full scope

```typescript
connectedCallback() {
  // preferred: createScope with root: true
  this.#dispose = createScope(() => {
    createEffect(() => this.render())
  }, { root: true })
}
disconnectedCallback() {
  this.#dispose?.()
}
```
</core_functions>

<options>
**`equals`**
- Available on `createState`, `createSensor`, `createMemo`, `createTask`
- Default: strict equality (`===`)
- When a new value is considered equal to the previous one, propagation stops —
  downstream nodes are not re-run
- **`SKIP_EQUALITY`** — special sentinel value for `equals`; forces propagation on every
  update regardless of value. Use with mutable-reference sensors where the object
  reference never changes but the contents do:

```typescript
import { createSensor, SKIP_EQUALITY } from '@zeix/cause-effect'

const mouse = createSensor<{ x: number; y: number }>(
  set => {
    const handler = (e: MouseEvent) => set({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  },
  { equals: SKIP_EQUALITY } // new object every time, so skip reference equality
)
```

**`guard`**
- Available on `createState`, `createSensor`
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
**Memo and Task callbacks receive `prev`**
- Signature: `(prev: T) => T` for Memo; `(prev: T, signal: AbortSignal) => Promise<T>` for Task
- `prev` is the previous computed value, enabling reducer-style patterns without external state:

```typescript
const runningTotal = createMemo((prev: number) => prev + newValue.get())
```

**Task carries an `AbortSignal`**
- The second argument to the Task callback is an `AbortSignal`
- The signal is aborted when dependencies change before the previous async run completes
- Always forward it to any `fetch` or cancellable async operation:

```typescript
const results = createTask(async (prev, signal) => {
  const res = await fetch(`/api/search?q=${query.get()}`, { signal })
  return res.json()
})
```

**`Slot` is a property descriptor**
- Has `get`, `set`, `configurable`, `enumerable` fields — pass directly to `Object.defineProperty()`
- Delegates reads and writes to a swappable backing signal; use `replace(nextSignal)` to swap
- Is a forwarding layer, not a value owner — has no `update()` method

```typescript
const nameState = createState('Alice')
const nameSlot = createSlot(nameState)
Object.defineProperty(element, 'name', nameSlot)
```
</callback_patterns>

<match_helper>
`match` reads one or more Sensor/Task signals and routes to a handler based on signal state.

**Routing precedence:** `nil` > `err` > `stale` > `ok`

**Handlers:**
- `nil` — at least one signal has no value yet (loading)
- `err` — at least one signal has an error
- `stale` — all signals have a value but at least one Task is re-fetching (`isPending() === true`). Omitting `stale` falls back to `ok`, showing retained data unchanged. Cleanup returned by `stale` runs before the next handler fires.
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

Read all signals eagerly in the signals argument — not inside branches. See `non-obvious-behaviors.md → conditional-reads-delay-watched`.
</match_helper>

<lifecycle_summary>
| Function | Requires owner? | Returns | Reactive? |
|---|---|---|---|
| `createScope(fn, options?)` | No | `Cleanup` | No (fn runs once) |
| `createEffect(fn)` | **Yes** | `Cleanup` | Yes — re-runs on dependency change |
| `createMemo(fn)` | No | `Memo<T>` | Lazy — recomputes on read if stale |
| `createTask(fn)` | No | `Task<T>` | Yes — re-runs async on dependency change |
| `createState(value)` | No | `State<T>` | Source — never recomputes |
| `createSensor(setup)` | No | `Sensor<T>` | Source — set by external callback |
</lifecycle_summary>
