<overview>
What each signal type in @zeix/cause-effect is for, when to use each one, and how to choose between similar types. All knowledge is embedded — no external files required.
</overview>

<signal_catalog>

<State>
**What it is:** A mutable reactive value you own and update explicitly.

**Use when:**
- You control when and how the value changes
- The value is UI state, form input, a counter, a toggle, a selection
- You need to write to it directly with `.set()`

**Key facts:**
- Requires an initial value
- Synchronous reads and writes
- Supports `equals` (default `===`) and `guard` options

```typescript
const count = createState(0)
count.set(count.get() + 1)
count.update(n => n + 1)   // if update helper exists; else use set
```
</State>

<Sensor>
**What it is:** A reactive value produced by an external source you don't control.

**Use when:**
- The value comes from outside the reactive graph: DOM events, timers, WebSocket messages, geolocation, device orientation, IntersectionObserver, etc.
- You need `watched`/`unwatched` hooks to start and stop the external subscription efficiently
- The value has no meaningful initial state before the source fires

**Key facts:**
- Starts **unset** — reading before the first value throws `UnsetSignalValueError`; use `match` to handle the initial state
- `watched` fires when the first downstream effect subscribes; `unwatched` fires when the last one unsubscribes
- The setup function receives a `set` callback; return a cleanup function to tear down the subscription

```typescript
const pointer = createSensor<{ x: number; y: number }>(set => {
  const handler = (e: PointerEvent) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('pointermove', handler)
  return () => window.removeEventListener('pointermove', handler)
})
```
</Sensor>

<Memo>
**What it is:** A synchronously derived value that stays in sync with its dependencies.

**Use when:**
- The value can be computed from other signals without async work
- You want to avoid recomputing an expensive derivation on every read
- You need a stable reference: Memo caches the last computed value and only recomputes when dependencies change

**Key facts:**
- Lazy — only recomputes when read after a dependency has changed
- Receives `prev` as its first argument (enables referential stability patterns)
- Supports `equals` to suppress downstream propagation when the new value is equivalent

```typescript
const fullName = createMemo(() => `${firstName.get()} ${lastName.get()}`)
```
</Memo>

<Task>
**What it is:** An asynchronously derived value — like Memo, but async.

**Use when:**
- The derivation requires `await` (data fetching, async transforms, indexed DB reads)
- You want automatic cancellation of in-flight work when dependencies change

**Key facts:**
- Starts **unset** until the first async operation completes; use `match` for the loading state
- Receives `(prev, signal: AbortSignal)` — always forward `signal` to `fetch` or any cancellable async operation to prevent stale responses overwriting fresh ones
- Re-runs automatically when tracked dependencies change, aborting the previous run

```typescript
const results = createTask(async (prev, signal) => {
  const res = await fetch(`/api/search?q=${query.get()}`, { signal })
  return res.json()
})
```
</Task>

<Effect>
**What it is:** A side effect that runs when its tracked dependencies change.

**Use when:**
- You need to synchronise reactive state with the outside world: update the DOM, write to localStorage, send analytics, call an imperative library
- You need a reactive subscription that runs code (not just derives a value)

**Key facts:**
- **Must be created inside an owner** (`createScope` or another effect) — throws `RequiredOwnerError` otherwise
- Runs immediately on creation, then re-runs on dependency changes
- Returns a `Cleanup` function; calling it disposes the effect and all its children
- Use `unown` inside `connectedCallback` / `disconnectedCallback` when the DOM manages the element's lifetime

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
- You want property access (`element.name`) to participate in the reactive graph

**Key facts:**
- Has `get`, `set`, `configurable`, and `enumerable` fields
- Can be passed directly to `Object.defineProperty`
- Backed by a `State` internally

```typescript
const nameSlot = createSlot(store, 'name')
Object.defineProperty(element, 'name', nameSlot)
```
</Slot>

<Store>
**What it is:** A reactive object whose properties are individually reactive.

**Use when:**
- You have a group of related values that are read and updated independently
- You want fine-grained reactivity on an object's fields rather than replacing the whole object

