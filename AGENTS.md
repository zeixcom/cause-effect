# Agent Skills for Cause & Effect

## Available Skills

Use these skills for targeted tasks. Each skill carries embedded reference knowledge and step-by-step workflows:

- **`/cause-effect-dev`** — implement features, fix bugs, write tests, or answer questions about the library's internals or public API. Requires access to library source files. Loads references from `.agents/skills/cause-effect-dev/references/` including source-map, internal-types, and shared references (api-facts, non-obvious-behaviors, error-classes).

- **`/cause-effect`** — use the library from a consumer project. All knowledge is embedded; no source files required. Loads references from `.agents/skills/cause-effect/references/` including signal-types and shared references (api-facts, non-obvious-behaviors, error-classes).

- **`/architect`** — triage issues, gather requirements, design solutions, review API changes. Maintains REQUIREMENTS.md, ARCHITECTURE.md, TODO.md. Loads references from `.agents/skills/architect/workflows/`.

- **`/adr-keeper`** — manage Architectural Decision Records. Creates, updates, lists, and supersedes ADRs in the `/adr/` directory. Loads references from `.agents/skills/adr-keeper/`.

- **`/changelog-keeper`** — maintain CHANGELOG.md. Adds entries, prepares releases. Loads from `.agents/skills/changelog-keeper/SKILL.md`.

- **`/tech-writer`** — keep documentation in sync with source code. Updates README.md, GUIDE.md, ARCHITECTURE.md, REQUIREMENTS.md, AGENTS.md, JSDoc. Loads references from `.agents/skills/tech-writer/`.

> **Note:** The `non-obvious-behaviors.md` reference (loaded by cause-effect and cause-effect-dev skills) contains all non-obvious behaviors that were previously documented here. All factual knowledge has been moved to skill reference files for better maintainability.

## Working with ZCode / GLM Models

This repository is configured for ZCode with GLM models. A few conventions improve results:

- **Prefer dedicated tools over shell.** Use Read/Edit/Write/Glob/Grep for file work instead of `cat`/`grep`/`sed`/`awk` via Bash. They integrate with the permission system and produce better-grounded edits.
- **Stop and ask rather than guess.** When a skill intake or workflow says "wait for response", either ask via the question tool or stop and wait. Do not proceed on assumed intent.
- **Verify every change.** Run `bun test` after code changes. This is the success gate named in every dev workflow.
- **`AGENTS.md` is the single agent-doc entry point.** Do not create `CLAUDE.md`, `.github/copilot-instructions.md`, or other tool-specific instruction files — keep all agent-facing guidance here and in the skills under `.agents/skills/`.

## Skill Precedence

If a skill exists both globally (e.g. `~/.agents/skills/<name>/`) and in this project (`.agents/skills/<name>/`) and they conflict, **prefer the project-specific skill**. It is versioned with the repository and reflects the current state of the code. Global skills may lag behind.
