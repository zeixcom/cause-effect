<overview>
The shape-indexed value types of @zeix/cause-effect: what each is for, how construction routes, and how to choose between similar types. Value types are indexed by shape and mutability; origin is a property of construction. All knowledge is embedded — no external files required.
</overview>

<type_catalog>

<Signal>
**What it is:** The single-value shape — one reactive value, read with `.get()`.

**Construction:**
- `createSignal(value)` → `MutableSignal` — a value you own and write with `.set()` / `.update()`
- `deriveSignal(fn)` → sync derivation
- `deriveSignal(asyncFn, { initial? })` → async derivation with cancellation
- `deriveSignal(seed, { watched })` → external push with a lazy lifecycle

**Key facts:**
- `T extends {}` — no `null` / `undefined`; absence is modelled explicitly
- A sync derivation is lazy and memoized; `equals` (default `===`) suppresses downstream propagation
- An async derivation stays unset until the first resolution (`match` handles it) unless `initial` is passed
- The async callback receives `(prev, abortSignal)` — forward `abortSignal` to `fetch` or any cancellable operation
- The narrow factories `createState`, `createMemo`, `createTask`, `createSensor` construct the same shape with one origin each (tree-shaking)

```typescript
const count = createSignal(0)
count.set(count.get() + 1)
count.update(n => n + 1)

const user = deriveSignal(async (_prev, abortSignal) => {
  const res = await fetch(`/api/users/${id.get()}`, { signal: abortSignal })
  return res.json()
}, { initial: fallbackUser })

const pointer = deriveSignal({ x: 0, y: 0 }, {
  watched: emit => {
    const h = (e: PointerEvent) => emit({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', h)
    return () => window.removeEventListener('pointermove', h)
  },
})
```
</Signal>

<List>
**What it is:** The keyed-sequence shape — an ordered array of items with stable keys and per-item reactivity.

**Construction:**
- `createList(array, options?)` → `MutableList`
- `deriveList(fn)` / `deriveList(asyncFn, { initial })` → whole-array derivation
- `deriveList(source, itemFn)` → per-item memoization; `itemFn` may be async (cancels per item)
- `deriveList(seed, { watched })` → external push with granular add/change/remove

**Key facts:**
- Keys survive sorting and reordering; a `keyConfig` option derives them from item content
- `byKey()`, `at()`, `keyAt()`, and `indexOfKey()` are direct lookups — they **do not create graph edges**. Read `get()`, `keys()`, or `length` to react to structural changes
- Update an existing item with `list.replace(key, value)` — **not** `byKey(key).set(value)`. `replace()` propagates to all subscribers; `byKey().set()` silently misses effects that subscribed via `keys()`, `length`, or the iterator
- A derived list is never unset: the async form requires `initial`, and `isPending(list)` distinguishes loading-empty from resolved-empty
- Any signal holding an array can be a `deriveList` source — including an async one

```typescript
const todos = createList(
  [{ id: 't1', text: 'Buy milk', done: false }],
  { keyConfig: todo => todo.id }
)
todos.add({ id: 't2', text: 'Walk dog', done: false })
todos.replace('t1', { id: 't1', text: 'Buy milk', done: true })
todos.remove('t2')

const display = deriveList(todos, todo => ({
  label: todo.done ? `[x] ${todo.text}` : `[ ] ${todo.text}`
}))
```
</List>

<Store>
**What it is:** The keyed-record shape — an object whose properties are individually reactive, reached through a proxy.

**Construction:**
- `createStore(record)` → `MutableStore` — recurses: nested records become nested stores, nested arrays become lists (writes need targets)
- `deriveStore(fn)` / `deriveStore(asyncFn, { initial })` / `deriveStore(seed, { watched })` → flat per-property derivation

**Key facts:**
- Reading a property inside an effect creates a dependency on that property only
- Updating one property does not re-run effects that only read other properties
- A derived store does not recurse — a nested property is a plain signal of the nested value. Compose `deriveStore` / `deriveList` on the property for deeper granularity

```typescript
const user = createStore({ name: 'Alice', age: 30 })
user.name.set('Bob') // only effects reading `user.name` re-run
```
</Store>

<Effect>
**What it is:** A side effect that runs when its tracked dependencies change.

**Use when:**
- You need to synchronise reactive state with the outside world: update the DOM, write to localStorage, send analytics, call an imperative library
- You need a reactive subscription that runs code (not just derives a value)

**Key facts:**
- **Must be created inside an owner** (`createScope` or another effect) — throws `RequiredOwnerError` otherwise
- Runs immediately on creation, then re-runs on dependency changes
- Returns a `Cleanup` function; calling it disposes the effect and all its children
- Write outward — to the DOM, network, or storage. Never write inward, to a signal a computation could derive: an inward write is a dependency the graph cannot see
- Use `createScope(fn, { root: true })` in `connectedCallback` for DOM-managed lifetimes

```typescript
const dispose = createScope(() => {
  createEffect(() => {
    document.title = pageTitle.get()
  })
})
// later: dispose()
```
</Effect>

<Slot>
**What it is:** A reactive property descriptor — a signal packaged as a getter/setter pair compatible with `Object.defineProperty`.

