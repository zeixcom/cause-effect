<overview>
Every document the tech-writer skill maintains, with its audience, scope, what triggers an
update, and what to verify in a consistency review. Load this reference whenever you need
to determine which documents are affected by a change.
</overview>

<documents>

<REQUIREMENTS_md>
**Path:** `REQUIREMENTS.md`
**Audience:** Stakeholders, potential contributors, library authors evaluating adoption
**Register:** Formal, strategic, timeless — written to survive version bumps
**Scope:** Vision, primary and secondary audience, design principles, signal type set,
runtime environments, bundle size targets, non-goals, stability guarantees

**Update triggers:**
- A signal type is added to or removed from the library
- A runtime environment is added or dropped
- A bundle size target changes
- A design principle is added, changed, or removed
- The primary or secondary audience shifts
- A non-goal is resolved or a new one is established
- Stability guarantees change (version milestone, compatibility stance)

**Do NOT update for:** bug fixes, new options on existing types, internal refactors,
documentation or tooling changes.

**Consistency checks:**
- Signal type count in prose ("9 signal types") matches the table row count
- Signal type table rows match the exports in `index.ts`
- Non-goals do not contradict any feature currently in the library
- Runtime environments list reflects current CI targets
</REQUIREMENTS_md>

<README_md>
**Path:** `README.md`
**Audience:** Developers integrating the library — library authors and framework integrators
**Register:** Instructional, example-driven, precise — assumes TypeScript competence
**Scope:** Installation, quick start, full public API reference, signal type selection guide,
advanced usage patterns (batching, cleanup, scopes, watched callbacks)

**Update triggers:**
- Any factory function is added, removed, or has a changed signature
- Any option is added, renamed, removed, or changes semantics
- Any exported type is added, removed, or renamed
- A behavioral guarantee changes (e.g. sync vs async execution, equality semantics)
- A new advanced usage pattern is added to the library

**Consistency checks:**
- Every factory function in `index.ts` has a `### SignalType` section under `## API`
- All `@param`-level option names match current factory signatures
- Code examples in the API sections use current factory signatures and compile
- "Choosing the Right Signal" table covers all signal types with accurate descriptions
- "Advanced Usage" examples use current API
</README_md>

<GUIDE_md>
**Path:** `GUIDE.md`
**Audience:** Developers migrating from React, Vue, or Angular
**Register:** Comparative, educational, approachable — draws explicit parallels to other frameworks
**Scope:** Conceptual mapping from React/Vue/Angular primitives, key behavioral differences
(synchronous effects, auto-tracked dependencies, non-nullable types, scope-based ownership),
and signal types that go beyond what standard frameworks provide

**Update triggers:**
- A core factory name changes (breaks the "Familiar Core" comparison table)
- A fundamental behavioral contract changes — sync execution, dependency tracking model,
  nullability rules, or ownership semantics
- A new signal type is added that goes "Beyond the Basics"
- An existing "Beyond the Basics" signal type changes significantly enough that a framework
  developer's mental model derived from the guide would now be wrong

**Do NOT update for:** new options on existing signal types, minor signature tweaks, internal
changes, or anything that does not change how a React/Vue/Angular developer would think about
the library.

**Consistency checks:**
- "The Familiar Core" table references current factory function names (`createState`,
  `createMemo`, `createEffect`)
- "What Works Differently" sections describe current behavior accurately
- "Beyond the Basics" signal type sections use current factory signatures and options
- Code examples compile against current `index.ts`
</GUIDE_md>

<ARCHITECTURE_md>
**Path:** `ARCHITECTURE.md`
**Audience:** Contributors to the library; AI agents reasoning about internals
**Register:** Technical, precise, internal-facing — implementation details are expected and correct
**Scope:** Graph engine data structures (edges, node field mixins, concrete node types),
automatic dependency tracking (`activeSink`, `link`, `trimSources`, `unlink`), change
propagation (flag semantics, `propagate`, `refresh`, `setState`), effect scheduling (`batch`,
`flush`), ownership and cleanup (`activeOwner`, cleanup storage, `createScope`), and a
per-signal-type subsection describing each type's internal composition and lifecycle

