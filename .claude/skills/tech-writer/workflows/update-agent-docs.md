<required_reading>
1. references/document-map.md — CLAUDE.md and copilot-instructions.md sections
2. references/tone-guide.md — agent-docs tone rules
</required_reading>

<process>
## Step 1: Read the source

Read the relevant `src/nodes/*.ts` file(s) and `src/graph.ts` if the change touches graph
semantics. Read the current `CLAUDE.md` and `.github/copilot-instructions.md` in full.
Never update agent docs from memory — subtle inaccuracies are worse than gaps.

## Step 2: Update CLAUDE.md

CLAUDE.md is the inference-time reference for Claude. It covers the mental model, internal
node shapes, and non-obvious behaviors. Token cost is real — every line must earn its place.

**Mental model section**
- Update the spreadsheet-cell analogy if a new signal type is added. One line per type,
  consistent with the existing terse style.

**Internal Node Shapes section**
- Update the node shape table if `SourceFields`, `SinkFields`, `OwnerFields`, or `AsyncFields`
  changed in `src/graph.ts`, or if a new node type was added.
- Update the `activeOwner` / `activeSink` description if their semantics changed.

**Non-Obvious Behaviors section**
- Add an entry when a behavior is counterintuitive enough that a competent developer would
  not predict it from the public API alone.
- Remove or correct an entry when a previously non-obvious behavior has changed.

Each entry must follow this structure exactly:
1. **Bold statement** of the behavior — one sentence, declarative.
2. One or two sentences of implication. No padding.
3. A code example only if the correct pattern is non-obvious from the statement alone.
   Use the existing before/after style where it adds clarity.

Do NOT add entries for behavior that is obvious from the type signatures or from standard
reactive library conventions. The bar is: would an experienced reactive developer be
surprised by this?

## Step 3: Update .github/copilot-instructions.md

copilot-instructions.md drives GitHub Copilot's code generation. Accuracy of the code
patterns is critical — Copilot uses these as generation templates.

**Core Architecture section**
- Update the node type list if a new node type was added or an existing one changed role.
- Update the flag list (`FLAG_CLEAN`, `FLAG_CHECK`, `FLAG_DIRTY`, `FLAG_RUNNING`) if flags
  were added, renamed, or removed.

**Signal Types section**
- Add a one-line entry for each new signal type: `**Name** (\`createName\`): description`.
- Update the description of any signal type whose behavior or options changed.

**Key Files Structure section**
- Add a new line if a new source file was added.

**Common Code Patterns section**
- This is the highest-value section. Update the code block under "Creating Signals" to
  reflect any changed factory signatures or new signal types.
- Patterns must compile against the current API. Verify each pattern against `index.ts`.
- Add a new pattern block only if the new usage cannot be inferred from existing patterns.

**Coding Conventions / API Design Principles sections**
- Update only if a new convention was established or an existing one changed.
</process>

<success_criteria>
- Source file(s) read before any edits
- CLAUDE.md non-obvious behavior entries accurate, terse, and consistently structured
- CLAUDE.md node shapes consistent with `src/graph.ts`
- copilot-instructions.md code patterns compile against the current `index.ts`
- Both documents remain concise — no explanatory padding
- Tone matches references/tone-guide.md: terse and direct for CLAUDE.md,
  structured and pattern-focused for copilot-instructions.md
</success_criteria>