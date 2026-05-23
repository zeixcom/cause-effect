<process>
## Step 1: Read the inputs

1. `REQUIREMENTS.md` — goals, constraints, non-negotiables
2. Relevant sections of `ARCHITECTURE.md` — understand the current system
3. `CLAUDE.md` — non-obvious constraints that affect the design surface

## Step 2: Explore the codebase

Identify affected files, existing patterns to follow or break from, and constraints the design must respect.

## Step 3: Ask focused questions

Clarify anything not resolved by the inputs — missing constraints, testing strategy, breaking vs. additive change.

**Wait for answers before proceeding.**

## Step 4: Design and challenge

Propose a solution. For each major decision: state the choice, name alternatives considered, make tradeoffs explicit. If a proposal feels over-engineered, say so and offer a simpler alternative. Prefer extending existing patterns over introducing new abstractions.

Show the design to the user and wait for confirmation before writing documents.

## Step 5: Update ARCHITECTURE.md

Update relevant sections to reflect the agreed design. Add a row to the Key Decisions table for every significant decision:

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|

Keep it accurate and concise — it is the developer's primary reference. (Tech-writer will update it again post-implementation for code-level accuracy.)

## Step 6: Write tasks to TODO.md

Break implementation into ordered, actionable tasks. Each task must:
- Have a unique `CE-NNN` ID (next available)
- Be scoped to a single skill (`cause-effect-dev`, `tech-writer`, `changelog-keeper`)
- Have enough **Context:** that the developer makes no architectural decisions
- Be ordered so dependencies come first

Create `TODO.md` at the project root if it doesn't exist.
</process>

<success_criteria>
- Design traces back to REQUIREMENTS.md — no features invented
- Key Decisions table updated in ARCHITECTURE.md for every significant choice
- TODO.md has ordered tasks with IDs and sufficient context
- No task requires the developer to guess intent or make architectural decisions
- Open questions resolved or escalated to the user
</success_criteria>
