<required_reading>
1. references/document-map.md — ARCHITECTURE.md section
2. references/tone-guide.md — architecture tone rules
</required_reading>

<process>
## Step 1: Read the source of truth

Read `src/graph.ts` in full. Read any changed `src/nodes/*.ts` file(s). ARCHITECTURE.md
describes internals — accuracy requires reading the actual implementation, not inferring
from public API or documentation.

## Step 2: Identify what changed architecturally

Changes that warrant an ARCHITECTURE.md update:

| Changed | Section to update |
|---|---|
| Edge structure (`Edge` type fields) | Core Data Structures → Edges |
| Node field mixins (`SourceFields`, `SinkFields`, etc.) | Core Data Structures → Node Field Mixins |
| Concrete node types or their composition | Core Data Structures → Concrete Node Types |
| `activeSink` protocol or `link()`/`trimSources()`/`unlink()` | Automatic Dependency Tracking |
| Flag values or `propagate()`/`refresh()`/`setState()` | Change Propagation |
| `batch()`/`flush()` or effect scheduling | Effect Scheduling |
| `activeOwner`, cleanup storage, `createScope()` | Ownership and Cleanup |
| New or changed signal type | Signal Types → relevant subsection |

Do NOT update sections that remain accurate. If only `src/nodes/memo.ts` changed, only
the Memo subsection under "Signal Types" needs editing.

## Step 3: Update the affected section(s)

For each affected section:

1. Re-read the current section text alongside the new source.
2. Identify specific claims that are now wrong or incomplete.
3. Make the minimal edit that makes those claims accurate.

**Node shape changes:** Update the table in "Concrete Node Types" and the corresponding
mixin table if field composition changed. If a new field mixin was added, add a row.

**Propagation or flag changes:** Update the prose description and any pseudocode or
inline code that references the changed behavior. If flag names changed, update every
occurrence.

**New signal type:** Add a new subsection under "Signal Types" following the existing
pattern: one paragraph describing the node's role in the graph, its internal composition,
and any non-obvious lifecycle behavior (watched activation, ownership, async cancellation).
Do not duplicate the public API — describe the internal mechanics only.

**Removed signal type:** Remove its subsection. Check for cross-references in other
subsections.
</process>

<success_criteria>
- `src/graph.ts` read in full before any edits
- Only sections affected by the change were modified
- Node shapes, flag names, and function descriptions match the current source exactly
- New signal type subsection follows the structure and depth of existing subsections
- Tone is technical and internal-facing per references/tone-guide.md
</success_criteria>