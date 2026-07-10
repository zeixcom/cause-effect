# PLAN: Store Proxy Write Guard (reject direct assignment / delete)

## Goal

Direct property assignment on a `Store` proxy currently **corrupts the store silently**.

**Confirmed defect (reproduced on `next`, 2026-07-10):**

```ts
const store = createStore({ name: 'Alice' })
;(store as any).name = 'Bob'      // no error!
store.name                        // 'Bob'  — raw string, the State signal is now shadowed
store.get()                       // { name: 'Alice' } — the reactive value is unchanged
```

The proxy in `createStore` (`src/nodes/store.ts:354–381`) defines `get`, `has`, `ownKeys`, and `getOwnPropertyDescriptor` traps but **no `set`, `deleteProperty`, or `defineProperty` traps**. The default `set` behavior writes the raw value onto the `BaseStore` target object; from then on `prop in target` is true, so the `get` trap returns the raw value instead of the child signal, `has` reports it, and the store's reactive state diverges from what property access shows. `delete store.name` similarly bypasses `remove()` semantics (it deletes nothing reactive but returns `true`).

Fix: make misuse loud. Assignment and deletion through the proxy throw a descriptive error pointing at the correct API (`store.key.set(v)` / `store.set({...})` / `store.add(k, v)` / `store.remove(k)`). This matches the library's existing philosophy of throwing typed, descriptive errors on misuse (`ReadonlySignalError`, `DuplicateKeyError`, `InvalidSignalValueError`).

Deliberately **not** routing `store.name = 'Bob'` to `signals.get('name').set('Bob')`: that would be a new write API, needs shape-category replacement logic (primitive→array transitions, see `applyChanges` at `src/nodes/store.ts:226`), changes the public contract, and per REQUIREMENTS.md new surface is added reluctantly. Throwing is the safe, non-committal fix; routing can be a future ADR.

## Files to touch

- `src/errors.ts` — new error class
- `src/nodes/store.ts` — add proxy traps
- `index.ts` — export the new error class
- `test/store.test.ts` — new tests
- `.agents/skills/shared/references/non-obvious-behaviors.md` — new entry for method-name shadowing (step 5)
- `adr/` — new ADR via the adr-keeper skill (step 6; optional if the user prefers no ADR)

## Implementation steps

1. **Add an error class** in `src/errors.ts`, following the existing style (see `ReadonlySignalError` at line 94):

   ```ts
   /**
    * Error thrown when a Store property is assigned or deleted directly via the proxy.
    */
   class InvalidStoreMutationError extends TypeError {
       constructor(prop: string, hint: string) {
           super(`[Store] Cannot ${hint} property "${prop}" directly`)
           this.name = 'InvalidStoreMutationError'
       }
   }
   ```

   Adjust the message to include guidance, e.g. for set: `` `[Store] Cannot assign to property "${prop}" directly — use store.${prop}.set(value), store.set(next), or store.add(key, value)` ``. Keep one class with a parameterized message rather than two classes. Export it from `src/errors.ts` and re-export from `index.ts` (alphabetical position within the existing error export block).

2. **Add traps to the Proxy in `createStore`** (`src/nodes/store.ts`, inside `new Proxy(store, { ... })`):

   ```ts
   set(_target, prop) {
       throw new InvalidStoreMutationError(String(prop), 'assign to')
   },
   deleteProperty(_target, prop) {
       throw new InvalidStoreMutationError(String(prop), 'delete')
   },
   defineProperty(_target, prop) {
       throw new InvalidStoreMutationError(String(prop), 'define')
   },
   ```

   (Exact message wording per step 1; the three hints should produce messages that name the right alternative: `set()` family for assign/define, `store.remove(key)` for delete.)

3. **Import** `InvalidStoreMutationError` in `store.ts` (extend the existing `import { DuplicateKeyError, validateSignalValue } from '../errors'` line).