**Update triggers:**
- The `Edge` type fields change
- Node field mixins (`SourceFields`, `SinkFields`, `OwnerFields`, `AsyncFields`) change
- A concrete node type is added, removed, or its composition changes
- `activeSink` or `activeOwner` semantics change
- `link()`, `trimSources()`, or `unlink()` behavior changes
- Flag names or values change (`FLAG_CLEAN`, `FLAG_CHECK`, `FLAG_DIRTY`, `FLAG_RUNNING`)
- `propagate()`, `refresh()`, `setState()`, `batch()`, or `flush()` behavior changes
- A new signal type is added (add a subsection) or removed (remove its subsection)

**Consistency checks:**
- "Concrete Node Types" table matches node shapes defined in `src/graph.ts`
- "Node Field Mixins" table matches field groups in `src/graph.ts`
- Flag names match constants in `src/graph.ts`
- Each signal type subsection describes current internal composition and lifecycle
- No subsection references a removed type, flag, or function
</ARCHITECTURE_md>

<AGENTS_md>
**Path:** `AGENTS.md`
**Audience:** Coding agents (Claude, Copilot, ZCode/GLM, Cursor) at inference time; also the
canonical skill index for the project
**Register:** Terse, direct, AI-optimized — every token has a cost; no explanatory padding
**Scope:** Project type and core concepts, code style (naming, generics, pure-function
annotations), key patterns (signal `.get()`/`.set()`, proxy reactivity, callbacks, batch/
untrack), file structure mapping `src/` modules to responsibilities, error-handling entry
points, and the index of available agent skills

**Update triggers:**
- A factory function signature changes (update the corresponding pattern)
- A new source file is added to `src/` (update the File Structure map)
- A coding convention or key pattern is established or changes
- The set of available agent skills changes (update the skill index)

**Do NOT update for:** non-obvious behavior entries (those live in the shared reference),
node-shape internals (those live in `ARCHITECTURE.md`), bug fixes that do not change
conventions.

**Consistency checks:**
- File Structure map lists all current `src/` and `src/nodes/` files
- Code patterns compile against current `index.ts` (factory signatures, option names,
  parameter order)
- Skill index matches the skills present under `.agents/skills/`
</AGENTS_md>

<jsdoc_in_src>
**Path:** `src/nodes/*.ts`, `src/graph.ts`, `src/errors.ts`, `src/util.ts`, `src/signal.ts`
**Audience:** IDE users (hover documentation), API consumers reading source
**Register:** Brief, typed, precise — one-line summaries; `@param`/`@returns` only
**Scope:** Public API functions and their parameters, return values, and non-obvious
constraints. Internal helpers do not require JSDoc.

**Update triggers:**
- A public function's parameter is added, removed, renamed, or retyped
- A public function's return value or semantics change
- A public function is removed (remove its JSDoc block with it)

**Consistency checks (spot-check):**
- `@param` names match current parameter names in the function signature
- `@returns` descriptions match current return type semantics
- No `@param` tags reference removed parameters
- No `@example` blocks use deprecated API
</jsdoc_in_src>

</documents>

<change_to_document_matrix>
Quick reference for update-after-change.md. Use this to identify affected documents.

| Change type                        | JSDoc | ARCH | AGENTS | README | GUIDE | REQ |
|------------------------------------|-------|------|--------|--------|-------|-----|
| New signal type                    | ✓     | ✓    | ✓      | ✓      | ✓     | ✓ * |
| Changed public signature / option  | ✓     | —    | ✓ if behavior | ✓ | ✓ if mental model | — |
| Removed public API                 | ✓     | ✓ if structural | ✓  | ✓      | ✓ if documented | — |
| New / changed non-obvious behavior | —     | ✓ if graph-level | — (shared ref) | ✓ if affects usage | — | — |
| Internal implementation change     | —     | ✓    | ✓      | —      | —     | — |
| Vision / scope / constraint change | —     | —    | —      | —      | —     | ✓ |

Non-obvious behaviors are authored in the shared reference
(`.agents/skills/shared/references/non-obvious-behaviors.md`), not in `AGENTS.md`.

\* For REQUIREMENTS.md: only the signal type table row. Not the prose count — update
that to match automatically.
</change_to_document_matrix>