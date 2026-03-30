<required_reading>
1. references/document-map.md — full index of documents, their scope, and what to verify in each
</required_reading>

<process>
## Step 1: Read the source of truth

Read `index.ts` for the complete public API surface. Read `src/graph.ts` for the graph engine
and internal node shapes. Note the current version in `package.json`.

These are the ground truth. Every document is checked against them, not against each other.

## Step 2: Check each document in turn

Work through the documents in this order. For each one, read the current document alongside
the relevant source, then record findings before moving to the next.

### REQUIREMENTS.md
- Signal type table (9 types) matches the exports in `index.ts`
- Bundle size targets still reflect current library scope
- Non-goals do not contradict any feature that has since been added
- Stability section reflects the current version and release status

### ARCHITECTURE.md
- Concrete Node Types table matches the node shapes in `src/graph.ts`
- Node Field Mixins table matches `SourceFields`, `SinkFields`, `OwnerFields`, `AsyncFields`
  as defined in `src/graph.ts`
- Flag names (`FLAG_CLEAN`, `FLAG_CHECK`, `FLAG_DIRTY`, `FLAG_RUNNING`) match `src/graph.ts`
- Each signal type subsection describes the correct internal composition and lifecycle
- No subsection references a removed node type, flag, or function

### CLAUDE.md
- Internal Node Shapes block matches `src/graph.ts`
- `activeOwner` / `activeSink` semantics description is accurate
- Each non-obvious behavior entry is still accurate for the current implementation
- Mental model analogy covers all 9 signal types

### .github/copilot-instructions.md
- Signal Types list covers all 9 signal types with accurate one-line descriptions
- Key Files Structure lists all current `src/` files
- Code patterns in "Common Code Patterns" compile against current `index.ts`
  (check factory signatures, option names, parameter order)
- API Design Principles reflect current conventions

### README.md
- Every factory function exported from `index.ts` has a documented `### SignalType` section
- All option names, parameter names, and types match current signatures
- Code examples in the API section use current factory signatures
- "Choosing the Right Signal" table covers all 9 signal types
- "Advanced Usage" examples use current API

### GUIDE.md
- "The Familiar Core" table references current factory function names
- "What Works Differently" sections describe current behavior
- "Beyond the Basics" signal type sections are accurate and use current API
- Code examples compile against current `index.ts`

### JSDoc in src/ (spot-check)
- Read `src/nodes/state.ts`, `src/nodes/memo.ts`, and `src/nodes/effect.ts`
- Verify that `@param` tags match current parameter names and types
- Verify that `@returns` descriptions are accurate
- Flag any JSDoc that describes removed or renamed options

## Step 3: Compile findings

Produce a structured report before making any edits:

```
## Consistency Review — [date]

### Accurate (no changes needed)
- REQUIREMENTS.md: consistent
- ...

### Gaps found
- ARCHITECTURE.md, "Concrete Node Types": [specific claim] is outdated — [what is correct]
- README.md, "### Task": option `abort` renamed to `signal` in current index.ts
- ...
```

Be specific: name the document, section, and the exact discrepancy. Do not summarize vaguely.

## Step 4: Confirm before editing

Present the report and ask: **"Shall I apply all of these updates, or would you like to
review and select?"**

Do not make any edits until explicitly confirmed. If the user confirms all, follow the
relevant per-document workflow for each gap identified. If they select a subset, update
only those.
</process>

<success_criteria>
- All seven documents checked against current source (`index.ts`, `src/graph.ts`)
- Findings reported as a structured list with specific document, section, and discrepancy
- No edits made before confirmation
- After confirmation, each gap resolved using the appropriate per-document workflow
</success_criteria>