<required_reading>
1. references/document-map.md — README.md and GUIDE.md sections
2. references/tone-guide.md — public-api and guide tone rules
</required_reading>

<process>
## Step 1: Read the source of truth

Read `index.ts` for the current public API surface. Read the relevant `src/nodes/*.ts`
file(s) for any changed signal type. Do this before opening either document.

## Step 2: Update README.md

README.md is the authoritative public API reference. Make targeted edits only:

**New signal type**
- Add a `### SignalType` section under `## API` with: factory signature, all options, and
  at least one realistic example showing normal usage.
- Add the type to the "Choosing the Right Signal" table with a one-line description.
- If the type participates in ownership or has a `watched` lifecycle, add an example to
  "Advanced Usage → Resource Management".

**Changed option or signature**
- Update the relevant `### SignalType` section. Update the example if the old pattern no
  longer compiles or no longer represents idiomatic usage.
- If the change is a rename or a breaking type change, note the migration inline under the
  parameter description, not in a separate section.

**Removed API**
- Remove all mentions. Check: the API section, "Choosing the Right Signal", "Advanced Usage",
  and any cross-references in other signal type sections.

**New or changed behavior**
- Update the description in the relevant section. If the behavior is subtle, add or update
  an example. If it is an advanced pattern, add to "Advanced Usage".

## Step 3: Update GUIDE.md

GUIDE.md explains the library through the lens of developers migrating from React, Vue,
or Angular. Update it only when the change affects the conceptual picture:

- **"The Familiar Core" table** — update if a core factory name changes.
- **"What Works Differently"** — update if a fundamental behavioral contract changes
  (e.g. synchronous vs. async execution, nullability rules, ownership model).
- **"Beyond the Basics"** — update if a new signal type is added, or if a major signal
  type changes significantly enough that its comparative explanation is wrong.

Do NOT add every option change or minor signature tweak to GUIDE.md. Only update it when
a developer's existing mental model from another framework would now lead them astray.
</process>

<success_criteria>
- `index.ts` read before any edits were made
- README.md accurately reflects the current public API: all factories documented, all
  options current, all examples valid
- GUIDE.md updated only where the conceptual picture for framework migrants changed
- Both documents follow their respective tones from references/tone-guide.md
- No sections rewritten beyond what the change requires
</success_criteria>