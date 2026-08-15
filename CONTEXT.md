# Cause & Effect — Domain Vocabulary

Cause & Effect is a reactive state management primitives library. This document defines the
precise meaning of domain-specific terms used throughout the project.

Every document maintained by the `tech-writer` skill uses these terms exactly as defined here.
The _Avoid_ list under each entry names disallowed synonyms, not merely discouraged ones.

## Value Types

Value types are indexed by **shape** (single value, keyed sequence, keyed record) and
**mutability** (readonly base, mutable extension). Origin is not part of the type — it is a
property of construction. See Construction below.

**Signal**:
The single-value shape — one reactive value, read with `get()`. Created by `createSignal()`
(mutable) or `deriveSignal()` and the narrow factories it dispatches to. `isSignal()` narrows
to this shape; `List` and `Store` have their own guards.
_Avoid_: observable, atom, ref, cell, reactive value, and the retired origin type names
`State`, `Memo`, `Task`, `Sensor` (they survive only as narrow-factory names)

**MutableSignal**:
The mutable extension of **Signal** — adds `set()` and `update()`. `isMutableSignal()` narrows
to it. **Slot** is excluded by design; see Flagged Ambiguities.
_Avoid_: writable signal, settable signal, source signal

**List**:
The keyed-sequence shape — an ordered array of items with stable keys and per-item
reactivity. `get()` returns the array; `at()`, `byKey()`, `keyAt()`, `indexOfKey()`, `keys()`,
and iteration read structure and items. Created by `createList()` (mutable) or `deriveList()`
(sync, async, per-item, or external push).
_Avoid_: collection, sequence, reactive array, array signal

**MutableList**:
The mutable extension of **List** — adds `set()`, `update()`, `add()`, `remove()`,
`replace()`, `sort()`, and `splice()`. `isMutableList()` narrows to it.
_Avoid_: mutable collection

**Store**:
The keyed-record shape — a reactive object whose properties are individually reactive,
reached through a proxy. Created by `createStore()` (mutable, recursing into nested values) or
`deriveStore()` (flat: nested values are plain signals; compose `deriveStore`/`deriveList` on
a property for deeper granularity).
_Avoid_: state, model, record, object signal, reactive object

**MutableStore**:
The mutable extension of **Store** — adds `set()`, `update()`, `add()`, and `remove()`.
`isMutableStore()` narrows to it.
_Avoid_: mutable record

**Effect**:
A terminal **Sink** that runs side effects. The only eagerly running primitive. Created with
`createEffect()`. Effects write outward — to the DOM, the network, or storage — never inward,
to a signal a computation could derive.
_Avoid_: reaction, autorun, watcher, subscriber, observer, listener

**Slot**:
A forwarding layer to a swappable backing **Signal**. Holds no value of its own. `set()`
delegates to the backing Signal, and `replace()` swaps that Signal without breaking existing
**Edge** connections. Created with `createSlot()`. Backed by a `MemoNode`.

A Slot is **not** an event bus, a channel, or an emitter. It is also not a value owner, which
is why it has no `update()` method and is excluded from **MutableSignal**.
_Avoid_: event bus, channel, emitter, port, container, wrapper, holder, proxy

## Graph Roles

**Node**:
The internal record that backs a value type. Composed from field mixins (`SourceFields`,
`SinkFields`, `OwnerFields`, `AsyncFields`). Not public API — use **Node** in
`ARCHITECTURE.md`, `AGENTS.md`, and code comments only.
_Avoid_: cell, atom, vertex, object

**Edge**:
The connection from a **Source** to a **Sink**, stored as a doubly-linked list on both ends.
The verb is `link()` and the reverse is `unlink()`.
_Avoid_: link (as a noun), connection, subscription, arrow, reference

**Source**:
The graph role of a Node that supplies a value to others. Has `SourceFields`. A Source is not
necessarily a leaf: a derived Signal, a Store, a List, and a Slot are each a Source **and** a
**Sink**.
_Avoid_: producer, publisher, parent, input signal

**Sink**:
The graph role of a Node that reads one or more **Source** nodes. Has `SinkFields`. The active
Sink during tracked evaluation is `activeSink`.

