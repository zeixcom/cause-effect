---
name: cause-effect-dev
description: >
  Expert developer for the @zeix/cause-effect reactive signals library. Use when
  implementing features, fixing bugs, writing tests, or answering questions about
  the library's internals, public API, or design decisions.
user_invocable: false
---

<scope>
This skill is for development work **on the @zeix/cause-effect library itself** — use it only inside the cause-effect repository where `REQUIREMENTS.md`, `ARCHITECTURE.md`, and `src/` are present at the project root.

For consumer projects that use `@zeix/cause-effect` as a dependency, use the `cause-effect` skill instead.
</scope>

<essential_principles>
**Read before writing.** Always read the relevant source file(s) before proposing or making changes.

**The signal type set is complete.** Check `REQUIREMENTS.md` before proposing anything new — new signal types are explicitly out of scope.

**`T extends {}`** — all signal generics exclude `null` and `undefined`. Use wrapper types or sentinel values to represent absence.

**Run `bun test`** after every change.
</essential_principles>

<intake>
What kind of task is this?

1. **Implement** — add or extend functionality
2. **Fix** — debug or fix unexpected behavior
3. **Test** — write or update tests
4. **Question** — understand the API, internals, or a design decision

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "implement", "add", "extend", "build" | workflows/implement-feature.md |
| 2, "fix", "bug", "debug", "broken", "wrong" | workflows/fix-bug.md |
| 3, "test", "spec", "coverage" | workflows/write-tests.md |
| 4, "question", "explain", "how", "why", "what" | workflows/answer-question.md |

**Intent-based routing** (if user provides clear context without selecting):
- Describes a change to make → workflows/implement-feature.md
- Describes something not working → workflows/fix-bug.md
- Asks to write/update tests → workflows/write-tests.md
- Asks how something works → workflows/answer-question.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| source-map.md | Authoritative documents + signal source file locations |
| internal-types.md | Node shapes and global pointers |
| api-facts.md | Key API constraints and callback patterns |
| non-obvious-behaviors.md | Counterintuitive behaviors with examples |
| error-classes.md | Error classes and when they are thrown |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| implement-feature.md | Add or extend library functionality |
| fix-bug.md | Diagnose and fix unexpected behavior |
| write-tests.md | Write or update tests for a signal type or behavior |
| answer-question.md | Answer questions about the API, internals, or design |
</workflows_index>