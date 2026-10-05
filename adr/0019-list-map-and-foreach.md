# ADR 0019: `map()` and `forEach()` on List Signals

## Status

✅ Accepted — 2026-10-05

## Context

The Le Truc compiler compiles keyed lists written in TSX. A reactive list is spelled as a `.map()` call:

```tsx
<ul>
  {items.map((item, key) => (
    <li>
      <span>{() => item.get().label}</span>
      <button onClick={() => items.remove(key)}>Remove</button>
    </li>
  ))}
</ul>
```

It lowers this call to a reconcile function. The function creates a scope (`createScope()`) for each added key, disposes the scope of each removed key, and moves existing DOM nodes on reorder. It never re-renders an existing item: item content reaches the DOM only through the fine-grained bindings inside the callback. The `.map()` call therefore does not reach the client runtime.

The method must still exist on the type. Le Truc re-exports `List` from Cause & Effect, and a component's `.tsx` source must typecheck against that type. Without the method, Le Truc would need a server-side shim, and the shim would declare a method that the `List` object, which Le Truc claims to re-export, does not have. The type would then lie about its object.

No current accessor fits the JSX pattern:

| Accessor | Gives | Gap |
|----------|-------|-----|
| `get()` | Array of values | Values, not signals; a server would bake them in as plain values |
| `[Symbol.iterator]` | Item signals | No key |
| `keys()` + `byKey()` | Key, then signal | Two steps; not a `.map()` |

The callback needs each item's **signal**, for fine-grained bindings, and its stable **string key**, for keyed reconciliation and for mutations such as `remove(key)`.