This is the single approved term for the concept. The library's identifiers use it throughout
(`activeSink`, `sinks`, `SinkNode`, `SinkFields`), and "observer" collides with the DOM
`MutationObserver` and `IntersectionObserver` that appear in external-push examples.
_Avoid_: subscriber, observer, watcher, dependent, consumer, child, listener

**Dependency**:
The relationship between a **Sink** and a **Source** it reads. A Source *is* a role; a
Dependency *is* a relationship. Write "the derived signal has two dependencies" and "the
signal is a Source". Do not write "the derived signal has two sources".
_Avoid_: input, reference, parent, upstream signal

**upstream / downstream**:
Directional adjectives, permitted for describing propagation direction. Never use either as a
noun in place of **Source** or **Sink**. Write "propagates downstream", not "notifies the
downstreams".

## Lifecycle

**Scope**:
An ownership boundary created by `createScope()`. Disposes everything created inside it.
_Avoid_: context, container, lifetime, root (reserved for the `root` option of `ScopeOptions`)

**Owner**:
An **Effect** or a **Scope** that holds cleanups and disposes its children. The active Owner is
`activeOwner`. Both types are Owners; do not treat Owner as a synonym for Scope.
_Avoid_: parent, container, host

**Cleanup**:
A function that runs before a re-run and on disposal. *Dispose* is the act; *Cleanup* is the
function.
_Avoid_: teardown, destructor, unsubscribe, disposer, finalizer

**Watched**:
A **Source** is Watched when at least one **Effect** depends on it, directly or transitively.
Becoming Watched starts an external-push lifecycle (`watched` with `emit`) and invokes the
`watched` option of a derivation (`invalidate` form). Losing the last watcher runs the
corresponding cleanup.
_Avoid_: subscribed, observed, active, live, hot

## Propagation

**Batch**:
A group of writes wrapped in `batch()`. Effects run once, when the outermost Batch exits.
_Avoid_: transaction, group, bundle

**Flush**:
Draining the queue of scheduled effects until the graph converges. Performed by `flush()`.
_Avoid_: tick, cycle, drain, settle

**Pass**:
One iteration of the **Flush** loop. Bounded by `MAX_FLUSH_PASSES`; exceeding it throws
`EffectConvergenceError`.
_Avoid_: cycle, round, iteration, generation

**Clean / Check / Dirty**:
The three flag states of a **Sink**, spelled `FLAG_CLEAN`, `FLAG_CHECK`, and `FLAG_DIRTY`.
Clean means the value is current. Check means a transitive Dependency may have changed. Dirty
means the Node must recompute.
_Avoid_: stale, invalid, fresh, outdated, pending (`isPending` names the async-loading state)

## Construction

`create*` constructs the mutable type from a value you own. `derive*` constructs the readonly
type and picks the origin from its input. Route by "you have Y, you want X → call Z":

| You have | You want single value | You want keyed sequence | You want keyed record |
|---|---|---|---|
| A value you own | `createSignal(value)` | `createList(array)` | `createStore(record)` |
| Other signals, sync | `deriveSignal(fn)` | `deriveList(fn)` | `deriveStore(fn)` |
| Other signals, async | `deriveSignal(asyncFn)` | `deriveList(asyncFn, { initial })` | `deriveStore(asyncFn, { initial })` |
| An external source | `deriveSignal(seed, { watched })` | `deriveList(seed, { watched })` | `deriveStore(seed, { watched })` |
| A source array + item transform | — | `deriveList(source, itemFn)` | — |

- The narrow factories `createState`, `createMemo`, `createTask`, and `createSensor` construct
  the same shapes with one origin each. They exist for tree-shaking, not vocabulary.
- `watched` is an option, never a callback position. A seed input takes `(emit) => Cleanup`;
  a function input takes `(invalidate) => Cleanup`.
- The before-first-computation option is `initial` on every factory. The first positional
  parameter is `value` on `create*` and `input` on `derive*`. "Seed" is prose shorthand
  only, never an identifier.
- An `AbortSignal` callback parameter is named `abortSignal` — never `signal` (collides with
  the **Signal** type) and never `abort` (collides with the `abort(signal)` utility).
