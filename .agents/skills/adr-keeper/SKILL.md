---
name: adr-keeper
description: Maintains Architectural Decision Records (ADRs) for this project. Creates, updates, lists, and supersedes ADRs in the /adr/ directory.
user_invocable: true
---

<scope>
This skill manages the **Architectural Decision Record (ADR) process** for @zeix/cause-effect:

- Create new ADRs from templates
- Update existing ADRs (Proposed status only)
- List all ADRs with status
- Supersede ADRs with newer decisions
- Maintain the ADR index

**In scope:** All files in `/adr/` directory (at project root)
**Out of scope:** REQUIREMENTS.md, ARCHITECTURE.md (use architect skill)

**ADR directory:** This skill assumes ADRs are stored in `/adr/` at the project root. If your
project uses a different location (e.g., `/docs/adr/`), the workflows will need to be adjusted
accordingly.
</scope>

<essential_principles>
**ADRs are immutable.** Once accepted, an ADR is never modified. Updates create new ADRs that supersede old ones.

**Trace to requirements.** Every ADR must reference relevant sections from REQUIREMENTS.md (e.g., M1, S3, X1).

**Sequential numbering.** ADRs use 4-digit sequential numbers (0001, 0002, ...).

**Status is explicit.** Each ADR must have a clear status: Proposed, Accepted, Rejected, Superseded.

**Concise over comprehensive.** Focus on the decision, context, and consequences. Avoid unnecessary detail.

**No changelog language, no ticket numbers.** An ADR records why a decision was made, not when it shipped or which task tracked it. Never write release/version numbers (e.g. "ships in 1.5.2"), ticket/task IDs (e.g. "CE-033"), or shipped-vs-pending status framing tied to a release inside an ADR's Context/Decision/Alternatives/Consequences — that content is transitory and belongs in `CHANGELOG.md` or `TODO.md`, which track it properly. An ADR's own `Status` field (Proposed/Accepted/Rejected/Superseded) is the only place decision lifecycle belongs, and it describes the *decision's* status, not a release's. If a decision text leans on "not yet shipped" or a ticket ID to make sense, that is a sign the reasoning itself isn't decoupled from the release calendar yet — rewrite it so the decision stands on its own. The only permissible exception is when an ADR governs the decision for a breaking change.
</essential_principles>

<intake>
What would you like to do with ADRs?

1. **Create** a new ADR
2. **Update** an existing ADR (only for Proposed status)
3. **List** all ADRs
4. **Supersede** an existing ADR
5. **Search** ADRs by keyword

Wait for response before proceeding.
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "create", "new", "add" | workflows/create-adr.md |
| 2, "update", "edit", "modify" | workflows/update-adr.md |
| 3, "list", "show all", "index" | workflows/list-adr.md |
| 4, "supersede", "replace", "deprecate" | workflows/supersede-adr.md |
| 5, "search", "find", "grep" | workflows/list-adr.md (with filter) |

**Intent-based routing:**
- "I want to document a decision" → workflows/create-adr.md
- "ADR 0005 needs a fix" → workflows/update-adr.md
- "Show me all ADRs" → workflows/list-adr.md
- "ADR 0002 is obsolete" → workflows/supersede-adr.md
- "Find ADRs about reactivity" → workflows/list-adr.md
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| adr-template.md | The template for new ADRs |
| adr-index.md | Index of all ADRs with status |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| create-adr.md | Create a new ADR from the template |
| update-adr.md | Update a Proposed ADR (immutable after Accepted) |
| list-adr.md | List all ADRs, optionally filtered by keyword |
| supersede-adr.md | Create a new ADR that supersedes an existing one |
</workflows_index>