Relevant: [Minimal Surface, Maximum Coverage](../REQUIREMENTS.md#minimal-surface-maximum-coverage), [Every Shape Is Derivable](../REQUIREMENTS.md#every-shape-is-derivable), [Explicit Reactivity](../REQUIREMENTS.md#explicit-reactivity), [Audience: Library Authors](../REQUIREMENTS.md#primary-library-authors).

## Decision

### 1. Two methods on both list kinds

```ts
map<R>(callbackfn: (item: S, key: string) => R): R[]
forEach(callbackfn: (item: S, key: string) => void): void
```

They go on `DerivedList<T, S>` (`src/nodes/collection.ts`, the readonly `List` of ADR-0018) and on `MutableList<T, S>` (`src/nodes/list.ts`). The deprecated aliases `Collection` and `List` inherit them through the types. In ADR-0018 §1 the readonly `List<T, S>` surface gains `map` and `forEach`, and `MutableList<T, S>` inherits them.

### 2. Arguments: signal, then key

The callback receives the item's signal `S` first and its key second. Under `createList(…, { createItem: createStore })`, `S` is `MutableStore<T>`. The order follows `Map.prototype.forEach((value, key) => …)`: a list is built from an array but keyed like a `Map`. The key is a `string`, not an array index, so tsc catches index arithmetic on it. There is no third argument. `Array.prototype.map` passes the array and `Map.prototype.forEach` passes the map, but no use case needs the list itself.

### 3. Return: a plain snapshot

`map` returns a plain `R[]`, not a signal. Reactive mapping over **values** stays with `deriveList`. `list.map` maps over the **signals** once, and `deriveList` maps over the values reactively. The two do not overlap.

Inside a derivation the snapshot composes correctly. In `deriveCell(() => list.map(s => s.get().label))`, `map` tracks the list and each `s.get()` tracks its item.

### 4. Order and traversal

Both methods visit items in current list order, the same order as `keys()` and the iterator. A key whose signal is missing is skipped, as the iterator skips it. The key array is copied before the traversal starts, so a callback that mutates the list does not change the current pass. The mutation propagates as usual.

### 5. Tracking: identical to the iterator

`map` and `forEach` belong to the structural accessor class of [ADR-0015](0015-composite-lookup-methods-track-structural-changes.md). Each call makes the same single structural access as `[Symbol.iterator]`: `subscribe()` on `MutableList`, `prepare()` in the shared `collectionFacade` on `DerivedList`. Neither method calls `signal.get()` itself. Reads inside `callbackfn` belong to the caller and track as usual.

The contract is "tracks like the iterator", **not** "tracks structure only". The list node has a single change channel, so on a `MutableList` these methods are notified by more than add, remove, and reorder:

| Change | Effect that only calls `map` or `forEach` |
|--------|-------------------------------------------|
| `add`, `remove`, `sort`, `splice`, `set` with a key change | Re-runs |
| `replace(key, v)` | Re-runs, by design (see below) |
| `byKey(k).set(v)` | Re-runs only after `list.get()` has linked the item signal to the list node |

On a `DerivedList`, the methods are notified whenever its iterator is notified.

`replace()` notifies the list node's sinks on purpose. An item signal links to the list node lazily, on the first `list.get()`. Before that link exists, `byKey(k).set(v)` reaches no consumer of the list. `replace()` sets the item signal and also propagates through the list node, so it reaches every consumer whatever its read history (`bykey_set_does_not_propagate_to_structural_subscribers` in `non-obvious-behaviors.md`).

The extra notifications are harmless for the motivating consumer. When a reconcile pass sees the same keys, it adds, removes, and moves nothing. This ADR does not change the notification behavior.

## Alternatives Considered

- **(a) Change the list iterator to yield `[key, signal]` pairs, as `Store`'s does**: Rejected. It breaks every `for…of` and spread over a list, and JSX would still need a `.map()`.
- **(b) Add `entries()` returning `[key, signal]` pairs**: Rejected. JSX consumes a `.map()` call directly. `[...list.entries()].map(…)` adds an allocation and does not match the idiom the compiler recognizes.
- **(c) Stamp the key on each item signal (`item.key`)**: Rejected. A signal does not know its key, and the property would collide with a `Store` field named `key`.
- **(d) Return a reactive list from `map`**: Rejected. That duplicates `deriveList`, contradicts the direction of retiring the `.deriveCollection()` method in favor of top-level factories, and would make the method's cost depend on its use.
- **(e) A Le Truc-side server shim that adds `map` to the type**: Rejected. The re-exported type would declare a method that the object lacks. Type honesty is the reason this ADR exists.
- **(f) Add `filter`, `reduce`, `some`, and the rest of the array family**: Rejected. Work on values goes through `get()` or `deriveList`. Each method is surface, and no use case requires them.
- **(g) Add `map` and `forEach` to `Store`**: Deferred. `Store`'s iterator already yields `[key, signal]`, and no use case iterates a record in JSX.
- **(h) Pass an index as the second argument**: Rejected. An index is not stable across reorders and cannot drive keyed reconciliation or `remove(key)`.

## Consequences

- ✅ **Honest types for TSX consumers**: `items.map((item, key) => …)` typechecks against the real `List` type, and no consumer needs a shim.
- ✅ **No new type, no new graph machinery**: two short methods in each of two places, built on existing structural access. Negligible bundle cost, nothing on the core path (`createState`, `createMemo`, `createTask`, `createEffect`).
- ✅ **Non-breaking**: the methods are additive, and they carry into the ADR-0018 taxonomy unchanged.
- ✅ **Composes with derivations**: a snapshot taken inside a `deriveCell` or `deriveList` callback tracks the list and the items it reads, with no imperative write.
- ⚠️ **The name suggests a reactive transform**: some developers will expect `list.map(fn)` to return a signal. JSDoc must state that the result is a plain array and point to `deriveList`.
- ⚠️ **Coarse notification**: an effect that only calls `map` re-runs on content changes that keep the keys (on a `MutableList`: `replace` always, `byKey(k).set` after `get()`). A consumer that re-renders on every run pays for this. The motivating consumer does not.
- ⚠️ **Two surface additions**: `forEach` has no JSX use case. It is kept for symmetry with `Map.prototype.forEach` and for imperative side-effect loops that need the key, which the iterator cannot give.

## Related

- Requirements: [Minimal Surface, Maximum Coverage](../REQUIREMENTS.md#minimal-surface-maximum-coverage), [Every Shape Is Derivable](../REQUIREMENTS.md#every-shape-is-derivable), [Explicit Reactivity](../REQUIREMENTS.md#explicit-reactivity)
- Architecture: [Composite Lookup Methods](../ARCHITECTURE.md#composite-lookup-methods)
- Dependencies: [ADR-0014](0014-two-path-access-pattern-for-composite-signals.md), [ADR-0015](0015-composite-lookup-methods-track-structural-changes.md), [ADR-0018](0018-shape-indexed-signal-types.md) (§1 `List` surface)
