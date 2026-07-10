# ADR 0017: Store Proxy Rejects Direct Writes

## Status

✅ Accepted

## Context

The `Store` proxy in `createStore` (`src/nodes/store.ts`) defined `get`, `has`, `ownKeys`, and `getOwnPropertyDescriptor` traps but **no `set`, `deleteProperty`, or `defineProperty` traps**. The default `set` behavior writes a raw value onto the `BaseStore` target object. Once written, `prop in target` is `true`, so the `get` trap returns the raw value instead of the child signal — the store's reactive state silently diverges from what property access shows:

```ts
const store = createStore({ name: 'Alice' })
;(store as any).name = 'Bob'      // no error
store.name                        // 'Bob' — raw string shadows the State signal
store.get()                       // { name: 'Alice' } — reactive value unchanged
```

`delete store.name` similarly bypassed `remove()` semantics: it deleted nothing reactive but returned `true`.

The library's existing philosophy is to throw typed, descriptive errors on misuse (`ReadonlySignalError`, `DuplicateKeyError`, `InvalidSignalValueError`). A silent corruption is the worst outcome — the guard makes misuse loud.

Relevant: [Explicit Reactivity](REQUIREMENTS.md#explicit-reactivity), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage), [Bundle Size](REQUIREMENTS.md#bundle-size).

## Decision

Add `set`, `deleteProperty`, and `defineProperty` traps to the `Store` proxy that throw `InvalidStoreMutationError` (a `TypeError` subclass). The error message names the correct alternative API:

- Assignment / define → `` use store.${prop}.set(value), store.set(next), or store.add(key, value) ``
- Deletion → `` use store.remove("prop") ``

A single parameterized error class covers all three actions. It is exported from the package barrel (`index.ts`).

Deliberately **not** routing `store.name = 'Bob'` to `signals.get('name').set('Bob')`. That would be a runtime convenience feature that contradicts the type system (see Alternatives). Throwing is the safe, non-committal fix; routing can be revisited as part of a future v2 if the type model itself changes.

## Alternatives Considered

- **(a) Route assignment to the child signal's `.set()`**: Rejected. The decisive obstacle is the **type system**, not the runtime logic. Cause & Effect's `Store<T>` maps properties to signals, not raw values:

  ```ts
  type Store<T> = BaseStore<T> & { [K in keyof T]: State<T[K] & {}> }
  ```

  So for `Store<{ name: string }>`, the type of `store.name` is `State<string>`, not `string`. Assignment `store.name = 'Bob'` is therefore a **compile-time error** — you cannot assign `string` to `State<string>`. Routing writes at runtime would create a feature usable only behind `as any` or `@ts-expect-error`, at which point the consumer might as well call `store.name.set('Bob')`, which type-checks cleanly.

  This is fundamentally different from SolidJS, where `store.name` is typed as the raw value (`string`), so proxy assignment type-checks and routes at runtime. Cause & Effect deliberately chose the "leaf properties are signals" type model because the alternative — properties typed as raw values — would mean that destructuring a store loses reactivity (the deconstructed value is a plain primitive, disconnected from the graph). The other alternative — deconstructed values changing type from primitive to signal depending on access pattern — was also considered unacceptable. Neither option was acceptable, so properties are signals. That choice makes write-routing type-contradictory.

  This type model is inherent to the library's design and cannot be changed without a major version bump. A clean solution for deconstruction and iteration that doesn't break the type contract is not yet identified.

- **(b) Route `deleteProperty` only, throw on `set`/`defineProperty`**: Rejected. `delete store.name` does map cleanly to `store.remove('name')` — there's no shape-category ambiguity, and `remove()` handles non-existent keys gracefully. But allowing deletion through the proxy while rejecting assignment creates **inconsistent proxy semantics**: consumers must learn that one mutation path works and another doesn't, with no principled distinction visible from the outside. The inconsistency is worse than a uniform error that redirects to the correct API.
- **(c) Return `false` from the `set` trap (trigger a generic `TypeError`)**: Rejected. Strict-mode proxies require `set` to return `true` or throw; returning `false` produces a generic `'set' on proxy: trap returned falsish` error with no guidance. Throwing the descriptive error is strictly better.
- **(d) Freeze the `BaseStore` target**: Rejected. Freezing adds risk with zero benefit — the proxy is the only public handle, and internal code never assigns properties onto the store after construction.
- **(e) Throw on direct writes** *(chosen)*: Fully consistent with the type system and the Explicit Reactivity principle. The type system already tells TS consumers that proxy writes are wrong; the runtime guard extends that protection to `any`-typed access, JS consumers, and `Object.assign`. The descriptive error redirects to the correct reactive API.

## Consequences

- ✅ **Silent corruption eliminated**: `store.name = 'Bob'` now throws immediately instead of shadowing the child signal. `store.get()` and `isState(store.name)` remain intact.
- ✅ **Descriptive errors**: `InvalidStoreMutationError` messages point consumers at the correct reactive API (`store.prop.set()`, `store.set()`, `store.add()`, `store.remove()`).
- ✅ **Covers realistic accidents**: `Object.assign(store, ...)` and `Reflect.set(store, ...)` route through the same `set` trap — no separate handling needed.
- ✅ **Minimal cost**: one small `TypeError` subclass + three one-line traps ≈ 200 B minified; within bundle size limits.
- ⚠️ **Behavior break (minor)**: code that previously "worked" by assigning (and silently corrupting) will now throw. This is the intended fix. It warrants a **minor** version bump (not patch), with a changelog entry.
- ⚠️ **TypeScript already flags typed writes**: `Store<T>` properties are typed as signals, so `store.name = 'Bob'` is a compile error when `T['name']` is `string`. The runtime guard matters for `any`-typed access, JS consumers, and `Object.assign`.

## Related

- Requirements: [Explicit Reactivity](REQUIREMENTS.md#explicit-reactivity), [Minimal Surface, Maximum Coverage](REQUIREMENTS.md#minimal-surface-maximum-coverage), [Bundle Size](REQUIREMENTS.md#bundle-size)
- Architecture: [Composite Signal Types](ARCHITECTURE.md#composite-signal-types)
- Dependencies: [Composite Lookup Methods Track Structural Changes (ADR-0015)](0015-composite-lookup-methods-track-structural-changes.md)
