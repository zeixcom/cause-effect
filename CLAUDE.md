# Claude Context for Cause & Effect

## Skills

Use these skills for targeted knowledge discovery — they carry full reference knowledge and step-by-step workflows:

- **`/cause-effect-dev`** — implement features, fix bugs, write tests, answer questions about the library's internals or public API. Loads source-map, internal-types, non-obvious-behaviors, and error-classes from `.claude/skills/cause-effect-dev/references/`.
- **`/cause-effect`** — use the library from a consumer project. Loads embedded signal-types, api-facts, non-obvious-behaviors, and error-classes — no source files required.

## Non-Obvious Facts

These are easy to get wrong and not derivable from reading the source without prior context.

**`T extends {}` at the type level.** Every signal generic excludes `null` and `undefined`. Represent absence with a sentinel or wrapper type.

**`byKey()`, `at()`, `keyAt()`, and `indexOfKey()` do not create graph edges.** To react to structural changes, read `get()`, `keys()`, or `length`. To update an item, use `list.replace(key, value)` — `byKey(key).set(value)` silently misses effects that subscribed via `keys()`, `length`, or the iterator.

**Conditional reads delay `watched` activation.** A signal inside a branch that hasn't executed has no dependency edge and does not fire `watched`. Pass all signals eagerly in the `match` tuple rather than reading them inside individual branches.

**`stale` in `match()` fires when all signals have a value but at least one Task is re-fetching.** Routing precedence: `nil` > `err` > `stale` > `ok`. Omitting `stale` falls back to `ok`. Cleanup returned by `stale` runs before the next handler fires.

**`equals` suppresses entire downstream subgraphs.** When a Memo recomputes to the same value, downstream nodes receive `FLAG_CHECK` and skip recomputation entirely. A custom `equals` on an intermediate Memo can silently prevent large subtrees from updating.

**`SKIP_EQUALITY` forces propagation on every update.** Use with `createSensor` when observing a mutable object whose reference is stable but whose contents change.

**`watched` stays active through structural mutations.** Add/remove/sort on a List or Collection do not restart the `watched`/`unwatched` cycle, including across `.deriveCollection()` chains.

**Memo and Task callbacks receive the previous value as their first argument.** Enables reducer patterns without external state: `createMemo((prev = 0) => prev + tick.get())`.

**`Slot` is a valid property descriptor** with `get`, `set`, `configurable`, and `enumerable` — pass directly to `Object.defineProperty()`. `slot.replace(nextSignal)` swaps the backing signal. Slot has no `update()` — it is a forwarding layer, not a mutable cell.

**`unown()` is the correct fix for DOM-owned component lifecycles.** `createScope` inside `connectedCallback` registers its `dispose` on the parent effect's cleanup list — disposing the component on the next parent re-run. Wrap with `unown(() => createScope(...))` to leave `disconnectedCallback` as the sole lifecycle authority.