**Key facts:**
- Reading a property inside an effect creates a dependency on that property only
- Updating one property does not re-run effects that only read other properties

```typescript
const user = createStore({ name: 'Alice', age: 30 })
user.name = 'Bob'   // only effects reading `user.name` re-run
```
</Store>

<List>
**What it is:** An ordered, keyed reactive collection — an array where each item has a stable identity.

**Use when:**
- Order matters and items have identity (drag-and-drop lists, ranked results, timelines)
- You need to react to structural changes (items added, removed, reordered) as well as value changes

**Key facts:**
- Items are identified by a stable key; keys survive sorting and reordering
- `byKey()`, `at()`, `keyAt()`, and `indexOfKey()` are direct lookups — they **do not create graph edges**
- To react to structural changes, read `get()`, `keys()`, or `length` instead
- To update an existing item, use `list.replace(key, value)` — **not** `byKey(key).set(value)`. `replace()` propagates to all subscribers; `byKey().set()` silently misses effects that subscribed via `keys()`, `length`, or the iterator

```typescript
const todos = createList(
  [{ id: 't1', text: 'Buy milk', done: false }],
  { keyConfig: todo => todo.id }
)
todos.add({ id: 't2', text: 'Walk dog', done: false })
todos.replace('t1', { id: 't1', text: 'Buy milk', done: true }) // update in place
todos.remove('t2')
```
</List>

<Collection>
**What it is:** A keyed reactive collection — a reactive Map.

**Use when:**
- Items are identified by key and order is not meaningful or variable
- You need fast key-based lookup with reactive tracking on the key set and individual entries
- Use cases: entity caches, normalised data stores, lookup tables

**Key facts:**
- `createCollection` creates a collection from an initial set of entries
- `deriveCollection` creates a collection derived from another reactive source
- Same tracking rules as List: `byKey()` does not create graph edges; read `get()`, `keys()`, or `length` to subscribe to structural changes

```typescript
const users = createCollection<string, User>(
  existingUsers.map(u => [u.id, u])
)
```
</Collection>

</signal_catalog>

<decision_guide>

<choose_by_value_source>
**Who controls the value?**

- You set it explicitly → **State**
- An external event or subscription provides it → **Sensor**
- It is computed from other signals (sync) → **Memo**
- It is computed from other signals (async) → **Task**
</choose_by_value_source>

<choose_by_purpose>
**What do you need to do with it?**

- Read a derived value without side effects → **Memo** or **Task**
- Run a side effect when something changes → **Effect**
- Expose a reactive value as an object property → **Slot**
- Group related reactive values on an object → **Store**
- Maintain an ordered list of keyed items → **List**
- Maintain an unordered map of keyed items → **Collection**
</choose_by_purpose>

<direct_comparisons>

**State vs Sensor**
Use `State` when you call `.set()` yourself. Use `Sensor` when an external source calls the setter — the library manages the subscription lifecycle via `watched`/`unwatched`.

**Memo vs Task**
Use `Memo` for synchronous derivations. Use `Task` when derivation requires `await`. Both receive `prev` and both support `equals`.

**Memo vs Effect**
`Memo` derives a value (no side effects, lazy). `Effect` runs side effects (imperative, eager, requires owner).

**State vs Store**
Use `State` for a single primitive or object that is always replaced wholesale. Use `Store` for an object whose individual properties are read and updated independently — Store gives you field-level reactivity.

**List vs Collection**
Both are keyed. Use `List` when order is significant (rendering order, ranking, sorting). Use `Collection` when items are looked up by key and order is not meaningful.

**List / Collection vs Store**
Use `Store` for a fixed set of named properties on a single object. Use `List` or `Collection` for a dynamic number of items with uniform shape.

</direct_comparisons>

</decision_guide>

<common_patterns>

<loading_state>
Sensor and Task start unset. Use `match` to handle all states in one expression:

```typescript
createEffect(() => {
  match([task], {
    ok: ([data]) => renderData(data),
    err: ([error]) => renderError(error),
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
Use `batch` when multiple state writes should trigger only one downstream propagation:

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

</common_patterns>