---
name: tech-writer
description: >
  Keep developer-facing documents up to date with the @zeix/cause-effect source code:
  README.md, GUIDE.md, ARCHITECTURE.md, REQUIREMENTS.md, CLAUDE.md,
  .github/copilot-instructions.md, and JSDoc in src/. Use after code changes, to verify
  consistency, or to update a specific document.
user_invocable: true
---

<scope>
This skill is for the cause-effect library repository. It expects source files at `src/`
and `index.ts`, documentation at the project root, and agent instructions at `.github/`.

For consumer projects using `@zeix/cause-effect` as a dependency, use the `cause-effect`
skill instead.
</scope>

<essential_principles>
**Read source before writing.** Always read the current state of the relevant source file(s)
and the target document before making any changes. Never update from memory.

**Tone adapts to audience.** Each document has a distinct primary reader and register.
See references/tone-guide.md. Violating the tone is as wrong as a factual error.

**Concise over comprehensive.** Every sentence must justify its presence. Cut anything
that does not add information the reader needs. Technical accuracy is non-negotiable;
length is not.

**Surgical edits only.** Update what changed. Do not rewrite sections that are still
accurate, and do not add commentary about what was updated.
</essential_principles>

<intake>
What do you need to do?

1. **Update after a code change** — `src/` or `index.ts` has changed and documents need
   to reflect it
2. **Review consistency** — check that all documents reflect the current source
3. **Update a specific document** — you know exactly which one

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "code changed", "after change", "just merged", "new feature", "bug fix" | workflows/update-after-change.md |
| 2, "review", "consistency", "check", "audit", "verify" | workflows/consistency-review.md |
| 3, "specific", or names a document | See document routing below |

**Document-specific routing (option 3):**

| Document named | Workflow |
|---|---|
| `README.md` or `GUIDE.md` | workflows/update-public-api.md |
| `ARCHITECTURE.md` | workflows/update-architecture.md |
| `CLAUDE.md` or `copilot-instructions.md` | workflows/update-agent-docs.md |
| `REQUIREMENTS.md` | workflows/update-requirements.md |
| JSDoc / `src/` | workflows/update-jsdoc.md |

**Intent-based routing (clear intent without selecting a number):**
- "document the new API" / "update README" → workflows/update-public-api.md
- "update the architecture doc" → workflows/update-architecture.md
- "update CLAUDE.md" / "add non-obvious behavior" → workflows/update-agent-docs.md
- "update JSDoc" / "inline docs" → workflows/update-jsdoc.md
- "update requirements" → workflows/update-requirements.md
- "review all docs" / "check consistency" → workflows/consistency-review.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| document-map.md | Each document's audience, scope, update triggers, and consistency checks |
| tone-guide.md | Writing tone, register, and conciseness rules per document type |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| update-after-change.md | Determine which documents to update after a code change, then update them in order |
| update-public-api.md | Update `README.md` and `GUIDE.md` |
| update-architecture.md | Update `ARCHITECTURE.md` |
| update-agent-docs.md | Update `CLAUDE.md` and `.github/copilot-instructions.md` |
| update-requirements.md | Update `REQUIREMENTS.md` |
| update-jsdoc.md | Update JSDoc comments in `src/` |
| consistency-review.md | Review all documents for consistency with current source |
</workflows_index>