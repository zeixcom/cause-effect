---
name: cause-effect
description: >
  Expert guidance for using the @zeix/cause-effect reactive signals library in any project.
  Use when implementing reactive patterns, debugging unexpected behavior, or answering
  questions about the public API, signal types, or design decisions. Works in any project
  that depends on @zeix/cause-effect — all knowledge is embedded, no library source required.
---

<scope>
This skill is for **consumer projects** that use `@zeix/cause-effect` as a dependency.
All domain knowledge is embedded in `references/` — no library source files are required.

For development work on the library itself, use the `cause-effect-dev` skill instead.
</scope>

<essential_principles>
**`T extends {}`** — all signal generics exclude `null` and `undefined`. Use wrapper types or sentinel values to represent absence.

**`createEffect` must be inside an owner.** Always wrap effect creation in `createScope` or nest it inside another effect.

**Never guess API shapes or behaviors.** The answers are in `references/`. If the embedded knowledge is insufficient, check the library's README or GUIDE — do not invent behavior.
</essential_principles>

<intake>
What kind of task is this?

1. **Use** — implement reactive patterns using the library's public API
2. **Debug** — investigate unexpected or broken reactive behavior
3. **Question** — understand the API, which signal to use, or a design decision

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "use", "implement", "add", "build", "write" | workflows/use-api.md |
| 2, "debug", "fix", "broken", "not working", "wrong", "unexpected" | workflows/debug.md |
| 3, "question", "explain", "how", "why", "what", "which", "when" | workflows/answer-question.md |

**Intent-based routing** (if user provides clear context without selecting):
- Describes code to write or a feature to add → workflows/use-api.md
- Describes something not working as expected → workflows/debug.md
- Asks how something works or which signal to use → workflows/answer-question.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/` — all knowledge is self-contained, no external files required:

| File | Contents |
|---|---|
| signal-types.md | What each signal is for, when to use each, decision guide |
| api-facts.md | Key API constraints, core functions, options, callback patterns |
| non-obvious-behaviors.md | Counterintuitive behaviors with correct vs incorrect examples |
| error-classes.md | Error classes, trigger conditions, and how to handle them |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| use-api.md | Implement reactive patterns using the public API |
| debug.md | Diagnose and fix unexpected reactive behavior |
| answer-question.md | Answer questions about the API, signals, or design |
</workflows_index>