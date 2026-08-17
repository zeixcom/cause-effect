# Agent Skills for Cause & Effect

## Vocabulary

`CONTEXT.md` at the repo root defines the domain vocabulary. Use the approved term for every
concept. The _Avoid_ list under each entry names disallowed synonyms.

## Construction Routing

Value types are indexed by shape × mutability (`Cell`/`MutableCell`, `List`/`MutableList`,
`Store`/`MutableStore`), plus orthogonal `Effect` and `Slot`. `Signal`/`MutableSignal` are the
umbrella shape, matching `Cell`, `List`, or `Store` alike. Construction is indexed by origin:
`create*` → mutable, `derive*` → readonly. Route by "you have Y, you want X → call Z":

| You have | You want single value | You want keyed sequence | You want keyed record |
|---|---|---|---|
| Value you own | `createCell(value)` | `createList(array)` | `createStore(record)` |
| Other signals, sync | `deriveCell(fn)` | `deriveList(fn)` | `deriveStore(fn)` |
| Other signals, async | `deriveCell(asyncFn)` | `deriveList(asyncFn, { initial })` | `deriveStore(asyncFn, { initial })` |
| External source | `deriveCell(seed, { watched })` | `deriveList(seed, { watched })` | `deriveStore(seed, { watched })` |
| Source array + item transform | — | `deriveList(source, itemFn)` | — |

- Never write a derived value from inside an effect — derive it. Every cell above is reachable.
- Narrow single-origin factories (`createState`, `deriveComputed`) exist for tree-shaking;
  `deriveCell` dispatches to them, and to the internal-only `createTask`/`createSensor` for the
  async and external-push origins.
- `watched` is always an option, never a callback position. Seed input → `(emit) => Cleanup`;
  function input → `(invalidate) => Cleanup`.
- Guards: `isCell`/`isMutableCell` match the single-value shape only — `List`, `Store`, `Slot`
  have their own. `isSignal`/`isMutableSignal` match the umbrella shape (`Cell`, `List`, or
  `Store` alike). "Anything reactive" → `typeof x?.get === 'function'`.

## Available Skills

Each skill carries its own reference knowledge and workflows. Invoke the one that matches the
task.

- **`/cause-effect-dev`** — implement features, fix bugs, write tests, answer questions about
  internals or public API. Needs library source files. References:
  `.agents/skills/cause-effect-dev/references/` (source-map, internal-types) plus shared
  references (api-facts, non-obvious-behaviors, error-classes).

- **`/cause-effect`** — use the library from a consumer project. Needs no source files.
  References: `.agents/skills/cause-effect/references/` (signal-types) plus the same shared
  references.

- **`/architect`** — triage issues, gather requirements, design solutions, review API changes.
  Maintains `REQUIREMENTS.md`, `ARCHITECTURE.md`, `TODO.md`. Workflows:
  `.agents/skills/architect/workflows/`.

- **`/adr-keeper`** — create, update, list, and supersede Architectural Decision Records in
  `adr/`.

- **`/changelog-keeper`** — maintain `CHANGELOG.md`. Adds entries and prepares releases.

- **`/tech-writer`** — keep documentation in sync with the source. Maintains `README.md`,
  `GUIDE.md`, `RECIPES.md`, `REACT_INTEGRATION.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`,
  `AGENTS.md`, `.github/copilot-instructions.md`, and JSDoc in `src/`. Applies
  `.agents/skills/tech-writer/references/ste100-style.md` and `CONTEXT.md`.

## Where the Facts Live

Non-obvious runtime behaviors live in
`.agents/skills/shared/references/non-obvious-behaviors.md`, not in this file. The
`cause-effect` and `cause-effect-dev` skills load it. Read that reference before you reason
about propagation, convergence, or lifecycle edge cases.
