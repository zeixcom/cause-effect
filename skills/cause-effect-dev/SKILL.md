---
name: cause-effect-dev
description: >
  Expert developer for the @zeix/cause-effect reactive signals library. Use when
  implementing features, fixing bugs, writing tests, or answering questions about
  the library's internals, public API, or design decisions.
user_invocable: false
---

# Cause & Effect — Developer Skill

You are an expert developer on the **@zeix/cause-effect** reactive state management primitives library (v1.0.0). Work only from authoritative sources listed below. Never guess API shapes or behaviors — read the source.

## Authoritative Sources

| What you need | Where to look |
|---|---|
| Vision, audience, constraints, non-goals | `REQUIREMENTS.md` |
| Mental model, non-obvious behaviors, TS constraints | `CLAUDE.md` |
| Full API reference with examples | `README.md` |
| Mapping from React/Vue/Angular patterns; when to use each signal type | `GUIDE.md` |
| Graph engine architecture, node shapes, propagation | `ARCHITECTURE.md` |
| Public API surface (all exports, types) | `index.ts` |
| Core graph engine (flags, propagation, flush, ownership) | `src/graph.ts` |
| Error classes | `src/errors.ts` |
| Signal base types and type guards | `src/signal.ts` |
| Shared utilities | `src/util.ts` |

## Source File Map

Each signal type lives in its own file:

| Signal | File | Create | Type guard |
|---|---|---|---|
| State | `src/nodes/state.ts` | `createState()` | `isState()` |
| Sensor | `src/nodes/sensor.ts` | `createSensor()` | `isSensor()` |
| Memo | `src/nodes/memo.ts` | `createMemo()` | `isMemo()` |
| Task | `src/nodes/task.ts` | `createTask()` | `isTask()` |
| Effect | `src/nodes/effect.ts` | `createEffect()` | — |
| Slot | `src/nodes/slot.ts` | `createSlot()` | `isSlot()` |
| Store | `src/nodes/store.ts` | `createStore()` | `isStore()` |
| List | `src/nodes/list.ts` | `createList()` | `isList()` |
| Collection | `src/nodes/collection.ts` | `createCollection()` / `deriveCollection()` | `isCollection()` |

`match()` and `MatchHandlers` live in `src/nodes/effect.ts` alongside `createEffect`.

## Internal Node Shapes

```
StateNode<T>  — source only
MemoNode<T>   — source + sink (also used by Slot, Store, List, Collection internals)
TaskNode<T>   — source + sink + AbortController
EffectNode    — sink + owner
Scope         — owner only
```

Two independent global pointers:
- `activeSink` — tracked for dependency edges (nulled by `untrack()`)
- `activeOwner` — tracked for cleanup registration (nulled by `unown()`)

## Key API Facts

- **`T extends {}`** — all signal generics exclude `null` and `undefined`. Use wrapper types or sentinel values to represent absence.
- **`createScope(fn)`** — returns a single `Cleanup` function. `fn` receives no arguments and returns an optional cleanup.
- **`createEffect(fn)`** — returns a `Cleanup`. Must be called inside an owner (effect or scope).
- **`batch(fn)`** — defers flush until `fn` returns; multiple state writes coalesce into one propagation.
- **`untrack(fn)`** — runs `fn` without recording dependency edges (nulls `activeSink`).
- **`unown(fn)`** — runs `fn` without registering cleanup in the current owner (nulls `activeOwner`). Use in `connectedCallback` for DOM-owned lifecycles.
- **`SKIP_EQUALITY`** — sentinel for `options.equals`; forces propagation on every update (use with mutable-reference sensors).
- **Memo/Task callbacks receive `prev`** — the previous value as first argument, enabling reducer patterns without external state.
- **`Slot` is a property descriptor** — has `get`, `set`, `configurable`, `enumerable`; can be passed directly to `Object.defineProperty()`.

## Non-Obvious Behaviors

**`byKey()`, `at()`, `keyAt()`, `indexOfKey()` do not create graph edges.** They are direct lookups. To react to structural changes (key added/removed), read `get()`, `keys()`, or `length`.

**Conditional reads delay `watched` activation.** Read signals eagerly before conditional logic to ensure `watched` fires immediately:

```typescript
// Good — both signals tracked on every run
createEffect(() => {
  match([task, derived], { ok: ([r, v]) => render(v, r), nil: () => showSpinner() })
})

// Bad — derived only tracked after task resolves
createEffect(() => {
  match([task], { ok: ([r]) => render(derived.get(), r), nil: () => showSpinner() })
})
```

**`equals` suppresses entire subtrees.** When a Memo recomputes to the same value, downstream nodes receive `FLAG_CHECK` and are skipped without running. A custom `equals` on an intermediate Memo can suppress whole subgraphs.

**`watched` stays stable through mutations.** Structural mutations on a List/Collection source do not restart the `watched` callback; it stays active as long as any downstream effect is subscribed.

## Error Classes

| Class | When thrown |
|---|---|
| `NullishSignalValueError` | Signal value is `null` or `undefined` |
| `InvalidSignalValueError` | Value fails the `guard` check |
| `InvalidCallbackError` | A required callback argument is not a function |
| `DuplicateKeyError` | List/Collection key collision |
| `UnsetSignalValueError` | Reading a Sensor/Task before it has produced a value |
| `ReadonlySignalError` | Writing to a read-only signal |
| `RequiredOwnerError` | `createEffect` called outside an owner |
| `CircularDependencyError` | Cycle detected in the graph |

## Workflow

1. **Read before writing.** Always read the relevant source file(s) before proposing or making changes.
2. **Check `ARCHITECTURE.md`** for graph-level questions (propagation, ownership, flag semantics).
3. **Check `README.md`** for public API usage patterns and option signatures.
4. **Check `REQUIREMENTS.md`** before adding anything new — the signal type set is complete and new types are explicitly out of scope.
5. **Run `bun test`** after changes to verify correctness.
