# Cause & Effect — Domain Vocabulary

Cause & Effect is a reactive state management primitives library. This document defines the
precise meaning of domain-specific terms used throughout the project.

Every document maintained by the `tech-writer` skill uses these terms exactly as defined here.
The _Avoid_ list under each entry names disallowed synonyms, not merely discouraged ones.

## Signal Types

**Signal**:
The umbrella term for the nine public reactive types. Any value with a `.get()` method that
participates in the graph. `isSignal()` narrows to this type. Use **Signal** when the
statement holds for all nine types; name the specific type otherwise.
_Avoid_: observable, atom, ref, cell, reactive value

**State**:
A mutable **Source** that holds a value directly. Created with `createState()`. Backed by a
`StateNode`.
_Avoid_: variable, atom, ref, store (Store is a distinct type), signal (too generic)

**Sensor**:
A read-only **Source** whose value comes from outside the graph. Activates lazily when it
first becomes **Watched**, and runs its cleanup when it is no longer **Watched**. Created with
`createSensor()`. Backed by a `StateNode`.
_Avoid_: observable, stream, subscription, listener, external signal

**Memo**:
A synchronous **Computed**. Recomputes lazily on read when a **Dependency** changed. Created
with `createMemo()`. Backed by a `MemoNode`.
_Avoid_: computed (that term names the union of Memo and Task), selector, calculation,
derivation

**Task**:
An asynchronous **Computed**. Cancellable through an `AbortSignal`, and memoized like a Memo.
Created with `createTask()`. Backed by a `TaskNode`.
_Avoid_: async memo, promise, query, resource, async computed

**Store**:
A reactive object with keyed properties, implemented with a proxy. Created with
`createStore()`. Backed by a `MemoNode`.
_Avoid_: state, model, record, object signal, reactive object

**List**:
A reactive array with keyed items and stable item identity. Created with `createList()`.
Backed by a `MemoNode`.
_Avoid_: array signal, collection (Collection is a distinct type), sequence

**Collection**:
A set of keyed items with per-item memoization. Reads from an external source, or derives from
a List or Store through `deriveCollection()`. Created with `createCollection()`. Backed by a
`MemoNode`.

A Collection is **not** a reactive `Map`. It does not expose `Map` semantics. Its purpose is
per-item memoization under stable keys, so that a change to one item does not invalidate the
others.
_Avoid_: map, dictionary, hash, keyed store, list

**Slot**:
A forwarding layer to a swappable backing **Signal**. Holds no value of its own. `set()`
delegates to the backing Signal, and `replace()` swaps that Signal without breaking existing
**Edge** connections. Created with `createSlot()`. Backed by a `MemoNode`.

A Slot is **not** an event bus, a channel, or an emitter. It has no `emit()` method. It is
also not a value owner, which is why it has no `update()` method and is excluded from
**Mutable Signal**.
_Avoid_: event bus, channel, emitter, port, container, wrapper, holder, proxy

**Effect**:
A terminal **Sink** that runs side effects. The only signal type that runs eagerly. Created
with `createEffect()`. Backed by an `EffectNode`.
_Avoid_: reaction, autorun, watcher, subscriber, observer, listener

**Computed**:
The union of **Memo** and **Task**. `createComputed()` returns one or the other, and
`isComputed()` narrows to this union. Use **Computed** for the union type only. For the
general relationship, use the adjective *derived* ("a derived value", "derived from a Store").
_Avoid_: derivation (as a noun), calculated, formula

**Mutable Signal**:
The union of **State**, **Store**, and **List** — every Signal that has `get()`, `set()`, and
`update()`. `isMutableSignal()` narrows to this union. **Slot** is excluded by design; see
Flagged Ambiguities.
_Avoid_: writable signal, settable signal, source signal

## Graph Roles

**Node**:
The internal record that backs a **Signal**. Composed from field mixins (`SourceFields`,
`SinkFields`, `OwnerFields`, `AsyncFields`). Not public API — use **Node** in
`ARCHITECTURE.md`, `AGENTS.md`, and code comments only.
_Avoid_: cell, atom, vertex, object

**Edge**:
The connection from a **Source** to a **Sink**, stored as a doubly-linked list on both ends.
The verb is `link()` and the reverse is `unlink()`.
_Avoid_: link (as a noun), connection, subscription, arrow, reference

**Source**:
The graph role of a Node that supplies a value to others. Has `SourceFields`. A Source is not
necessarily a leaf: a Memo, Task, Store, List, Collection, and Slot are each a Source **and** a
**Sink**.
_Avoid_: producer, publisher, parent, input signal