**Use when:**
- You need to attach a reactive value as a property on an object (e.g. a Web Component's observed attribute)
- A property position must swap its backing signal without breaking existing sinks

**Key facts:**
- Has `get`, `set`, `configurable`, and `enumerable` fields — pass directly to `Object.defineProperty`
- Delegates to a swappable backing signal (any shape); use `replace(nextSignal)` to swap
- Forwarding layer only — has no `update()` method, and `isMutableSignal()` excludes it

```typescript
const nameState = createSignal('Alice')
const nameSlot = createSlot(nameState)
Object.defineProperty(element, 'name', nameSlot)
```
</Slot>

</type_catalog>

<construction_matrix>

Two questions route construction: what shape do you want, and who produces the value? `create*` yields the mutable type; `derive*` yields the readonly one.

| You have | Single value | Keyed sequence | Keyed record |
|---|---|---|---|
| A value you own | `createSignal(value)` | `createList(array)` | `createStore(record)` |
| Other signals, sync | `deriveSignal(fn)` | `deriveList(fn)` | `deriveStore(fn)` |
| Other signals, async | `deriveSignal(asyncFn)` | `deriveList(asyncFn, { initial })` | `deriveStore(asyncFn, { initial })` |
| An external source | `deriveSignal(seed, { watched })` | `deriveList(seed, { watched })` | `deriveStore(seed, { watched })` |
| A source array + item transform | — | `deriveList(source, itemFn)` | — |

**`watched` signatures** — an option, never a callback position. A seed input takes
`(emit) => Cleanup`; a function input takes `(invalidate) => Cleanup`. The `emit` argument is
shape-appropriate: `emit(value)`, `emit(changes)`, `emit(patch)`. Passing the wrong form
compiles but degrades silently — match the form to the input kind.

**`initial`** — the before-first-computation option on every factory. Required for derived
lists and stores (never unset); optional for `deriveSignal` (unset-until-resolution is what
`match`'s `nil` branch consumes).

</construction_matrix>

<decision_guide>

<choose_by_shape>
**What kind of data is it?**

- One value → **Signal** (mutable via **MutableSignal**)
- An ordered array of items with identity → **List** / **MutableList**
- An object with named properties read and updated independently → **Store** / **MutableStore**
</choose_by_shape>

<choose_by_purpose>
**What do you need to do with it?**

- Read a derived value without side effects → `derive*`
- Run a side effect when something changes → **Effect**
- Expose a reactive value as an object property → **Slot**
</choose_by_purpose>

<direct_comparisons>

**createSignal vs deriveSignal**
Use `createSignal` when you call `.set()` yourself. Use `deriveSignal` when the value is computed (sync or async) or pushed from an external source through `watched`.

**Sync vs async derivation**
Both receive `prev`; the async form also receives `abortSignal` and re-runs with cancellation when dependencies change. Async lists and stores require `initial`; a single value stays unset until first resolution unless `initial` is passed.

**Signal vs Effect**
A derivation produces a value (lazy, no side effects). An **Effect** runs side effects (imperative, eager, requires owner). Never write a derived value from inside an effect — derive it.

**Signal vs Store**
Use **Signal** for a single value always replaced wholesale. Use **Store** for an object whose individual properties are read and updated independently.

**List vs Store**
Use **Store** for a fixed set of named properties on one object. Use **List** for a dynamic number of items with uniform shape.

**whole-array vs per-item list derivation**
`deriveList(fn)` recomputes the array as one value. `deriveList(source, itemFn)` memoizes per item — a change to one item re-derives only that item. Prefer per-item when items render or compute independently.

</direct_comparisons>

</decision_guide>

<common_patterns>

<loading_state>
Async derivations without `initial` start unset. Use `match` to handle all states in one expression.

Routing precedence: `nil` > `err` > `stale` > `ok`. `stale` fires when all signals have a retained value but at least one is asynchronously re-computing — omitting it falls back to `ok`:

```typescript
createEffect(() => {
  match(task, {
    ok:    data  => renderData(data),
    stale: ()    => {
      dimContent()
      return clearDimmed
    },
    err:   error => renderError(error),
    nil:   ()    => renderSpinner(),
  })
})
```

For two or more signals, use the tuple form — `ok` receives a typed tuple:

```typescript
createEffect(() => {
  match([task, sensor], {
    ok:  ([data, pos]) => render(data, pos),
    nil: () => renderSpinner(),
  })
})
```
</loading_state>

<grouping_effects>
Always wrap top-level effects in `createScope` to control their lifetime:

```typescript
const dispose = createScope(() => {
  createEffect(() => { /* ... */ })
  createEffect(() => { /* ... */ })
})

// When done (e.g. component unmounted):
dispose()
```
</grouping_effects>

<coalescing_updates>
Use `batch` when multiple writes should trigger only one downstream propagation:

```typescript
batch(() => {
  x.set(1)
  y.set(2)
  z.set(3)
  // downstream effects run once, after all three are set
})
```
</coalescing_updates>

<reading_without_subscribing>
Use `untrack` to read a signal's current value without creating a dependency edge:

```typescript
createEffect(() => {
  const primary = primary.get()           // tracked — re-runs when primary changes
  const snapshot = untrack(() => log.get()) // not tracked — just reads current value
  console.log(primary, snapshot)
})
```
</reading_without_subscribing>

<checking_shapes>
The guards are indexed by shape and mutability. `isSignal` matches the single-value shape only:

```typescript
if (isList(value)) renderRows(value.get())
else if (isStore(value)) renderRecord(value.get())
else if (isSignal(value)) renderValue(value.get())
```

For "is this any reactive value at all", use the structural check — `typeof x?.get === 'function'` — not a guard. It accepts every shape plus descriptor-like objects.
</checking_shapes>

</common_patterns>