4. **Tests** in `test/store.test.ts`:
   - `store.name = 'Bob'` throws `InvalidStoreMutationError`; afterwards `store.name` is still the `State` signal (`isState(store.name)` true) and `store.get()` unchanged.
   - `delete (store as any).name` throws; `store.get()` unchanged; `store.remove('name')` still works.
   - `Object.assign(store, { name: 'Bob' })` throws (goes through the `set` trap).
   - `Object.defineProperty(store, 'x', { value: 1 })` throws.
   - Regression: reads through the proxy (`store.name.get()`), `keys()`, iteration, spread via `ownKeys` still work (existing tests cover most of this; run them).

5. **Document the method-name shadowing footgun** discovered while exploring: a store created with a data key named like a base method (`get`, `set`, `keys`, `update`, `add`, `remove`, `byKey`) is unreachable via proxy access — `store.get` returns the method (because the `get` trap checks `prop in target` first) — and only reachable via `store.byKey('get')`. This is inherent to the proxy design and NOT changed by this plan. Add a short entry to `.agents/skills/shared/references/non-obvious-behaviors.md` (follow the existing XML-tag entry format, e.g. `<store_method_names_shadow_data_keys>`) showing the `byKey` escape hatch, and a one-sentence note in the `createStore` JSDoc in `src/nodes/store.ts`.

6. **Record the decision.** Invoke the adr-keeper skill to add an ADR ("Store proxy rejects direct writes") covering: the silent-divergence defect, the throw-vs-route alternatives, and why routing was deferred. If executing this plan in a context without the skill, create `adr/0017-store-proxy-rejects-direct-writes.md` following the structure of `adr/0015-*.md` (Status/Context/Decision/Alternatives Considered/Consequences) and add it to `.agents/skills/adr-keeper/references/adr-index.md`.

7. Run `bun test`, `bun run regression`, `bunx biome lint .`, `bunx tsc --noEmit`.

## Edge cases a weaker model would likely miss

- **Strict-mode proxies require `set` to return `true` or throw.** Returning `false` would make consumers see a generic `TypeError: 'set' on proxy: trap returned falsish` — always throw the descriptive error instead; never `return false`.
- **The traps must throw for symbol properties too** (`store[Symbol.for('x')] = 1`). `String(prop)` handles symbols safely (`Symbol(x)` stringifies via `String()`, not via implicit coercion which would throw). Do not special-case symbols to silently succeed — a symbol write would hit the same shadowing bug via the default behavior. Note: the `get` trap intentionally returns `undefined` for unknown symbols; that stays.
- **`Reflect.set(store, k, v)` and `Object.assign(store, ...)` route through the same `set` trap** — no separate handling needed, but the `Object.assign` test matters because it's the realistic accident (merging "plain object" patterns onto a store).
- **Do not add the traps to the `BaseStore` target itself or freeze the target.** The proxy is the only public handle; internal code never assigns properties onto `store` after construction (verified: `createStore` builds the full object literal once). Freezing would break nothing today but adds risk with zero benefit.
- **This is technically a behavior break**: code that previously "worked" by assigning (and silently corrupting) will now throw. That is the point — but it should be listed under a **minor** version bump with a changelog entry (changelog-keeper skill), not a patch.
- **TypeScript already flags these writes** for typed stores (`Store<T>` properties are typed as signals, so `store.name = 'Bob'` is a type error when `T['name']` is `string`) — the runtime guard matters for `any`-typed access, JS consumers, and `Object.assign`. Tests need `as any` casts or `@ts-expect-error` — prefer `@ts-expect-error` with a reason comment, matching repo test style.
- **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on** — when writing the error class and traps, `prop` is `string | symbol`; handle the union explicitly, don't assume `string`.
- **Bundle size**: one small class + three traps ≈ 200 B minified; limits have headroom, verify with `bun run regression`.

## Acceptance criteria

1. All four new throwing tests pass; the silent-corruption reproduction now throws `InvalidStoreMutationError` and leaves `store.get()` and `isState(store.name)` intact.
2. `InvalidStoreMutationError` is exported from the package barrel (`import { InvalidStoreMutationError } from '@zeix/cause-effect'` type-checks).
3. All pre-existing tests pass; `bun run regression`, `bunx tsc --noEmit`, `bunx biome lint .` all clean.
4. Non-obvious-behaviors reference has the new shadowing entry; ADR exists and is indexed.