**Sink**:
The graph role of a Node that reads one or more **Source** nodes. Has `SinkFields`. The active
Sink during tracked evaluation is `activeSink`.

This is the single approved term for the concept. The library's identifiers use it throughout
(`activeSink`, `sinks`, `SinkNode`, `SinkFields`), and "observer" collides with the DOM
`MutationObserver` and `IntersectionObserver` that appear in Sensor examples.
_Avoid_: subscriber, observer, watcher, dependent, consumer, child, listener

**Dependency**:
The relationship between a **Sink** and a **Source** it reads. A Source *is* a role; a
Dependency *is* a relationship. Write "the Memo has two dependencies" and "the State is a
Source". Do not write "the Memo has two sources".
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
Becoming Watched activates a Sensor and invokes the `watched` option of a **Computed**. Losing
the last watcher runs the corresponding cleanup.
_Avoid_: subscribed, observed, active, live, hot

## Propagation

**Batch**:
A group of writes wrapped in `batch()`. Effects run once when the outermost Batch exits.
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
_Avoid_: stale, invalid, fresh, outdated, pending (Task uses *pending* for its own state)

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

- A **Signal** is backed by a **Node**; the Node is internal and the Signal is public.
- A **Node** acts as a **Source**, a **Sink**, or both. A **State** and a **Sensor** are
  Sources only. An **Effect** is a Sink only. A **Memo**, **Task**, **Store**, **List**,
  **Collection**, and **Slot** are both.
- A **Sink** reads a **Source**, which creates an **Edge**. That relationship is a
  **Dependency**.
- A **Computed** is a **Memo** or a **Task**. A **Mutable Signal** is a **State**, a **Store**,
  or a **List**.
- An **Owner** is an **Effect** or a **Scope**. It holds **Cleanup** functions and disposes its
  children.
- A **Source** becomes **Watched** when an **Effect** depends on it, directly or transitively.
- A write to a **Source** marks its Sinks **Dirty** and their transitive Sinks **Check**.
- A **Batch** defers the **Flush**. Each **Flush** runs one or more **Pass** iterations.
- A **Slot** delegates to a backing **Signal** and can **replace** it without breaking its
  **Edge** connections.

## Example Dialogue

> **Dev:** "Why does my Memo not recompute when the Store changes?"
> **Architect:** "Check the **Edge**. A Memo only tracks a **Dependency** it read through
> `.get()` during its last evaluation. If the read happened inside `untrack()`, there is no
> Edge, so the write marks nothing **Dirty**."

> **Dev:** "Can I use a **Slot** to broadcast events to several **Effect** instances?"
> **Architect:** "No. A Slot is a forwarding layer to a swappable backing **Signal**, not an
> event bus. It has no `emit()`. Use a **State** and write to it, or a **Sensor** if the events
> come from outside the graph."

## Flagged Ambiguities

**Slot** — the term does not carry its concept. An LLM given the name and a short description,
without access to the source, reconstructed Slot as an event bus with `emit()`/`get()`. Until a
rename is decided, every Slot mention in prose states what a Slot is not. A rename is under
consideration for the next major version; no ADR is written yet.

**Collection** — the same failure mode. The same reconstruction read Collection as a reactive
`Map` with `get`/`set`/`has`/`delete`/`keys`/`size`. The name suggests a container; the concept
is per-item memoization under stable keys. Every Collection mention states what a Collection is
not. Rename likewise under consideration.

**Slot is not a Mutable Signal** — a recurring source of confusion, because a Slot has `get()`
and `set()` and therefore looks writable. It is excluded from `isMutableSignal()` deliberately:
a Slot forwards, it does not own a value, and it has no `update()`. Do not describe a Slot as
writable without also naming the exclusion.

**Pass collides with Le Truc** — in Cause & Effect, **Pass** means one iteration of the
**Flush** loop. In Le Truc's `CONTEXT.md`, **Pass** means live Signal sharing between component
instances. The two vocabularies are independent. When a document discusses both libraries, use
"flush pass" for the Cause & Effect meaning.

**Do not import Le Truc's vocabulary** — Le Truc consumes this library, but its `CONTEXT.md`
is written from the consumer side and conflicts with this one. Its **Signal** entry lists
"state" and "store" as words to avoid, and both are Cause & Effect type names. Its **Slot**
entry defines Slot in terms of `pass()`, which is a Le Truc mechanism. Maintain the two
documents independently.
