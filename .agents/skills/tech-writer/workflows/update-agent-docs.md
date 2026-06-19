<required_reading>
1. references/document-map.md — AGENTS.md section
2. references/tone-guide.md — agent-docs tone rules
</required_reading>

<process>
## Step 1: Read the source

Read the relevant `src/nodes/*.ts` file(s) and `src/graph.ts` if the change touches graph
semantics. Read the current `AGENTS.md` in full.
Never update agent docs from memory — subtle inaccuracies are worse than gaps.

## Step 2: Update AGENTS.md

`AGENTS.md` is the inference-time reference for coding agents (Claude, Copilot, ZCode/GLM,
Cursor, and any tool that loads workspace instructions). It covers code style, key patterns,
and file structure. Token cost is real — every line must earn its place.

**Code Style / Key Patterns sections**
- Update the code-style and key-pattern lists if a convention is established or changed.
- Update the file-structure map if a source file is added or removed.

**Common Code Patterns**
- This is the highest-value section for code generation. Patterns must compile against the
  current API. Verify each against `index.ts`.
- Add a pattern only if the usage cannot be inferred from existing patterns.

## Step 3: Non-obvious behaviors

The detailed catalog of counterintuitive behaviors lives in
`.agents/skills/shared/references/non-obvious-behaviors.md`, **not** in `AGENTS.md`.
Loaders of both `cause-effect` and `cause-effect-dev` skills read it.

- If a non-obvious behavior is added, changed, or removed, update that shared reference.
- Do NOT duplicate individual entries in `AGENTS.md`. If a behavior is important enough to
  surface on every invocation, add a one-line pointer in `AGENTS.md` referencing the shared
  reference.

Each shared-reference entry must follow this structure exactly:
1. **Bold statement** of the behavior — one sentence, declarative.
2. One or two sentences of implication. No padding.
3. A code example only if the correct pattern is non-obvious from the statement alone.
   Use the existing before/after style where it adds clarity.

Do NOT add entries for behavior that is obvious from the type signatures or from standard
reactive library conventions. The bar is: would an experienced reactive developer be
surprised by this?
</process>

<success_criteria>
- Source file(s) read before any edits
- `AGENTS.md` code patterns compile against the current `index.ts`
- `AGENTS.md` file-structure map lists all current `src/` files
- Non-obvious behavior changes go to the shared reference, not duplicated in `AGENTS.md`
- Document remains concise — no explanatory padding
- Tone matches references/tone-guide.md: terse and direct for `AGENTS.md`
</success_criteria>