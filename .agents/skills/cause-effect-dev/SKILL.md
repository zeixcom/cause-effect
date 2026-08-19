---
name: cause-effect-dev
description: >
  Expert developer for the @zeix/cause-effect reactive signals library. Use when implementing features, fixing bugs, writing tests, or answering questions about the library's internals, public API, or design decisions.
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

**No ticket numbers in source or tests.** Never write an issue, PR, or ticket number
(`#123`, `CE-456`) into a source comment or a test description. The branch or ticket closes and the reference goes stale — a future reader can't resolve it. Describe the behavior, constraint, or bug being guarded against directly instead; put ticket references in the commit message, where they belong.

**Composite derivation over effect-driven writes.** `adr/0018-shape-indexed-signal-types.md` documents the anti-pattern the library actively closes: an effect that reads a `Task`/`Memo` and writes the result into a `Store`/`List` with `.set()`. When implementing or reviewing a feature that fills one signal from another, prefer extending `deriveStore`/`deriveList`'s async and per-item derivation paths over adding a write path — a discouraged pattern surviving only because no derivation covers the case is itself a signal the derivation surface has a gap.
</essential_principles>

<intake>
What kind of task is this?

1. **Implement** — add or extend functionality
2. **Fix** — debug or fix unexpected behavior
3. **Test** — write or update tests
4. **Question** — understand the API, internals, or a design decision
5. **Baseline** — re-point the performance regression test at a new release

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "implement", "add", "extend", "build" | workflows/implement-feature.md |
| 2, "fix", "bug", "debug", "broken", "wrong" | workflows/fix-bug.md |
| 3, "test", "spec", "coverage" | workflows/write-tests.md |
| 4, "question", "explain", "how", "why", "what" | workflows/answer-question.md |
| 5, "baseline", "release", "perf baseline" | workflows/update-perf-baseline.md |

**Intent-based routing** (if user provides clear context without selecting):
- Describes a change to make → workflows/implement-feature.md
- Describes something not working → workflows/fix-bug.md
- Asks to write/update tests → workflows/write-tests.md
- Asks how something works → workflows/answer-question.md
- Just published a minor release, or the performance test fails on a branch that changed no source → workflows/update-perf-baseline.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
Shared references (from `../shared/references/`):

| File | Contents |
|---|---|
| ../shared/references/api-facts.md | Key API constraints and callback patterns |
| ../shared/references/non-obvious-behaviors.md | Counterintuitive behaviors with examples |
| ../shared/references/error-classes.md | Error classes and when they are thrown |

Skill-specific references (in `references/`):

| File | Contents |
|---|---|
| source-map.md | Authoritative documents + signal source file locations |
| internal-types.md | Node shapes and global pointers |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| implement-feature.md | Add or extend library functionality |
| fix-bug.md | Diagnose and fix unexpected behavior |
| write-tests.md | Write or update tests for a signal type or behavior |
| answer-question.md | Answer questions about the API, internals, or design |
| update-perf-baseline.md | Re-point the performance regression test at a new release |
</workflows_index>