- A push callback's argument is named `emit` on all three shapes.

## Other

**Guard**:
A type-guard predicate of the form `(value: unknown) => value is T`, passed as the `guard`
option to validate values.
_Avoid_: validator, check, assertion, predicate

**Equality Strategy**:
The comparison used to decide whether a value changed. Supplied through the `equals` option, or
through the constants `DEFAULT_EQUALITY`, `SKIP_EQUALITY`, and `DEEP_EQUALITY` (see
[ADR 0003](adr/0003-equality-strategy-naming-convention.md)).
_Avoid_: comparator, equality function, differ, comparison

## Relationships

- A value type is backed by a **Node**; the Node is internal and the value type is public.
- A **Node** acts as a **Source**, a **Sink**, or both. A `createSignal` result is a Source
  only. An **Effect** is a Sink only. A derived Signal, a Store, a List, and a Slot are both.
- A **Sink** reads a **Source**, which creates an **Edge**. That relationship is a
  **Dependency**.
- A **MutableSignal** is a **Signal** with `set()` and `update()`. The same extension holds for
  **MutableList** over **List** and **MutableStore** over **Store**.
- An **Owner** is an **Effect** or a **Scope**. It holds **Cleanup** functions and disposes its
  children.
- A **Source** becomes **Watched** when an **Effect** depends on it, directly or transitively.
- A write to a **Source** marks its Sinks **Dirty** and their transitive Sinks **Check**.
- A **Batch** defers the **Flush**. Each **Flush** runs one or more **Pass** iterations.
- A **Slot** delegates to a backing **Signal** and can `replace` it without breaking its
  **Edge** connections.
- There is no umbrella noun for "anything with a `.get()`". Say **value types** for the six,
  and name **Effect** and **Slot** separately. For "is this any reactive value at all", use
  the structural check `typeof x?.get === 'function'` — it also accepts descriptor-like
  objects a tag check never would.

## Example Dialogue

> **Dev:** "Why does my derived signal not recompute when the Store changes?"
> **Architect:** "Check the **Edge**. A derivation only tracks a **Dependency** it read
> through `.get()` during its last evaluation. If the read happened inside `untrack()`, there
> is no Edge, so the write marks nothing **Dirty**."

> **Dev:** "Can I use a **Slot** to broadcast events to several **Effect** instances?"
> **Architect:** "No. A Slot is a forwarding layer to a swappable backing **Signal**, not an
> event bus. It has no `emit()`. Use `createSignal` and write to it, or the external-push
> form of `deriveSignal` if the events come from outside the graph."

## Flagged Ambiguities

**Slot** — the term does not carry its concept. An LLM given the name and a short description,
without access to the source, reconstructed Slot as an event bus with `emit()`/`get()`. Until
a rename is decided, every Slot mention in prose states what a Slot is not. A rename is under
consideration for the next major version; no ADR is written yet.

**Slot is not a MutableSignal** — a recurring source of confusion, because a Slot has `get()`
and `set()` and therefore looks writable. It is excluded from `isMutableSignal()` deliberately:
a Slot forwards, it does not own a value, and it has no `update()`. Do not describe a Slot as
writable without also naming the exclusion.

**`isSignal` matches one shape** — the guard name suggests "any signal", but it matches only
the single-value shape. `List`, `Store`, and `Slot` have their own guards. Writers recovering a
former umbrella meaning must use the structural `.get()` check instead, never widen the prose
meaning of `isSignal`.

**Pass collides with Le Truc** — in Cause & Effect, **Pass** means one iteration of the
**Flush** loop. In Le Truc's `CONTEXT.md`, **Pass** means live Signal sharing between component
instances. The two vocabularies are independent. When a document discusses both libraries, use
"flush pass" for the Cause & Effect meaning.

**Do not import Le Truc's vocabulary** — Le Truc consumes this library, but its `CONTEXT.md`
is written from the consumer side and conflicts with this one. Its **Signal** entry lists
"state" and "store" as words to avoid, and both are Cause & Effect construction verbs and type
names. Its **Slot** entry defines Slot in terms of `pass()`, which is a Le Truc mechanism.
Maintain the two documents independently.
