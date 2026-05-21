<process>
## Step 1: Read the report

Read the issue or report fully. Identify what the user expected, what happened, and any reproduction steps.

## Step 2: Classify

- **Won't do** — conflicts with project goals, out of scope, or intentional behavior
- **Confirmed bug** — unexpected behavior with a clear reproduction path
- **Clear win feature** — aligns with REQUIREMENTS.md, limited scope, adds obvious value
- **Docs gap** — behavior is correct but undocumented or misleadingly documented
- **Unclear** — cannot classify without more information

To classify correctly:
- Read `REQUIREMENTS.md` (Must Have / Should Avoid / Out of Scope)
- Read `CLAUDE.md` — many apparent bugs are documented non-obvious behaviors
- Search the source if needed to confirm whether the behavior is by design

## Step 3: Resolve

**Won't do:** Answer the user directly. Explain why, referencing `REQUIREMENTS.md` if helpful.

**Confirmed bug:** Write a task in `TODO.md`:
- Next available `CE-NNN` ID
- **Skill:** `cause-effect-dev`
- **Context:** reproduction steps and expected behavior

**Clear win feature:** Confirm alignment with `REQUIREMENTS.md`. Write a task in `TODO.md`:
- **Skill:** `cause-effect-dev`
- **Context:** what to add and why it aligns with project goals

**Docs gap:** Write a task in `TODO.md`:
- **Skill:** `tech-writer`
- **Context:** which document is unclear and what the correct behavior is

**Unclear:** Ask the user. Do not write a task or make assumptions.
</process>

<success_criteria>
- Issue classified with clear reasoning grounded in REQUIREMENTS.md or CLAUDE.md
- Won't do: user has a specific explanation
- All other resolvable cases: a correctly formatted task in TODO.md
- Unclear cases: escalated to the user, not guessed
</success_criteria>
