<required_reading>
1. references/document-map.md — map the change type to affected documents
</required_reading>

<process>
## Step 1: Understand the change

Inspect the diff against the main branch:

```bash
git diff main..HEAD -- src/ index.ts
```

If no diff is available, ask the user to describe what changed.

## Step 2: Classify the change

Identify which of the following change types apply — more than one may apply:

| Change type | Examples |
|---|---|
| **New public API** | New factory function, new export, new type in `index.ts` |
| **Changed public API** | Modified signature, new option, renamed parameter, changed return type |
| **Removed public API** | Removed export, removed option, removed type |
| **New or changed non-obvious behavior** | Graph semantics, propagation edge case, ownership subtlety |
| **Internal implementation change** | Graph engine logic, flag values, node shapes, propagation algorithm |
| **Vision or scope change** | New design principle, changed audience, new constraint or non-goal |

## Step 3: Determine affected documents

Use this table to identify which documents need updating:

| Change type | JSDoc | ARCHITECTURE.md | CLAUDE.md + copilot | README.md | GUIDE.md | REQUIREMENTS.md |
|---|---|---|---|---|---|---|
| New public API | ✓ | ✓ | ✓ | ✓ | ✓ if conceptually new | ✓ signal type table only |
| Changed public API | ✓ | if node shape changed | ✓ if behavior changes | ✓ | ✓ if affects mental model | ✗ |
| Removed public API | ✓ | ✓ if structural | ✓ | ✓ | ✓ if was documented | ✗ |
| New/changed non-obvious behavior | ✗ | ✓ if graph-level | ✓ | ✓ if affects usage pattern | ✗ | ✗ |
| Internal implementation change | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Vision or scope change | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## Step 4: Update affected documents in order

Follow the corresponding workflow for each affected document. Always work in this order — each layer informs the next:

1. **JSDoc** (`src/`) — closest to code; establishes precise wording
   → workflows/update-jsdoc.md
2. **ARCHITECTURE.md** — internal structure; must be consistent with source
   → workflows/update-architecture.md
3. **CLAUDE.md + copilot-instructions.md** — agent docs; must be consistent with architecture
   → workflows/update-agent-docs.md
4. **README.md + GUIDE.md** — public docs; must be consistent with API and agent docs
   → workflows/update-public-api.md
5. **REQUIREMENTS.md** — only if scope changed
   → workflows/update-requirements.md

Skip any document not identified as affected in Step 3.
</process>

<success_criteria>
- Change type(s) correctly identified from the diff or description
- Only affected documents updated — no speculative edits
- Documents updated in the prescribed order
- Each document follows its tone guide
</success_criteria>