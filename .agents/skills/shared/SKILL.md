---
name: shared
description: >
  Shared reference knowledge base for @zeix/cause-effect agent skills.
  Contains common reference files used by multiple skills to avoid duplication.
user_invocable: false
---

<scope>
This directory contains **shared reference files** that are used by multiple agent skills
to avoid content duplication. These files contain knowledge that is relevant to both
consumer projects (using the library) and library development (working on the library).

**Do not invoke this skill directly.** It is a resource directory, not an agent skill.
</scope>

<structure>
```
shared/
├── references/
│   ├── api-facts.md          # API constraints, functions, options, patterns
│   ├── non-obvious-behaviors.md # Counterintuitive behaviors with examples
│   └── error-classes.md      # Error classes and when they are thrown
```
</structure>

<usage>
Other skills should reference files from this directory in their `reference_index`:

```markdown
<reference_index>
| File | Contents |
|---|---|
| ../shared/references/api-facts.md | Key API constraints and callback patterns |
| ../shared/references/non-obvious-behaviors.md | Counterintuitive behaviors |
| ../shared/references/error-classes.md | Error classes and trigger conditions |
| references/signal-types.md | Signal type catalog (consumer-specific) |
| references/source-map.md | Source file locations (dev-specific) |
| references/internal-types.md | Internal node shapes (dev-specific) |
</reference_index>
```

Skills can extend shared references with skill-specific additions below the shared content.
</usage>

<maintenance>
When updating shared reference files:

1. **Verify both contexts**: Ensure the change is accurate for both consumer and developer use cases
2. **Check for skill-specific supplements**: After updating a shared file, review any skill-specific additions in consuming skills
3. **Update all references**: If a shared file structure changes significantly, update all SKILL.md files that reference it
4. **Test both skills**: After changes, verify that both `cause-effect` and `cause-effect-dev` skills still work correctly

**Shared files should contain:**
- Base knowledge applicable to both contexts
- Clear markers where developer-specific details differ
- Links to skill-specific supplements when available

**Shared files should NOT contain:**
- Skill-specific workflow instructions
- Internal implementation details (belong in cause-effect-dev)
- Consumer-only examples without general applicability
</maintenance>

<file_purpose>

| File | Purpose | Consumer Relevance | Dev Relevance |
|------|---------|-------------------|---------------|
| api-facts.md | API constraints, core functions, options, callback patterns | ✅ High | ✅ High |
| non-obvious-behaviors.md | Counterintuitive behaviors that cause bugs | ✅ High | ✅ High |
| error-classes.md | Error classes, when thrown, how to handle | ✅ High | ✅ High |
</file_purpose>
