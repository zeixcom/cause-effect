<required_reading>
1. references/document-map.md — REQUIREMENTS.md section
2. references/tone-guide.md — requirements tone rules
</required_reading>

<process>
## Step 1: Confirm the update is warranted

REQUIREMENTS.md captures the library's vision, audience, design principles, constraints,
and non-goals. It is intentionally written to survive version bumps. Do NOT update it for:

- Bug fixes or internal refactors
- New options on existing signal types
- Changed implementation details
- Documentation or tooling changes

Only update REQUIREMENTS.md when one of these applies:

| Trigger | Section affected |
|---|---|
| A new signal type is added to the library | "Design Principles → Minimal Surface, Maximum Coverage" table |
| A signal type is removed | Same table + "Non-Goals" if it was previously out of scope |
| A runtime environment is added or dropped | "Runtime Environments" |
| A bundle size target changes | "Size and Performance Constraints" |
| A design principle is added, changed, or removed | "Design Principles" |
| The primary or secondary audience shifts | "Audience" |
| A non-goal is resolved or a new one is added | "Non-Goals" |
| Stability guarantees change | "Stability" |

If the change does not meet any of these criteria, stop and explain why REQUIREMENTS.md
does not need updating. Do not edit it speculatively.

## Step 2: Read the full document

Read `REQUIREMENTS.md` in full before touching anything. Identify the single section
(or at most two) that the change affects. Changes to REQUIREMENTS.md are almost always
one table row, one list item, or one short paragraph — rarely more.

## Step 3: Make the minimal edit

Make only the change the trigger warrants:

**Signal type table (most common):**
Add or remove a row. The row format is:
`| **Type** | Role description | Data structure |`
Keep the role description to one short phrase. The table reflects the final state
of the type set — it is not a changelog.

**Runtime environments:**
Add or remove the environment name from the prose list. One line.

**Bundle size targets:**
Update the number in the table. If the target changed for a reason that future readers
should understand, add one sentence of rationale — no more.

**Non-goals:**
Each non-goal is a bold heading followed by one sentence. Do not expand them into
paragraphs. If adding a new non-goal, follow the same pattern. If resolving one,
remove it entirely — do not mark it as resolved inline.

**Stability section:**
Update only the factual claims (version number, breaking change expectations). Preserve
the formal register of the surrounding text.

## Step 4: Verify internal consistency

After editing, confirm:
- The signal type table count matches the count stated in the prose ("9 signal types").
- The "Non-Goals" section does not contradict anything now present in the codebase.
- The "Stability" section accurately describes the current version and compatibility stance.
</process>

<success_criteria>
- Update was warranted by one of the listed triggers
- Only the affected section was changed — no rewrites of accurate content
- Signal type table count consistent with prose and with `index.ts`
- Formal, strategic tone preserved throughout per references/tone-guide.md
- No changelog-style language ("previously", "now", "we changed") — state the current
  truth only
</success_criteria>